import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AudioEngine, SOUND_THEMES } from '../services/audioEngine';
import { SensorSimulator } from '../services/sensorSimulator';
import { evaluate, wellnessScore } from '../services/agentEnvironment';
import { runMultiAgentCycle, toolCallsToEnvironment } from '../services/multiAgentService';

const MAX_LOGS = 12;
const AGENT_COOLDOWN_MS = 90000;
const AGENT_PHASES = new Set(['detect', 'adjust', 'recover', 'ready']);

function getSensorShift(previous, next) {
  if (!previous || !next) return { score: 999, label: 'initial sync' };

  const changes = [
    { key: 'hr', label: 'HR', value: Math.abs(next.hr - previous.hr), threshold: 10 },
    { key: 'breath', label: 'breath', value: Math.abs(next.breath - previous.breath), threshold: 3 },
    { key: 'stress', label: 'stress', value: Math.abs(next.stress - previous.stress), threshold: 18 },
    { key: 'spo2', label: 'SpO2', value: Math.abs(next.spo2 - previous.spo2), threshold: 1.5 },
    { key: 'hrv', label: 'HRV', value: Math.abs(next.hrv - previous.hrv), threshold: 12 },
  ];

  const strongest = changes.reduce((best, item) =>
    item.value / item.threshold > best.value / best.threshold ? item : best
  );

  return {
    score: strongest.value / strongest.threshold,
    label: `${strongest.label} changed ${strongest.value.toFixed(strongest.key === 'spo2' || strongest.key === 'breath' ? 1 : 0)}`,
  };
}

function formatToolAction(toolCall) {
  const args = toolCall.args ?? {};
  if (toolCall.name === 'set_ambient_light') {
    return `Smart light -> ${args.mood_label ?? args.color_hex ?? 'updated'}`;
  }
  if (toolCall.name === 'play_ambient_sound') {
    return `Speaker -> ${args.theme ?? 'ambient'} at ${args.volume ?? 40}%`;
  }
  if (toolCall.name === 'set_breathing_guide') {
    return `Breathing guide -> ${args.breaths_per_minute ?? 8}/min`;
  }
  if (toolCall.name === 'log_health_summary') {
    return `Summary -> wellness ${args.wellness_score ?? '--'}/100`;
  }
  return toolCall.name;
}

// ─── Mini Metric Card ─────────────────────────────────────────────────────────
function SensorCard({ faIcon, label, value, unit, color, trend }) {
  return (
    <motion.div layout className="glass p-3 flex flex-col items-center gap-1 relative overflow-hidden">
      <i className={`fa-solid ${faIcon} text-sm`} style={{ color }} />
      <motion.span
        key={value}
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-xl font-black tabular-nums"
        style={{ color }}
      >
        {value}
      </motion.span>
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{unit}</span>
      <span className="text-xs text-center leading-tight" style={{ color: 'var(--text-muted)' }}>{label}</span>
      {trend !== 0 && (
        <div className="absolute top-2 right-2">
          <i className={`fa-solid ${trend > 0 ? 'fa-arrow-up' : 'fa-arrow-down'} text-xs`}
            style={{ color: trend > 0 ? 'var(--accent-coral)' : 'var(--accent-teal)' }} />
        </div>
      )}
    </motion.div>
  );
}

// ─── Log Entry (supports both rule-based and LLM tool-call logs) ────────────
function LogEntry({ entry }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col gap-1.5 pb-3 border-b"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{entry.time}</span>
        <span className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: `${entry.color}20`, color: entry.color }}>
          {entry.source === 'llm' ? '🤖 GPT-4o' : entry.ruleId?.replace(/_/g, ' ')}
        </span>
        {entry.source === 'llm' && (
          <span className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--accent-teal)' }}>
            multi-agent
          </span>
        )}
      </div>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
        <i className="fa-solid fa-brain mr-1.5 text-xs" style={{ color: entry.color }} />
        {entry.reason}
      </p>
      <div className="flex flex-col gap-0.5">
        {(entry.actions ?? []).map((a, i) => (
          <p key={i} className="text-xs font-mono" style={{ color: 'var(--accent-teal)' }}>
            → {a}
          </p>
        ))}
      </div>
    </motion.div>
  );
}

