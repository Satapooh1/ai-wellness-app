import { motion } from 'framer-motion';
import personas from '../data/personas.json';

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.42, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const RISK_LABELS = {
  burnout: { label: 'Burnout risk', color: 'var(--accent-coral)', icon: 'fa-fire' },
  chronic: { label: 'Metabolic risk', color: 'var(--accent-amber)', icon: 'fa-triangle-exclamation' },
  overtrained: { label: 'Recovery debt', color: 'var(--accent-teal)', icon: 'fa-bolt' },
  insomnia: { label: 'Sleep fragmentation', color: '#8b5cf6', icon: 'fa-moon' },
  new_parent: { label: 'Interrupted recovery', color: 'var(--accent-blue)', icon: 'fa-baby' },
};

export default function WelcomeScreen({ onSelectPersona }) {
  return (
    <div className="min-h-dvh flex flex-col px-4 py-7 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-[300px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(16,185,129,0.08) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(59,130,246,0.06) 0%, transparent 70%)' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-5 relative z-10"
      >
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))' }}>
            <i className="fa-solid fa-dna text-white text-base" />
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--accent-teal)' }}>AI Wellness Companion</span>
        </div>

        <h1 className="text-3xl font-bold mb-3 leading-tight" style={{ color: 'var(--text-primary)' }}>
          Personal health AI
          <br />
          <span style={{ background: 'linear-gradient(90deg, var(--accent-teal), var(--accent-blue))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            that remembers context
          </span>
        </h1>
        <p className="text-sm leading-relaxed max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Choose a realistic health persona. The agent remembers their patterns,
          explains its reasoning, and adjusts a simulated smart bedroom.
        </p>

        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {[
            { icon: 'fa-bed', label: 'Sleep signals' },
            { icon: 'fa-heart-pulse', label: 'Wearable data' },
            { icon: 'fa-database', label: 'Agent memory' },
            { icon: 'fa-house', label: 'Smart home' },
          ].map((f) => (
            <span key={f.icon} className="text-xs px-3 py-1 rounded-full flex items-center gap-1.5"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: 'var(--accent-teal)' }}>
              <i className={`fa-solid ${f.icon} text-xs`} />
              {f.label}
            </span>
          ))}
        </div>
      </motion.div>

      <div className="relative z-10">
        <p className="text-center text-sm mb-3 font-medium" style={{ color: 'var(--text-secondary)' }}>
          Select a persona to see personalized agent behavior
        </p>

        <div className="flex flex-col gap-3 max-w-sm mx-auto">
          {personas.map((persona, i) => {
            const risk = RISK_LABELS[persona.id] || { label: 'Stable', color: 'var(--text-muted)', icon: 'fa-user' };
            return (
              <motion.button
                key={persona.id}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => onSelectPersona(persona)}
                className="glass text-left p-4 w-full cursor-pointer transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0"
                    style={{ border: `2px solid ${persona.avatar_color}40` }}>
                    {persona.image
                      ? <img src={persona.image} alt={persona.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"
                          style={{ background: `${persona.avatar_color}20` }}>
                          <i className={`fa-solid ${persona.fa_icon} text-xl`} style={{ color: persona.avatar_color }} />
                        </div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-semibold text-sm block truncate" style={{ color: 'var(--text-primary)' }}>
                          {persona.display_name ?? persona.name}
                        </span>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          {persona.subtitle} · age {persona.age}
                        </p>
                      </div>
                      <i className="fa-solid fa-chevron-right text-xs mt-1" style={{ color: persona.avatar_color }} />
                    </div>

                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: risk.color }} />
                      <i className={`fa-solid ${risk.icon} text-xs`} style={{ color: risk.color }} />
                      <span className="text-xs" style={{ color: risk.color }}>{risk.label}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 text-left">
                  <p className="text-[11px] leading-relaxed mb-2 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                    {persona.headline}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {persona.known_patterns?.slice(0, 3).map((pattern) => (
                      <span key={pattern} className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--text-secondary)' }}>
                        {pattern}
                      </span>
                    ))}
                  </div>
                  <div className="rounded-xl p-2"
                    style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
                    <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--accent-teal)' }}>
                      <i className="fa-solid fa-database mr-1" />Agent remembers
                    </p>
                    <p className="text-[10px] leading-snug line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                      {persona.agent_memory?.[0]}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-center text-xs mt-6 relative z-10"
        style={{ color: 'var(--text-muted)' }}
      >
        <i className="fa-solid fa-circle-info mr-1" />
        Prototype uses realistic mock profiles and simulated smart-home actions.
      </motion.p>
    </div>
  );
}
