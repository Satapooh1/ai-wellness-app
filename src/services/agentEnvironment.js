/**
 * Environment Agent — Analyze sensor values and decide to adjust environment
 * Operates in Perceive → Think → Act loop
 */

// ── Rule Engine ────────────────────────────────────────────────────────────────
// Rules evaluated top-down — first matching rule is used
const RULES = [
  {
    id: 'critical_stress',
    condition: ({ stress, hr }) => stress > 70 || hr > 95,
    environment: {
      sound:      'rain',
      color:      '#ff6b6b',
      bgFrom:     '#1a0202',
      bgTo:       '#2a0505',
      breathTarget: 8,
      volume:     50,
      lightLabel: 'Soft orange 15%',
      moodLabel:  'Reduce arousal',
    },
    actions: [
      'set_smart_environment({ light: "warm-red", intensity: 0.15 })',
      'play_sound({ theme: "rain", volume: 0.5 })',
    ],
    reason: (v) => `High stress detected (${v.stress}%) HR ${v.hr} bpm → play rain sound and dim lights to reduce arousal`,
  },
  {
    id: 'high_stress',
    condition: ({ stress, hr }) => stress > 50 || hr > 80,
    environment: {
      sound:      'ocean',
      color:      '#4fb7d8',
      bgFrom:     '#07151b',
      bgTo:       '#0b1d24',
      breathTarget: 7,
      volume:     42,
      lightLabel: 'Warm yellow 20%',
      moodLabel:  'Relaxed',
    },
    actions: [
      'set_smart_environment({ light: "warm-amber", intensity: 0.2 })',
      'play_sound({ theme: "ocean", volume: 0.42 })',
    ],
    reason: (v) => `Moderate stress (${v.stress}%) HR ${v.hr} bpm → ocean waves pace breathing`,
  },
  {
    id: 'moderate',
    condition: ({ stress, hr, breath }) => stress > 30 || hr > 68 || breath > 10,
    environment: {
      sound:      'forest',
      color:      '#00d4aa',
      bgFrom:     '#001a10',
      bgTo:       '#002d1a',
      breathTarget: 6,
      volume:     36,
      lightLabel: 'Soft green 15%',
      moodLabel:  'Near relaxation',
    },
    actions: [
      'set_smart_environment({ light: "cool-green", intensity: 0.15 })',
      'play_sound({ theme: "forest", volume: 0.36 })',
      'schedule_wellness_activity({ type: "4-7-8 breathing", duration: 5 })',
    ],
    reason: (v) => `Starting to relax HR ${v.hr} bpm breath ${v.breath}/min → forest sound and cool light reduce Cortisol`,
  },
  {
    id: 'relaxed',
    condition: ({ stress, hr }) => stress > 15 || hr > 58,
    environment: {
      sound:      'binaural',
      color:      '#7c5cbf',
      bgFrom:     '#0a0515',
      bgTo:       '#120920',
      breathTarget: 5,
      volume:     30,
      lightLabel: 'Soft purple 10%',
      moodLabel:  'Binaural Theta',
    },
    actions: [
      'set_smart_environment({ light: "violet", intensity: 0.10 })',
      'play_sound({ theme: "binaural", freq_diff: 4, volume: 0.3 })',
    ],
    reason: (v) => `Well relaxed HR ${v.hr} bpm → Binaural 4Hz Theta stimulates deep relaxation`,
  },
  {
    id: 'deep_sleep_ready',
    condition: () => true,
    environment: {
      sound:      'deep_sleep',
      color:      '#3d7fff',
      bgFrom:     '#020818',
      bgTo:       '#040f2a',
      breathTarget: 4.5,
      volume:     22,
      lightLabel: 'Lights off / deep blue 5%',
      moodLabel:  'Ready for deep sleep',
    },
    actions: [
      'set_smart_environment({ light: "off", intensity: 0.05 })',
      'play_sound({ theme: "deep_sleep", volume: 0.22 })',
      'update_user_profile({ sleep_mode: "deep", start_time: now() })',
    ],
    reason: (v) => `Body ready — HR ${v.hr} bpm stress ${v.stress}% → entering Deep Sleep mode`,
  },
];

export function evaluate(vitals) {
  for (const rule of RULES) {
    if (rule.condition(vitals)) {
      return {
        ruleId:      rule.id,
        environment: rule.environment,
        actions:     rule.actions,
        reason:      rule.reason(vitals),
      };
    }
  }
  return null;
}

// wellness score 0-100
export function wellnessScore(vitals) {
  const bN = Math.max(0, Math.min(1, (vitals.breath - 4) / 16));
  const hN = Math.max(0, Math.min(1, (vitals.hr - 40) / 80));
  const sN = vitals.stress / 100;
  return Math.round((1 - (bN * 0.35 + hN * 0.40 + sN * 0.25)) * 100);
}