function SmartHomePanel({ envData, currentSound, llmThinking, agentMode }) {
  const devices = [
    {
      icon: 'fa-lightbulb',
      name: 'Smart Light',
      value: envData.lightLabel,
      status: 'connected',
      color: envData.color,
    },
    {
      icon: SOUND_THEMES[currentSound]?.icon ?? 'fa-volume-high',
      name: 'Sleep Speaker',
      value: SOUND_THEMES[currentSound]?.label ?? 'standby',
      status: currentSound ? 'playing' : 'connected',
      color: '#74b9ff',
    },
    {
      icon: 'fa-wind',
      name: 'Breathing Guide',
      value: `${envData.breathTarget?.toFixed(1) ?? 10}/min`,
      status: 'synced',
      color: '#8fdcc9',
    },
    {
      icon: 'fa-house-signal',
      name: 'Sensor Hub',
      value: agentMode === 'llm' ? 'agent controlled' : 'rule controlled',
      status: llmThinking ? 'updating' : 'online',
      color: '#f4b454',
    },
  ];

  return (
    <motion.div layout className="glass p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Smart Home Connected</p>
          <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Agent syncs lights, speaker, and sleep guide from live sensors</p>
        </div>
        <span className="text-[11px] px-2 py-1 rounded-full"
          style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--accent-teal)' }}>
          {llmThinking ? 'syncing' : 'online'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {devices.map(device => (
          <div key={device.name} className="rounded-xl p-2.5"
            style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${device.color}18` }}>
                <i className={`fa-solid ${device.icon} text-xs`} style={{ color: device.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{device.name}</p>
                <p className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>{device.value}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: device.color }} />
              <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{device.status}</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function ScenarioPanel({ vitals, score }) {
  const impact = vitals.impact ?? { hrDelta: 0, stressDelta: 0, hrvDelta: 0, recovery: 0 };
  const steps = [
    { key: 'detect', label: 'Detect', icon: 'fa-satellite-dish' },
    { key: 'adjust', label: 'Adjust', icon: 'fa-house-signal' },
    { key: 'recover', label: 'Recover', icon: 'fa-chart-line' },
    { key: 'ready', label: 'Ready', icon: 'fa-moon' },
  ];
  const activeIndex = Math.max(0, steps.findIndex(step => step.key === vitals.phase));

  return (
    <div className="glass p-4 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            {vitals.scenarioName ?? 'Live sleep scenario'}
          </p>
          <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>
            {vitals.scenarioTrigger ?? 'sensor-driven environment response'}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-black tabular-nums" style={{ color: 'var(--accent-teal)' }}>{score}</p>
          <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>wellness</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {steps.map((step, index) => {
          const active = index <= activeIndex;
          return (
            <div key={step.key} className="rounded-xl px-1.5 py-2 text-center"
              style={{
                background: active ? 'rgba(16,185,129,0.1)' : 'rgba(0,0,0,0.02)',
                border: active ? '1px solid rgba(16,185,129,0.2)' : '1px solid var(--border)',
              }}>
              <i className={`fa-solid ${step.icon} text-xs mb-1`} style={{ color: active ? 'var(--accent-teal)' : 'var(--text-muted)' }} />
              <p className="text-[10px] font-semibold" style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>{step.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'HR', value: impact.hrDelta > 0 ? `-${impact.hrDelta}` : `${impact.hrDelta}`, unit: 'bpm', color: 'var(--accent-coral)' },
          { label: 'Stress', value: impact.stressDelta > 0 ? `-${impact.stressDelta}` : `${impact.stressDelta}`, unit: 'pts', color: 'var(--accent-amber)' },
          { label: 'HRV', value: impact.hrvDelta > 0 ? `+${impact.hrvDelta}` : `${impact.hrvDelta}`, unit: 'ms', color: 'var(--accent-teal)' },
        ].map(item => (
          <div key={item.label} className="rounded-xl p-2"
            style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border)' }}>
            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{item.label}</p>
            <p className="text-sm font-black tabular-nums" style={{ color: item.color }}>
              {item.value} <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{item.unit}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function getCompanionMemory(persona, vitals) {
  if (persona.agent_memory?.length) return persona.agent_memory;

  const occupation = persona.occupation ?? 'daily routine';
  const sleepAvg = persona.metrics?.sleep_hours;
  return [
    sleepAvg ? `Usually sleeps around ${sleepAvg}h, so tonight's wind-down should start early.` : 'Learns sleep timing from recent wearable patterns.',
    `Known routine: ${occupation}. Use quiet environmental changes first.`,
    'Agent memory will update as more nightly patterns appear.',
  ];
}

function CompanionMemoryPanel({ persona, vitals, envData }) {
  const impact = vitals.impact ?? { hrDelta: 0, stressDelta: 0, hrvDelta: 0 };
  const memory = getCompanionMemory(persona, vitals);
  const reasoning = [
    {
      label: 'Detected',
      text: `${vitals.phaseLabel ?? 'Sensor shift'} with HR ${vitals.hr} and stress ${vitals.stress}%.`,
      icon: 'fa-wave-square',
    },
    {
      label: 'Reasoned',
      text: impact.stressDelta > 8
        ? `Body is responding; maintain the calmer room instead of changing aggressively.`
        : `Nervous system still looks active, so the room should reduce stimulation.`,
      icon: 'fa-brain',
    },
    {
      label: 'Acted',
      text: `${envData.moodLabel ?? 'Calm lighting'} with ${envData.breathTarget?.toFixed(1) ?? 6}/min breathing.`,
      icon: 'fa-house-signal',
    },
  ];

  const nextAction = vitals.phase === 'ready'
    ? 'Keep environment stable and avoid notifications for the next sleep window.'
    : impact.stressDelta > 12
      ? 'Continue current sound/light for 10 minutes, then lower volume gradually.'
      : 'Guide 3 minutes of slow breathing before making another adjustment.';

  return (
    <div className="glass p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(139,124,246,0.14)' }}>
          <i className="fa-solid fa-user-check text-xs" style={{ color: '#a99cff' }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>AI Companion Memory & Reasoning</p>
          <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>Personal context + live sensor reasoning</p>
        </div>
      </div>

      <div className="rounded-xl p-3 mb-3"
        style={{ background: 'rgba(139,124,246,0.08)', border: '1px solid rgba(139,124,246,0.16)' }}>
        <div className="flex items-center gap-1.5 mb-2">
          <i className="fa-solid fa-database text-[10px]" style={{ color: '#a99cff' }} />
          <p className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>Long-term memory used</p>
        </div>
        <div className="flex flex-col gap-1.5">
          {memory.map(item => (
            <p key={item} className="text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--accent-teal)' }}>•</span> {item}
            </p>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {reasoning.map(step => (
          <div key={step.label} className="rounded-xl p-2"
            style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <i className={`fa-solid ${step.icon} text-[10px]`} style={{ color: 'var(--accent-teal)' }} />
              <p className="text-[10px] font-semibold" style={{ color: 'var(--text-primary)' }}>{step.label}</p>
            </div>
            <p className="text-[10px] leading-snug" style={{ color: 'var(--text-secondary)' }}>{step.text}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-3 flex items-start gap-2"
        style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.16)' }}>
        <i className="fa-solid fa-calendar-check text-xs mt-0.5" style={{ color: 'var(--accent-teal)' }} />
        <div>
          <p className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>Next best action</p>
          <p className="text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>{nextAction}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SleepEnvironmentScreen({ persona, onBack }) {
  const [vitals,      setVitals]      = useState({
    hr:     persona.metrics.heart_rate_avg,
    breath: 13,
    stress: persona.metrics.stress_level,
    spo2:   97,
    hrv:    persona.metrics.hrv,
    phase: 'detect',
    phaseLabel: 'Stress spike detected',
    agentState: 'reading sensors',
    progress: 0.12,
    scenarioName: 'Live sleep scenario',
    scenarioTrigger: 'sensor-driven environment response',
    impact: { hrDelta: 0, stressDelta: 0, hrvDelta: 0, recovery: 0 },
  });
  const [prevVitals,  setPrevVitals]  = useState(null);
  const [env,         setEnv]         = useState(null);
  const [logs,        setLogs]        = useState([]);
  const [isActive,    setIsActive]    = useState(false);
  const [breathPhase, setBreathPhase] = useState('inhale');
  const [currentSound,setCurrentSound]= useState(null);
  const [agentMode,   setAgentMode]   = useState('llm');  // 'rule' | 'llm'
  const [llmThinking, setLlmThinking] = useState(false);
  const [llmError,    setLlmError]    = useState(null);
  const [lastAgentReason, setLastAgentReason] = useState('waiting for sensor shift');

  const engineRef      = useRef(null);
  const sensorRef      = useRef(null);
  const lastRuleRef    = useRef(null);
  const pendingRuleRef = useRef(null);
  const confirmCntRef  = useRef(0);
  const CONFIRM_TICKS  = 3;
  const breathRef      = useRef(null);
  const vitalsRef      = useRef(vitals); // always-fresh vitals for LLM interval
  const currentSoundRef = useRef(currentSound);
  const lastAgentVitalsRef = useRef(null);
  const lastAgentRunAtRef = useRef(0);
  const handledAgentPhasesRef = useRef(new Set());
  const lastDecisionSignatureRef = useRef('');

  // Keep vitalsRef in sync
  useEffect(() => { vitalsRef.current = vitals; }, [vitals]);
  useEffect(() => { currentSoundRef.current = currentSound; }, [currentSound]);

  const hasApiKey = true;
  const score = wellnessScore(vitals);

  // ── Breathing guide (speed driven by agent's breathTarget) ────────────────
  useEffect(() => {
    const target = env?.environment?.breathTarget ?? 10;
    const halfMs = (60 / target / 2) * 1000;
    clearTimeout(breathRef.current);
    const tick = () => {
      setBreathPhase(p => p === 'inhale' ? 'exhale' : 'inhale');
      breathRef.current = setTimeout(tick, halfMs);
    };
    breathRef.current = setTimeout(tick, halfMs);
    return () => clearTimeout(breathRef.current);
  }, [env?.environment?.breathTarget]);

  // ── Start sensors & audio on mount ───────────────────────────────────────
  useEffect(() => {
    const sim = new SensorSimulator(persona);
    sensorRef.current = sim;

    sim.subscribe((newVitals) => {
      setVitals(prev => {
        setPrevVitals(prev);
        return newVitals;
      });
    });

    sim.start();
    setIsActive(true);

    return () => {
      sim.stop();
      engineRef.current?.stop();
      clearTimeout(breathRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rule-based agent loop (only when mode='rule') ───────────────────────
  useEffect(() => {
    if (!isActive || agentMode !== 'rule') return;
    const decision = evaluate(vitals);
    if (!decision) return;

    const newRuleId = decision.ruleId;
    if (newRuleId === lastRuleRef.current) {
      pendingRuleRef.current = null; confirmCntRef.current = 0;
      setEnv(decision); return;
    }
    if (newRuleId === pendingRuleRef.current) { confirmCntRef.current += 1; }
    else { pendingRuleRef.current = newRuleId; confirmCntRef.current = 1; }
    if (confirmCntRef.current < CONFIRM_TICKS) return;

    pendingRuleRef.current = null; confirmCntRef.current = 0;
    lastRuleRef.current = newRuleId;
    setEnv(decision);

    const now = new Date();
    const ts  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    setLogs(prev => [{ id: Date.now(), time: ts, source: 'rule', ruleId: decision.ruleId,
      reason: decision.reason, actions: decision.actions, color: decision.environment.color,
    }, ...prev].slice(0, MAX_LOGS));

    const newTheme = decision.environment.sound;
    if (newTheme !== currentSound) {
      setCurrentSound(newTheme);
      setTimeout(async () => {
        const old = engineRef.current; engineRef.current = null; old?.stop();
        await new Promise(r => setTimeout(r, 900));
        const eng = new AudioEngine(); engineRef.current = eng;
        await eng.start(newTheme, decision.environment.volume * 2);
      }, 1500);
    } else if (engineRef.current) {
      engineRef.current.setVolume(decision.environment.volume * 2);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vitals, isActive, agentMode]);

  // ── LLM Multi-Agent loop (every 45s when mode='llm') ─────────────────────
  useEffect(() => {
    if (agentMode !== 'llm' || !isActive) {
      return;
    }

    const runCycle = async () => {
      const currentVitals = vitalsRef.current;
      const shift = getSensorShift(lastAgentVitalsRef.current, currentVitals);
      const nowMs = Date.now();
      const isFirstRun = !lastAgentVitalsRef.current;
      const cooldownReady = nowMs - lastAgentRunAtRef.current > AGENT_COOLDOWN_MS;
      const phaseChanged = AGENT_PHASES.has(currentVitals.phase)
        && !handledAgentPhasesRef.current.has(currentVitals.phase);
      const significantShift = shift.score >= 1.25;

      if (!isFirstRun && ((!phaseChanged && (!significantShift || !cooldownReady)) || llmThinking)) {
        return;
      }

      lastAgentRunAtRef.current = nowMs;
      lastAgentVitalsRef.current = { ...currentVitals };
      handledAgentPhasesRef.current.add(currentVitals.phase);
      setLastAgentReason(isFirstRun
        ? 'initial smart home sync'
        : phaseChanged
          ? `${currentVitals.phaseLabel} phase`
          : shift.label
      );
      setLlmThinking(true);
      setLlmError(null);
      try {
        const result = await runMultiAgentCycle(currentVitals, persona);

        const { environment, toolCalls, healthState, isMock, mockReason } = result;

        // Apply environment decision
        setEnv({ environment, ruleId: isMock ? 'demo' : 'gpt-4o' });

        // Log final decision
        const now = new Date();
        const ts  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
        const decisionSignature = [
          healthState.health_state,
          environment.sound,
          environment.breathTarget,
          Math.round(environment.volume ?? 0),
          Math.round(environment.wellnessScore ?? 0),
        ].join('|');
        const shouldLogDecision = decisionSignature !== lastDecisionSignatureRef.current || isFirstRun || phaseChanged;
        lastDecisionSignatureRef.current = decisionSignature;

        if (shouldLogDecision) setLogs(prev => [{
          id:      Date.now(), time: ts,
          source:  isMock ? 'demo' : 'llm',
          ruleId:  isMock ? 'demo-mode' : 'gpt-4o',
          reason:  isMock
            ? (mockReason ?? '⚡ Demo Mode') + ` — ${healthState.primary_concern}`
            : `[${healthState.health_state.toUpperCase()}] ${healthState.primary_concern} — wellness ${environment.wellnessScore}/100`,
          actions: toolCalls
            .filter(tc => tc?.name)
            .map(formatToolAction),
          color:   isMock ? '#f4b454' : environment.color,
        }, ...prev].slice(0, MAX_LOGS));

        // Switch sound
        if (environment.sound && environment.sound !== currentSoundRef.current) {
          setCurrentSound(environment.sound);
          const old = engineRef.current; engineRef.current = null; old?.stop();
          await new Promise(r => setTimeout(r, 900));
          const eng = new AudioEngine(); engineRef.current = eng;
          await eng.start(environment.sound, environment.volume * 2);
        }
      } catch (e) {
        setLlmError(e.message);
      } finally {
        setLlmThinking(false);
      }
    };

    runCycle();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentMode, isActive, vitals]);

  const envData = env?.environment ?? {
    color: '#a4b4bc', bgFrom: '#0b1117', bgTo: '#0b1117',
    lightLabel: 'Analyzing...', moodLabel: '...',
    breathTarget: 12,
  };
  const breathHalf = (60 / (envData.breathTarget ?? 10)) / 2;
  const hrTrend = prevVitals ? vitals.hr - prevVitals.hr : 0;
  const stressTrend = prevVitals ? vitals.stress - prevVitals.stress : 0;
  const pageBackground = `radial-gradient(circle at 50% 0%, ${envData.color}18 0%, transparent 34%)`;

  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden"
      style={{
        background: pageBackground,
        transition: 'background 4s ease',
      }}>

      {/* Ambient breathing orb */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <motion.div
          className="absolute left-1/2 top-1/3 rounded-full blur-3xl"
          animate={{
            scale:   breathPhase === 'inhale' ? 1.3 : 0.75,
            opacity: breathPhase === 'inhale' ? 0.14 : 0.05,
          }}
          transition={{ duration: breathHalf, ease: 'easeInOut' }}
          style={{ width: 340, height: 340, marginLeft: -170, marginTop: -170, background: envData.color }}
        />
      </div>

      <div className="relative z-10 flex flex-col px-4 py-5 overflow-y-auto">

        {/* ── Header ── */}
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onBack}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid var(--border)' }}>
              <i className="fa-solid fa-arrow-left text-sm" style={{ color: 'var(--text-secondary)' }} />
            </button>
            <div className="flex-1">
              <h1 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>AI Sleep Agent</h1>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Auto-adjust environment based on sensors</p>
            </div>
            {/* Agent mode badge */}
            <div className="status-dot" style={{ backgroundColor: envData.color }} />
          </div>

          {/* Mode Toggle */}
          <div className="flex gap-2">
            <button onClick={() => setAgentMode('rule')}
              className="flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
              style={{
                background: agentMode === 'rule' ? `${envData.color}22` : 'rgba(0,0,0,0.02)',
                border: agentMode === 'rule' ? `1px solid ${envData.color}55` : '1px solid var(--border)',
                color: agentMode === 'rule' ? envData.color : 'var(--text-secondary)',
              }}>
              <i className="fa-solid fa-code-branch text-xs" />
              Rule-Based
            </button>
            <button
              onClick={() => hasApiKey ? setAgentMode('llm') : setLlmError('VITE_OPENAI_API_KEY not found in .env')}
              className="flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
              style={{
                background: agentMode === 'llm' ? 'rgba(16,185,129,0.14)' : 'rgba(0,0,0,0.02)',
                border: agentMode === 'llm' ? '1px solid rgba(16,185,129,0.34)' : '1px solid var(--border)',
                color: agentMode === 'llm' ? 'var(--accent-teal)' : 'var(--text-secondary)',
              }}>
              {llmThinking
                ? <i className="fa-solid fa-spinner fa-spin text-xs" />
                : <i className="fa-solid fa-robot text-xs" />}
              GPT-4o Multi-Agent
              {!hasApiKey && <i className="fa-solid fa-lock text-xs ml-1" />}
            </button>
          </div>
          {agentMode === 'llm' && (
            <div className="w-full mt-2 px-3 py-2 rounded-xl text-xs flex items-center gap-2"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)', color: 'var(--accent-teal)' }}>
              <i className={`fa-solid ${llmThinking ? 'fa-spinner fa-spin' : 'fa-wave-square'} text-xs`} />
              <span className="flex-1 truncate">
                {llmThinking ? 'Agent is adjusting smart home...' : `Auto-trigger: ${lastAgentReason}`}
              </span>
            </div>
          )}
          {llmError && (
            <p className="text-xs mt-2 px-2" style={{ color: 'var(--accent-coral)' }}>
              <i className="fa-solid fa-triangle-exclamation mr-1" />{llmError}
            </p>
          )}
        </div>

        {/* ── Wellness Orb ── */}
        <ScenarioPanel vitals={vitals} score={score} />
        <CompanionMemoryPanel persona={persona} vitals={vitals} envData={envData} />

        <div className="flex flex-col items-center mb-5">
          <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
            {/* Breathing outer ring */}
            <motion.div className="absolute rounded-full"
              animate={{ scale: breathPhase === 'inhale' ? 1.2 : 0.85, opacity: breathPhase === 'inhale' ? 0.5 : 0.15 }}
              transition={{ duration: breathHalf, ease: 'easeInOut' }}
              style={{ inset: 0, border: `2px solid ${envData.color}`, boxShadow: `0 0 30px ${envData.color}30` }}
            />
            {/* HR pulse ring */}
            <motion.div className="absolute rounded-full"
              animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 60 / vitals.hr, repeat: Infinity, ease: 'easeInOut' }}
              style={{ inset: 18, border: `1px solid ${envData.color}55` }}
            />
            {/* Center */}
            <motion.div className="rounded-full flex flex-col items-center justify-center"
              animate={{ scale: breathPhase === 'inhale' ? 1.07 : 0.94 }}
              transition={{ duration: breathHalf, ease: 'easeInOut' }}
              style={{
                width: 106, height: 106,
                background: `radial-gradient(circle, ${envData.color}40 0%, ${envData.color}08 70%)`,
                border: `1px solid ${envData.color}45`,
                boxShadow: `0 0 40px ${envData.color}25`,
              }}>
              <span className="text-3xl font-black tabular-nums" style={{ color: envData.color }}>{score}</span>
              <span className="text-xs" style={{ color: `${envData.color}aa` }}>wellness</span>
            </motion.div>
          </div>

          {/* Mood + breathing guide */}
          <AnimatePresence mode="wait">
            <motion.p key={envData.moodLabel}
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-sm font-semibold mt-2" style={{ color: envData.color }}>
              {envData.moodLabel}
            </motion.p>
          </AnimatePresence>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            <i className="fa-solid fa-lungs mr-1" />
            {breathPhase === 'inhale' ? '▲ Inhale...' : '▽ Exhale...'} ({envData.breathTarget?.toFixed(1)}/min)
          </p>
        </div>

        {/* ── Live Sensor Grid ── */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <SensorCard faIcon="fa-heart-pulse" label="HR" value={vitals.hr}     unit="bpm" color="var(--accent-coral)" trend={hrTrend} />
          <SensorCard faIcon="fa-lungs"       label="Breath" value={vitals.breath} unit="/min" color={envData.color} trend={0} />
          <SensorCard faIcon="fa-brain"       label="Stress" value={vitals.stress} unit="%" color="var(--accent-amber)" trend={stressTrend} />
          <SensorCard faIcon="fa-droplet"     label="SpO2" value={vitals.spo2.toFixed(1)} unit="%" color="var(--accent-blue)" trend={0} />
        </div>

        {/* ── Current Environment Panel ── */}
        <SmartHomePanel
          envData={envData}
          currentSound={currentSound}
          llmThinking={llmThinking}
          agentMode={agentMode}
        />

        {env && (
          <motion.div layout className="glass p-4 mb-4"
            style={{ borderLeft: `3px solid ${envData.color}` }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${envData.color}20` }}>
                <i className="fa-solid fa-house-signal text-sm" style={{ color: envData.color }} />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: envData.color }}>Current Environment (Agent controlled)</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{envData.lightLabel}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: SOUND_THEMES[currentSound]?.icon ?? 'fa-music', label: 'Sound', value: SOUND_THEMES[currentSound]?.label ?? '...' },
                { icon: 'fa-volume-high', label: 'Volume', value: `${envData.volume ?? 0}%` },
                { icon: 'fa-palette',     label: 'Tone',     value: envData.moodLabel },
                { icon: 'fa-lungs',       label: 'Breath target', value: `${envData.breathTarget?.toFixed(1)}/min` },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <i className={`fa-solid ${item.icon} text-xs flex-shrink-0`} style={{ color: envData.color }} />
                  <div className="min-w-0">
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.label}</p>
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Agent Decision Log ── */}
        <div className="glass p-4 mb-4">
          <p className="text-xs font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <i className="fa-solid fa-terminal text-xs" style={{ color: 'var(--accent-teal)' }} />
            Agent Decision Log
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--accent-teal)' }}>
              live
            </span>
          </p>
          {logs.length === 0 ? (
            <div className="flex items-center gap-2 py-2">
              <i className="fa-solid fa-spinner fa-spin text-xs" style={{ color: 'var(--accent-teal)' }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Analyzing sensors...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-h-64 overflow-y-auto">
              <AnimatePresence initial={false}>
                {logs.map((entry) => (
                  <LogEntry key={entry.id} entry={entry} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── HRV Progress ── */}
        <div className="glass p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <i className="fa-solid fa-chart-line text-xs" style={{ color: 'var(--accent-teal)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>HRV (higher is better)</span>
            </div>
            <span className="text-xs font-bold" style={{ color: 'var(--accent-teal)' }}>{vitals.hrv} ms</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.06)' }}>
            <motion.div className="h-full rounded-full"
              animate={{ width: `${Math.min(100, (vitals.hrv / 80) * 100)}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              style={{ background: `linear-gradient(90deg, #f36f6f, #f4b454, #37c6a6)` }}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
