import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TYPE_STYLE = {
  risk:  { dot: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
  watch: { dot: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
  good:  { dot: '#10b981', bg: 'rgba(16,185,129,0.10)' },
};

export default function AgentAlertScreen({ persona, onContinue }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const log = persona.agent_log ?? [];

  useEffect(() => {
    if (visibleCount >= log.length) return;
    const t = setTimeout(() => setVisibleCount(v => v + 1), 700);
    return () => clearTimeout(t);
  }, [visibleCount, log.length]);

  return (
    <div className="min-h-dvh flex flex-col px-5 py-8" style={{ background: 'var(--bg-primary)' }}>

      {/* header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="flex items-center gap-2 mb-4">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
              style={{ background: persona.avatar_color }} />
            <span className="relative inline-flex rounded-full h-3 w-3"
              style={{ background: persona.avatar_color }} />
          </span>
          <p className="text-xs font-semibold tracking-wide uppercase"
            style={{ color: persona.avatar_color }}>Agent active</p>
        </div>

        <h1 className="text-2xl font-black leading-tight mb-2" style={{ color: 'var(--text-primary)' }}>
          Your AI acted<br />while you slept
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {persona.display_name?.split(' - ')[0] ?? persona.name}'s agent monitored signals and
          adjusted the environment autonomously — no input needed.
        </p>
      </motion.div>

      {/* agent identity badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="flex items-center gap-3 p-3 rounded-2xl mb-6"
        style={{ background: `${persona.avatar_color}12`, border: `1px solid ${persona.avatar_color}30` }}
      >
        <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0"
          style={{ border: `1px solid ${persona.avatar_color}40` }}>
          {persona.image
            ? <img src={persona.image} alt={persona.name} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"
                style={{ background: `${persona.avatar_color}22` }}>
                <i className="fa-solid fa-robot text-sm" style={{ color: persona.avatar_color }} />
              </div>
          }
        </div>
        <div>
          <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
            Wellness Agent · {persona.name}
          </p>
          <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {log.length} autonomous actions · last night
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[10px] font-semibold px-2 py-1 rounded-full"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
            Completed
          </p>
        </div>
      </motion.div>

      {/* timeline */}
      <div className="flex-1 flex flex-col gap-3 mb-8">
        <AnimatePresence>
          {log.slice(0, visibleCount).map((entry, i) => {
            const s = TYPE_STYLE[entry.type] ?? TYPE_STYLE.watch;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
                className="flex gap-3"
              >
                {/* timeline spine */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                    style={{ background: s.dot }} />
                  {i < log.length - 1 && (
                    <div className="w-px flex-1 mt-1" style={{ background: 'var(--border)', minHeight: 20 }} />
                  )}
                </div>

                {/* content */}
                <div className="flex-1 pb-1">
                  <p className="text-[11px] font-bold mb-1" style={{ color: 'var(--text-muted)' }}>
                    {entry.time}
                  </p>
                  <div className="rounded-2xl p-3" style={{ background: s.bg, border: `1px solid ${s.dot}22` }}>
                    <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                      <i className="fa-solid fa-signal mr-1.5" style={{ color: s.dot }} />
                      {entry.signal}
                    </p>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                      <i className="fa-solid fa-bolt mr-1.5" style={{ color: s.dot }} />
                      {entry.action}
                    </p>
                    {entry.result && (
                      <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-secondary)' }}>
                        <i className="fa-solid fa-check mr-1" style={{ color: '#10b981' }} />
                        {entry.result}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* loading dots while entries still appearing */}
        {visibleCount < log.length && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1.5 pl-5"
          >
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--text-muted)' }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
              />
            ))}
          </motion.div>
        )}
      </div>

      {/* CTA — appears after all entries shown */}
      <AnimatePresence>
        {visibleCount >= log.length && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <button
              onClick={onContinue}
              className="w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${persona.avatar_color}, ${persona.avatar_color}cc)`,
                color: '#fff',
                boxShadow: `0 8px 24px ${persona.avatar_color}40`,
              }}
            >
              View your health dashboard
              <i className="fa-solid fa-arrow-right" />
            </button>
            <p className="text-center text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
              Agent memory updated · ready for today
            </p>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
