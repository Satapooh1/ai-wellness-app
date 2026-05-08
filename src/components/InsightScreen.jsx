import { motion } from 'framer-motion';

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { delay: 0.2 + i * 0.18, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }
  }),
};

function InsightCard({ faIcon, title, content, color, index }) {
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="glass p-4 relative overflow-hidden transition-all hover:shadow-md"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      {/* Subtle background glow */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-10 pointer-events-none" style={{ background: color }} />
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: `${color}20` }}>
          <i className={`fa-solid ${faIcon}`} style={{ color, fontSize: '0.9rem' }} />
        </div>
        <h3 className="font-semibold text-sm" style={{ color }}>{title}</h3>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>
        {content}
      </p>
    </motion.div>
  );
}

function StatBadge({ faIcon, label, value, unit, color }) {
  return (
    <div className="flex flex-col items-center gap-1 py-3.5 px-2 rounded-2xl relative overflow-hidden transition-transform hover:-translate-y-0.5"
      style={{ background: `linear-gradient(145deg, ${color}12, transparent)`, border: `1px solid ${color}25` }}>
      <i className={`fa-solid ${faIcon} text-sm mb-0.5`} style={{ color }} />
      <span className="text-lg font-black tabular-nums tracking-tight" style={{ color }}>{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80" style={{ color: `${color}` }}>{unit}</span>
      <span className="text-xs text-center leading-tight font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  );
}

const severityColors = {
  good: 'var(--accent-teal)',
  watch: 'var(--accent-amber)',
  risk: '#f97316',
  critical: 'var(--accent-coral)',
};

const riskLabels = {
  low: 'Low',
  moderate: 'Watch',
  high: 'High',
  critical: 'Critical',
};

function ImpactPanel({ insight }) {
  const score = insight.impact_score ?? 50;
  const riskColor = severityColors[insight.risk_level === 'low' ? 'good' : insight.risk_level === 'moderate' ? 'watch' : insight.risk_level === 'high' ? 'risk' : 'critical'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="glass p-5 mb-5 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow"
      style={{ border: `1px solid ${riskColor}35` }}
    >
      {/* Ambient glow in the corner */}
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl opacity-15 pointer-events-none" style={{ background: riskColor }} />
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: riskColor }}>
            {insight.isMock ? 'Demo Insight' : 'Real Health Agent'}
          </p>
          <h2 className="text-base font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
            {insight.headline ?? 'Health impact insight'}
          </h2>
        </div>
        <div className="text-right z-10 relative">
          <p className="text-4xl font-black tabular-nums leading-none" style={{ color: riskColor, textShadow: `0 2px 10px ${riskColor}40` }}>{score}</p>
          <p className="text-xs font-semibold uppercase tracking-wider mt-1" style={{ color: 'var(--text-secondary)' }}>impact</p>
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(0,0,0,0.06)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ delay: 0.25, duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, var(--accent-teal), var(--accent-amber), ${riskColor})` }}
        />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs px-2 py-1 rounded-full" style={{ background: `${riskColor}20`, color: riskColor }}>
          Risk: {riskLabels[insight.risk_level] ?? insight.risk_level}
        </span>
        {typeof insight.confidence === 'number' && (
          <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--text-secondary)' }}>
            Confidence {insight.confidence}%
          </span>
        )}
        {insight.mockReason && (
          <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--accent-amber)' }}>
            {insight.mockReason}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function SignalGrid({ signals = [] }) {
  if (!signals.length) return null;

  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      {signals.map((signal, i) => {
        const color = severityColors[signal.severity] ?? 'var(--text-secondary)';
        return (
          <motion.div
            key={`${signal.label}-${i}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + i * 0.06 }}
            className="glass p-4 relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{ borderColor: `${color}28` }}
          >
            <div className="absolute bottom-0 right-0 w-16 h-16 rounded-tl-full opacity-5 pointer-events-none" style={{ background: color }} />
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-xs font-semibold" style={{ color }}>{signal.label}</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>
                {signal.severity}
              </span>
            </div>
            <p className="text-lg font-black tabular-nums" style={{ color }}>{signal.value}</p>
            <p className="text-xs leading-snug mt-1" style={{ color: 'var(--text-secondary)' }}>{signal.why}</p>
          </motion.div>
        );
      })}
    </div>
  );
}

