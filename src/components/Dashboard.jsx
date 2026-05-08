import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

const STATUS = {
  good: { color: 'var(--accent-teal)', bg: 'rgba(16,185,129,0.12)', label: 'Good' },
  watch: { color: 'var(--accent-amber)', bg: 'rgba(245,158,11,0.12)', label: 'Watch' },
  risk: { color: 'var(--accent-coral)', bg: 'rgba(239,68,68,0.12)', label: 'Risk' },
};

function getMetricStatus(kind, value) {
  if (kind === 'sleep') return value < 5.5 ? STATUS.risk : value < 7 ? STATUS.watch : STATUS.good;
  if (kind === 'stress') return value >= 75 ? STATUS.risk : value >= 50 ? STATUS.watch : STATUS.good;
  if (kind === 'steps') return value < 3500 ? STATUS.risk : value < 7000 ? STATUS.watch : STATUS.good;
  if (kind === 'hr') return value > 95 ? STATUS.risk : value > 80 ? STATUS.watch : STATUS.good;
  if (kind === 'hrv') return value < 30 ? STATUS.risk : value < 45 ? STATUS.watch : STATUS.good;
  if (kind === 'bmi') return value >= 30 ? STATUS.risk : value >= 25 ? STATUS.watch : STATUS.good;
  return STATUS.good;
}

function clamp(n) {
  return Math.max(0, Math.min(100, n));
}

function metricPercent(kind, value) {
  if (kind === 'sleep') return clamp((value / 8) * 100);
  if (kind === 'stress') return clamp(value);
  if (kind === 'steps') return clamp((value / 7000) * 100);
  if (kind === 'hr') return clamp(((value - 55) / 55) * 100);
  if (kind === 'hrv') return clamp((value / 70) * 100);
  if (kind === 'bmi') return clamp(((value - 18) / 17) * 100);
  return 50;
}

function buildPatterns(metrics, persona) {
  const patterns = [];
  if (metrics.heart_rate_avg > 80) patterns.push({ text: `Average heart rate ${metrics.heart_rate_avg} bpm is above optimal resting range`, level: metrics.heart_rate_avg > 95 ? 'risk' : 'watch' });
  if (metrics.stress_level >= 50) patterns.push({ text: `Stress level ${metrics.stress_level}% may disrupt sleep and HRV`, level: metrics.stress_level >= 75 ? 'risk' : 'watch' });
  if (metrics.sleep_hours < 7) patterns.push({ text: `Slept ${metrics.sleep_hours} hrs, below 7-9 hrs target`, level: metrics.sleep_hours < 5.5 ? 'risk' : 'watch' });
  if (metrics.steps_today < 7000) patterns.push({ text: `Steps ${metrics.steps_today.toLocaleString()}, below daily target`, level: metrics.steps_today < 3500 ? 'risk' : 'watch' });
  if (metrics.hrv < 45) patterns.push({ text: `HRV ${metrics.hrv} ms indicates incomplete recovery`, level: metrics.hrv < 30 ? 'risk' : 'watch' });
  if (metrics.bmi >= 25) patterns.push({ text: `BMI ${metrics.bmi} is in the preventive care range`, level: metrics.bmi >= 30 ? 'risk' : 'watch' });
  if (persona.symptoms?.length) patterns.push({ text: `Reported symptoms: ${persona.symptoms.slice(0, 2).join(', ')}`, level: 'watch' });
  return patterns.slice(0, 6);
}

function riskSummary(metrics) {
  const riskCount = [
    getMetricStatus('sleep', metrics.sleep_hours),
    getMetricStatus('stress', metrics.stress_level),
    getMetricStatus('steps', metrics.steps_today),
    getMetricStatus('hr', metrics.heart_rate_avg),
    getMetricStatus('hrv', metrics.hrv),
    getMetricStatus('bmi', metrics.bmi),
  ].filter(s => s === STATUS.risk).length;

  const watchCount = [
    getMetricStatus('sleep', metrics.sleep_hours),
    getMetricStatus('stress', metrics.stress_level),
    getMetricStatus('steps', metrics.steps_today),
    getMetricStatus('hr', metrics.heart_rate_avg),
    getMetricStatus('hrv', metrics.hrv),
    getMetricStatus('bmi', metrics.bmi),
  ].filter(s => s === STATUS.watch).length;

  if (riskCount >= 2) return { label: 'High risk', color: STATUS.risk.color, icon: 'fa-shield-heart', text: 'Multiple signals require further analysis and management today' };
  if (riskCount === 1 || watchCount >= 3) return { label: 'Needs attention', color: STATUS.watch.color, icon: 'fa-circle-exclamation', text: 'Found signals that need attention and behavior adjustment' };
  return { label: 'Stable', color: STATUS.good.color, icon: 'fa-circle-check', text: 'Overall under control, focus on maintaining health rhythms' };
}

