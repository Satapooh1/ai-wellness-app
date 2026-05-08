import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const AGENT_STEPS = [
  { delay: 0,    faIcon: 'fa-magnifying-glass', text: 'Reading Wearable data...',         tool: null },
  { delay: 600,  faIcon: 'fa-brain',            text: 'Analyzing Sleep Pattern & HRV...',    tool: 'analyze_health_data()' },
  { delay: 1300, faIcon: 'fa-book-medical',     text: 'Searching medical guidelines...',              tool: 'search_medical_guidelines()' },
  { delay: 2000, faIcon: 'fa-house',            text: 'Preparing to adjust environment...',           tool: 'set_smart_environment()' },
  { delay: 2700, faIcon: 'fa-calendar-check',  text: 'Scheduling wellness activities...',           tool: 'schedule_wellness_activity()' },
  { delay: 3200, faIcon: 'fa-pen-to-square',   text: 'Saving results to user profile...',         tool: 'update_user_profile()' },
];

export default function AIAnalysis({ persona }) {
  const [visibleSteps, setVisibleSteps] = useState([]);

  useEffect(() => {
    AGENT_STEPS.forEach((step, i) => {
      setTimeout(() => {
        setVisibleSteps(prev => [...prev, i]);
      }, step.delay);
    });
  }, []);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8">
      {/* Orbiting rings */}
      <div className="relative flex items-center justify-center mb-8" style={{ width: 160, height: 160 }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0 rounded-full"
          style={{ border: '2px solid rgba(16,185,129,0.18)' }}
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          className="absolute rounded-full"
          style={{ inset: 16, border: '1px solid rgba(59,130,246,0.16)' }}
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.16), rgba(59,130,246,0.12))',
            border: '1px solid rgba(16,185,129,0.18)',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          <i className="fa-solid fa-dna text-3xl" style={{ color: 'var(--accent-teal)' }} />
        </motion.div>

        {/* Orbiting dot */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0"
        >
          <div className="absolute w-3 h-3 rounded-full"
            style={{
              top: '50%', left: '100%',
              transform: 'translate(-50%, -50%)',
              background: 'var(--accent-teal)',
              boxShadow: '0 0 10px rgba(16,185,129,0.45)',
            }}
          />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          AI is analyzing your health
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {persona.name} · Processing...
        </p>
      </motion.div>

      {/* Agent Function Call Log */}
      <div className="w-full max-w-sm glass p-4">
        <p className="text-xs font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
          <i className="fa-solid fa-circle text-xs" style={{ color: 'var(--accent-teal)' }} />
          Agent Function Call Log
        </p>
        <div className="space-y-2">
          {AGENT_STEPS.map((step, i) => (
            visibleSteps.includes(i) && (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-start gap-2"
              >
                <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <i className={`fa-solid ${step.faIcon} text-xs`} style={{ color: 'var(--accent-teal)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs" style={{ color: 'var(--text-primary)' }}>{step.text}</p>
                  {step.tool && (
                    <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--accent-teal)' }}>
                      → {step.tool}
                    </p>
                  )}
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex-shrink-0 mt-0.5"
                >
                  {i === visibleSteps[visibleSteps.length - 1] && visibleSteps.length < AGENT_STEPS.length ? (
                    <i className="fa-solid fa-spinner fa-spin text-xs" style={{ color: 'var(--accent-teal)' }} />
                  ) : (
                    <i className="fa-solid fa-circle-check text-xs" style={{ color: 'var(--accent-teal)' }} />
                  )}
                </motion.div>
              </motion.div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}
