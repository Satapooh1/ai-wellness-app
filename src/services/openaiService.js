const AGENT_SERVER = import.meta.env.VITE_AGENT_SERVER ?? '';  // blank = relative /api/... (Vercel)

function fallbackInsight(persona, reason = 'Health analysis server unavailable') {
  const m = persona.metrics;
  const impact = Math.min(
    96,
    28
      + (m.sleep_hours < 6 ? 18 : 0)
      + (m.stress_level >= 70 ? 20 : m.stress_level >= 55 ? 12 : 0)
      + (m.hrv < 30 ? 16 : m.hrv < 40 ? 10 : 0)
      + (m.steps_today < 3000 ? 12 : m.steps_today < 6000 ? 6 : 0)
      + (m.heart_rate_avg >= 85 ? 12 : 0)
      + (m.bmi >= 27 ? 10 : 0)
  );

  const riskLevel = impact >= 78 ? 'critical' : impact >= 62 ? 'high' : impact >= 42 ? 'moderate' : 'low';
  const headline = riskLevel === 'critical'
    ? 'Body under high strain, reduce load today'
    : riskLevel === 'high'
      ? 'Risks found that need management within 24 hours'
      : riskLevel === 'moderate'
        ? 'Signs of fatigue detected, adjust behavior today'
        : 'Overall well controlled, maintain rest rhythms';

  return {
    ok: true,
    isMock: true,
    mockReason: reason,
    risk_level: riskLevel,
    impact_score: impact,
    confidence: 74,
    headline,
    risks: `${headline}\nKey points: Slept ${m.sleep_hours} hrs, stress ${m.stress_level}%, HRV ${m.hrv} ms, and walked ${m.steps_today.toLocaleString()} steps, which collectively reflect strain on the body's recovery system.`,
    advice: 'Focus on 3 things today: reduce pre-sleep stimulus, add light post-meal movement, and do 5 minutes of breathing to reduce sympathetic load',
    top_signals: [
      {
        label: 'Sleep',
        value: `${m.sleep_hours} hrs / quality ${m.sleep_quality}%`,
        severity: m.sleep_hours < 5 ? 'critical' : m.sleep_hours < 6.5 ? 'risk' : 'good',
        why: m.sleep_hours < 6.5 ? 'Sleep time below 7-9 hr target, reducing recovery' : 'Sleep time near target',
      },
      {
        label: 'Stress',
        value: `${m.stress_level}%`,
        severity: m.stress_level >= 75 ? 'critical' : m.stress_level >= 55 ? 'risk' : 'watch',
        why: m.stress_level >= 55 ? 'Stress level high enough to disrupt sleep and HRV' : 'Should be monitored alongside HRV',
      },
      {
        label: 'HRV',
        value: `${m.hrv} ms`,
        severity: m.hrv < 25 ? 'critical' : m.hrv < 40 ? 'risk' : 'good',
        why: m.hrv < 40 ? 'Low HRV indicates nervous system is still in stress-response mode' : 'HRV is in a range where the body recovers better',
      },
      {
        label: 'Activity',
        value: `${m.steps_today.toLocaleString()} steps`,
        severity: m.steps_today < 3000 ? 'risk' : m.steps_today < 6000 ? 'watch' : 'good',
        why: m.steps_today < 6000 ? 'Low activity can worsen sleep quality and metabolic health' : 'Activity level supports overall health',
      },
    ],
    action_plan: [
      {
        title: 'Tonight',
        today: 'Turn off screens/heavy work 45 mins before bed and sleep at regular time',
        why: 'Helps the body enter rest mode and increases sleep quality',
      },
      {
        title: 'After Dinner',
        today: 'Light walk for 12-15 minutes',
        why: 'Aids glucose control, reduces tension, and increases pre-sleep readiness',
      },
      {
        title: 'Before Bed',
        today: 'Do 4-7-8 or box breathing for 5 minutes',
        why: 'Helps lower heart rate and increase parasympathetic tone',
      },
    ],
    smart_home_action: {
      action_type: 'sleep_recovery_mode',
      description: 'Adjust lighting to reduce stimulation, play soft ambient sound, and set breathing guide to transition body to rest mode',
    },
    red_flags: [
      'Seek immediate medical attention if experiencing chest pain, shortness of breath, dizziness, or severe palpitations',
      'This advice is insight from wearable data, not a medical diagnosis',
    ],
  };
}

export async function analyzeHealth(persona) {
  try {
    const res = await fetch(`${AGENT_SERVER}/api/health-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error ?? `Health analysis server HTTP ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Health analysis agent unavailable, falling back to mock:', error);
    await new Promise(r => setTimeout(r, 900));
    return fallbackInsight(persona);
  }
}