function MiniMetric({ icon, title, value, unit, target, kind, delay }) {
  const status = getMetricStatus(kind, value);
  const percent = metricPercent(kind, value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="glass p-4"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: status.bg }}>
            <i className={`fa-solid ${icon}`} style={{ color: status.color }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{title}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Target: {target}</p>
          </div>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: status.bg, color: status.color }}>
          {status.label}
        </span>
      </div>
      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-3xl font-black tabular-nums" style={{ color: status.color }}>{value.toLocaleString()}</span>
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{unit}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
        <div className="h-full rounded-full" style={{ width: `${percent}%`, background: status.color }} />
      </div>
    </motion.div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass px-3 py-2">
      <p className="text-xs font-medium" style={{ color: 'var(--accent-teal)' }}>{label}</p>
      <p className="text-sm font-bold text-slate-800">{payload[0].value} hrs</p>
    </div>
  );
}

function PersonaMemoryCard({ persona }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="glass p-4 mb-4"
      style={{ borderColor: `${persona.avatar_color}28` }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${persona.avatar_color}18` }}>
          <i className="fa-solid fa-database text-sm" style={{ color: persona.avatar_color }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Agent memory profile</p>
          <p className="text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>{persona.headline}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-xl p-2.5" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border)' }}>
          <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--accent-teal)' }}>Known patterns</p>
          <p className="text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>{persona.known_patterns?.join(' · ')}</p>
        </div>
        <div className="rounded-xl p-2.5" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border)' }}>
          <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--accent-blue)' }}>Preferred response</p>
          <p className="text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
            {persona.preferred_intervention?.sound} · {persona.preferred_intervention?.breathing}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {persona.agent_memory?.slice(0, 2).map(item => (
          <p key={item} className="text-[11px] leading-snug" style={{ color: 'var(--text-primary)' }}>
            <span style={{ color: persona.avatar_color }}>•</span> {item}
          </p>
        ))}
      </div>
    </motion.div>
  );
}

const PLAN_COLORS = {
  Sleep:      { accent: 'var(--accent-blue)',   bg: 'rgba(59,130,246,0.10)' },
  Stress:     { accent: 'var(--accent-coral)',  bg: 'rgba(239,68,68,0.10)' },
  Activity:   { accent: 'var(--accent-teal)',   bg: 'rgba(16,185,129,0.10)' },
  Nutrition:  { accent: 'var(--accent-amber)',  bg: 'rgba(245,158,11,0.10)' },
};

function PlanDetailSheet({ item, personaColor, onClose }) {
  const colors = PLAN_COLORS[item.title] ?? { accent: personaColor, bg: `${personaColor}18` };
  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        className="relative rounded-t-3xl px-5 pt-5 pb-8 max-h-[84%] overflow-y-auto"
        style={{ background: 'var(--bg-surface)', borderTop: `2px solid ${colors.accent}` }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
      >
        {/* drag handle */}
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--border)' }} />

        {/* header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: colors.bg }}>
            <i className={`fa-solid ${item.icon} text-base`} style={{ color: colors.accent }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Daily plan</p>
            <h3 className="text-lg font-black leading-tight" style={{ color: 'var(--text-primary)' }}>{item.title}</h3>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.06)' }}>
            <i className="fa-solid fa-xmark text-sm" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* goal */}
        <div className="rounded-2xl p-3 mb-4 flex items-start gap-2"
          style={{ background: colors.bg, border: `1px solid ${colors.accent}30` }}>
          <i className="fa-solid fa-bullseye text-xs mt-0.5" style={{ color: colors.accent }} />
          <p className="text-xs font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>{item.goal}</p>
        </div>

        {/* steps */}
        <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>TODAY'S STEPS</p>
        <div className="flex flex-col gap-2 mb-4">
          {item.steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-2xl"
              style={{ background: 'rgba(0,0,0,0.025)', border: '1px solid var(--border)' }}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold mt-0.5"
                style={{ background: colors.bg, color: colors.accent }}>
                {i + 1}
              </span>
              <p className="text-xs leading-snug" style={{ color: 'var(--text-primary)' }}>{step}</p>
            </div>
          ))}
        </div>

        {/* agent tip */}
        <div className="rounded-2xl p-3 flex items-start gap-2"
          style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border)' }}>
          <i className="fa-solid fa-database text-xs mt-0.5" style={{ color: personaColor }} />
          <p className="text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Agent note: </span>
            {item.tip}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Dashboard({ persona, onAnalyze, onSleepEnv, onBack }) {
  const { metrics, sleep_chart } = persona;
  const summary = riskSummary(metrics);
  const sleepStatus = getMetricStatus('sleep', metrics.sleep_hours);
  const patterns = buildPatterns(metrics, persona);
  const [activePlan, setActivePlan] = useState(null);

  const wp = persona.wellness_plan ?? {};
  const plan = [
    { key: 'sleep',     ...(wp.sleep     ?? {}), icon: 'fa-moon',         title: 'Sleep'     },
    { key: 'stress',    ...(wp.stress    ?? {}), icon: 'fa-brain',        title: 'Stress'    },
    { key: 'activity',  ...(wp.activity  ?? {}), icon: 'fa-person-walking',title: 'Activity'  },
    { key: 'nutrition', ...(wp.nutrition ?? {}), icon: 'fa-apple-whole',  title: 'Nutrition' },
  ];

  return (
    <div className="min-h-dvh flex flex-col px-4 py-5">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 mb-3 text-xs font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          <i className="fa-solid fa-chevron-left text-[10px]" />
          Choose Persona
        </button>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0"
            style={{ border: `2px solid ${persona.avatar_color}40` }}>
            {persona.image
              ? <img src={persona.image} alt={persona.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"
                  style={{ background: `${persona.avatar_color}20` }}>
                  <i className={`fa-solid ${persona.fa_icon} text-lg`} style={{ color: persona.avatar_color }} />
                </div>
            }
          </div>
          <div className="min-w-0">
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Health profile of</p>
            <h2 className="font-bold text-xl leading-tight truncate" style={{ color: 'var(--text-primary)' }}>{persona.display_name ?? persona.name}</h2>
            <p className="text-xs mt-1" style={{ color: summary.color }}>
              <i className={`fa-solid ${summary.icon} mr-1`} />
              {summary.text}
            </p>
          </div>
        </div>
      </motion.div>

      <PersonaMemoryCard persona={persona} />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass p-3 mb-4 flex items-start gap-2"
        style={{ borderColor: 'rgba(59,130,246,0.22)' }}
      >
        <i className="fa-solid fa-shield-halved text-sm mt-0.5" style={{ color: 'var(--accent-blue)' }} />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          This is wellness insight from simulated data and wearable signals, not a medical diagnosis. Seek medical attention for severe symptoms.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass p-4 mb-4"
        style={{ borderColor: `${summary.color}35` }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: `${summary.color}18` }}>
              <i className={`fa-solid ${summary.icon} text-xl`} style={{ color: summary.color }} />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Health dashboard</p>
              <h3 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{summary.label}</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{summary.text}</p>
            </div>
          </div>
          <div className="text-right text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            <p><i className="fa-regular fa-clock mr-1" />Today</p>
            <p className="mt-1"><i className="fa-solid fa-database mr-1" />Mock wearable</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass p-4 mb-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <i className="fa-solid fa-moon text-xs" style={{ color: 'var(--accent-blue)' }} />
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>7-day Sleep Quality</p>
            </div>
            <p className="text-lg font-bold" style={{ color: sleepStatus.color }}>
              {metrics.sleep_hours} hrs/night
              <span className="text-xs ml-2 font-normal" style={{ color: 'var(--text-secondary)' }}>(Target 7-9 hrs)</span>
            </p>
          </div>
          <span className="text-xs px-2 py-1 rounded-full"
            style={{ background: `${sleepStatus.color}18`, color: sleepStatus.color }}>
            {metrics.sleep_quality}% quality
          </span>
        </div>
        <ResponsiveContainer width="100%" height={116}>
          <AreaChart data={sleep_chart}>
            <defs>
              <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={sleepStatus.color} stopOpacity={0.26} />
                <stop offset="95%" stopColor={sleepStatus.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 10]} hide />
            <ReferenceLine y={7} stroke="var(--border)" strokeDasharray="4 4" />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="hours" stroke={sleepStatus.color} strokeWidth={2.5} fill="url(#sleepGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <MiniMetric icon="fa-heart-pulse" title="Resting heart rate" value={metrics.heart_rate_avg} unit="bpm" target="60-100 bpm" kind="hr" delay={0.18} />
        <MiniMetric icon="fa-brain" title="Stress level" value={metrics.stress_level} unit="%" target="0-40%" kind="stress" delay={0.22} />
        <MiniMetric icon="fa-person-walking" title="Daily steps" value={metrics.steps_today} unit="steps" target="≥ 7,000" kind="steps" delay={0.26} />
        <MiniMetric icon="fa-chart-line" title="HRV" value={metrics.hrv} unit="ms" target="≥ 45 ms" kind="hrv" delay={0.3} />
        <MiniMetric icon="fa-weight-scale" title="BMI" value={metrics.bmi} unit="" target="18.5-24.9" kind="bmi" delay={0.34} />
        <MiniMetric icon="fa-triangle-exclamation" title="Risk signals" value={patterns.length} unit="" target="0" kind={patterns.length >= 4 ? 'stress' : 'sleep'} delay={0.38} />
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="glass p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Detected patterns</h3>
          <span className="text-xs" style={{ color: 'var(--accent-teal)' }}>How this works</span>
        </div>
        <div className="flex flex-col gap-2">
          {patterns.map((p, i) => {
            const status = p.level === 'risk' ? STATUS.risk : STATUS.watch;
            return (
              <div key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: status.color }} />
                <p className="text-xs leading-snug flex-1" style={{ color: 'var(--text-primary)' }}>{p.text}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: status.bg, color: status.color }}>
                  {p.level === 'risk' ? 'High' : 'Medium'}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
        className="glass p-4 mb-5">
        <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Personalized daily wellness plan</h3>
        <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>Tap a card to see your personalised steps.</p>
        <div className="grid grid-cols-2 gap-2">
          {plan.map(item => {
            const colors = PLAN_COLORS[item.title] ?? { accent: persona.avatar_color, bg: `${persona.avatar_color}18` };
            return (
              <button
                key={item.key}
                onClick={() => setActivePlan(item)}
                className="p-3 rounded-2xl text-left transition-transform active:scale-95"
                style={{ background: 'rgba(0,0,0,0.02)', border: `1px solid var(--border)` }}
              >
                <i className={`fa-solid ${item.icon} text-sm mb-2 block`} style={{ color: colors.accent }} />
                <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                <p className="text-[11px] leading-snug mt-1 line-clamp-3" style={{ color: 'var(--text-secondary)' }}>{item.summary}</p>
                <p className="text-[11px] font-semibold mt-2" style={{ color: colors.accent }}>{item.cta} →</p>
              </button>
            );
          })}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="flex flex-col items-center gap-3 pb-4">
        <button className="magic-btn" onClick={onAnalyze}>
          <span className="flex items-center justify-center gap-2">
            <i className="fa-solid fa-chart-simple" />
            AI Health Analysis & Insight
          </span>
        </button>

        <button
          onClick={onSleepEnv}
          className="w-full max-w-sm py-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
          style={{
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.22)',
            color: 'var(--accent-blue)',
          }}
        >
          <i className="fa-solid fa-moon" />
          Adjust Sleep Mood & Environment
        </button>
      </motion.div>

      <AnimatePresence>
        {activePlan && (
          <PlanDetailSheet
            item={activePlan}
            personaColor={persona.avatar_color}
            onClose={() => setActivePlan(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