function ActionPlan({ items = [] }) {
  if (!items.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55 }}
      className="glass p-5 mb-5 relative overflow-hidden shadow-sm"
      style={{ borderLeft: '3px solid var(--accent-teal)' }}
    >
      <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-10 pointer-events-none" style={{ background: 'var(--accent-teal)' }} />
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.14)' }}>
          <i className="fa-solid fa-calendar-check text-sm" style={{ color: 'var(--accent-teal)' }} />
        </div>
        <h3 className="font-semibold text-sm" style={{ color: 'var(--accent-teal)' }}>24-hour Action Plan</h3>
      </div>
      <div className="flex flex-col gap-3">
        {items.map((item, i) => (
          <div key={`${item.title}-${i}`} className="flex gap-3">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
              style={{ background: 'rgba(16,185,129,0.14)', color: 'var(--accent-teal)' }}>
              {i + 1}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.title}: {item.today}</p>
              <p className="text-xs leading-snug mt-0.5" style={{ color: 'var(--text-secondary)' }}>{item.why}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function InsightScreen({ persona, insight, onReset, onSleepEnv }) {
  return (
    <div className="min-h-dvh flex flex-col px-4 py-6 relative">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${persona.avatar_color}20`, border: `1px solid ${persona.avatar_color}30` }}>
            <i className={`fa-solid ${persona.fa_icon} text-lg`} style={{ color: persona.avatar_color }} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight" style={{ color: 'var(--text-primary)' }}>
              Health Analysis Results
            </h1>
            <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {persona.name} · {new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}
            </p>
          </div>
        </div>

        {/* Quick stats from persona metrics */}
        <div className="grid grid-cols-4 gap-2 mb-2">
          <StatBadge faIcon="fa-bed"         label="Sleep"   value={persona.metrics.sleep_hours} unit="hrs"  color="var(--accent-blue)" />
          <StatBadge faIcon="fa-heart-pulse" label="HR"    value={persona.metrics.heart_rate_avg} unit="bpm" color="var(--accent-coral)" />
          <StatBadge faIcon="fa-chart-line"  label="HRV"   value={persona.metrics.hrv}  unit="ms"  color="var(--accent-teal)" />
          <StatBadge faIcon="fa-brain"       label="Stress" value={persona.metrics.stress_level} unit="%" color="var(--accent-amber)" />
        </div>
      </motion.div>

      {/* AI Insight Cards — 3 cards: Risks / Advice / Recommended Actions */}
      <ImpactPanel insight={insight} />
      <SignalGrid signals={insight.top_signals} />

      <div className="flex flex-col gap-4 mb-6">
        <InsightCard
          index={0}
          faIcon="fa-triangle-exclamation"
          title="Detected Risks"
          content={insight.risks}
          color="var(--accent-coral)"
        />
        <InsightCard
          index={1}
          faIcon="fa-lightbulb"
          title="Personalized Daily Advice"
          content={insight.advice}
          color="var(--accent-teal)"
        />
        <InsightCard
          index={2}
          faIcon="fa-list-check"
          title="AI Recommended Actions"
          content={insight.smart_home_action.description}
          color="var(--accent-blue)"
        />
      </div>

      <ActionPlan items={insight.action_plan} />

      {insight.red_flags?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="glass p-3 mb-4"
          style={{ borderColor: 'var(--accent-coral)' }}
        >
          {insight.red_flags.map((flag, i) => (
            <p key={i} className="text-xs leading-relaxed" style={{ color: 'var(--accent-coral)' }}>
              <i className="fa-solid fa-triangle-exclamation mr-1.5" />
              {flag}
            </p>
          ))}
        </motion.div>
      )}

      {/* CTA: Go to Sleep Environment */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="glass p-4 mb-5 flex items-center gap-3 hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
        style={{ borderColor: 'rgba(59,130,246,0.3)' }}
        onClick={onSleepEnv}
      >
        <div className="absolute inset-0 opacity-5 pointer-events-none bg-gradient-to-r from-blue-500 to-teal-400" />
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(59,130,246,0.1)' }}>
          <i className="fa-solid fa-moon text-lg" style={{ color: 'var(--accent-blue)' }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--accent-blue)' }}>Adjust Sleep Environment</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Set Real-time Mood, Lighting, Sound, and Breathing</p>
        </div>
        <button
          onClick={onSleepEnv}
          className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 flex-shrink-0 transition-all z-10"
          style={{
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.22)',
            color: 'var(--accent-blue)',
          }}
        >
          Open
          <i className="fa-solid fa-chevron-right text-xs" />
        </button>
      </motion.div>

      {/* Back button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
      >
        <button
          onClick={onReset}
          className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:bg-gray-50"
          style={{
            background: 'rgba(0,0,0,0.04)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          <i className="fa-solid fa-arrow-left text-xs" />
          Try Another Profile
        </button>
      </motion.div>
    </div>
  );
}
