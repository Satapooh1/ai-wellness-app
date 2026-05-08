/**
 * Wellness Multi-Agent System — ใช้ @openai/agents SDK
 *
 * Architecture:
 *   WellnessCoordinator (triage)
 *     ├── SensorAnalystAgent  (วิเคราะห์ vitals → health_state)
 *     └── EnvironmentControllerAgent  (tools: set_light, set_sound, ...)
 */

import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod/v3';

const AGENT_MODEL = process.env.OPENAI_AGENT_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4o';

const SOUND_PROFILES = {
  rain: {
    volume: [24, 38], defaultVolume: 32, color: '#5ea8c8',
    bgFrom: '#07151b', bgTo: '#0b1d24', mood: 'Light rain reduces arousal',
  },
  ocean: {
    volume: [22, 36], defaultVolume: 30, color: '#4fb7d8',
    bgFrom: '#07151b', bgTo: '#0b1d24', mood: 'Ocean waves pace breathing',
  },
  forest: {
    volume: [18, 32], defaultVolume: 26, color: '#37c6a6',
    bgFrom: '#071714', bgTo: '#0b1f1b', mood: 'Nature sounds calm the body',
  },
  binaural: {
    volume: [12, 24], defaultVolume: 18, color: '#8b7cf6',
    bgFrom: '#0d1020', bgTo: '#14182b', mood: 'Deep tones for sleep onset',
  },
  deep_sleep: {
    volume: [8, 18], defaultVolume: 14, color: '#5b8def',
    bgFrom: '#07111f', bgTo: '#0a1426', mood: 'Maintain environment for deep sleep',
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function clampByTheme(theme, volume) {
  const profile = SOUND_PROFILES[theme] ?? SOUND_PROFILES.ocean;
  return Math.round(clamp(volume ?? profile.defaultVolume, profile.volume[0], profile.volume[1]));
}

function pickSafeTheme(vitals, requestedTheme) {
  if (requestedTheme && SOUND_PROFILES[requestedTheme]) return requestedTheme;
  if (vitals.stress > 70 || vitals.hr > 95) return 'rain';
  if (vitals.stress > 50 || vitals.hr > 80) return 'ocean';
  if (vitals.stress > 30 || vitals.hr > 68) return 'forest';
  if (vitals.stress > 15 || vitals.hr > 58) return 'binaural';
  return 'deep_sleep';
}

function normalizeToolCalls(toolCalls, vitals) {
  const byName = new Map((toolCalls ?? []).filter(tc => tc?.name).map(tc => [tc.name, tc]));
  const soundCall = byName.get('play_ambient_sound');
  const theme = pickSafeTheme(vitals, soundCall?.args?.theme);
  const profile = SOUND_PROFILES[theme];
  const volume = clampByTheme(theme, soundCall?.args?.volume);
  const intensity = clamp(volume / 220, 0.05, 0.22);
  const breathTarget = vitals.stress > 70 || vitals.hr > 95
    ? 6
    : vitals.stress > 50 || vitals.hr > 80
      ? 6.5
      : vitals.stress > 30 || vitals.hr > 68
        ? 6
        : theme === 'deep_sleep'
          ? 4.8
          : 5.5;
  const riskLevel = vitals.stress > 70 || vitals.hr > 95
    ? 'high'
    : vitals.stress > 50 || vitals.hr > 80
      ? 'moderate'
      : 'low';
  const wellnessScore = Math.round(clamp(100 - (vitals.stress * 0.45 + Math.max(0, vitals.hr - 55) * 0.45), 12, 94));

  return [
    {
      name: 'set_ambient_light',
      args: {
        ...(byName.get('set_ambient_light')?.args ?? {}),
        color_hex: profile.color,
        intensity,
        mood_label: profile.mood,
        bg_from: profile.bgFrom,
        bg_to: profile.bgTo,
      },
    },
    {
      name: 'play_ambient_sound',
      args: {
        ...(soundCall?.args ?? {}),
        theme,
        volume,
        reason: soundCall?.args?.reason ?? profile.mood,
      },
    },
    {
      name: 'set_breathing_guide',
      args: {
        ...(byName.get('set_breathing_guide')?.args ?? {}),
        breaths_per_minute: breathTarget,
        technique: vitals.stress > 50 ? 'Box Breathing 4-4-4-4' : 'Slow Natural Breathing',
      },
    },
    {
      name: 'log_health_summary',
      args: {
        ...(byName.get('log_health_summary')?.args ?? {}),
        risk_level: riskLevel,
        summary: byName.get('log_health_summary')?.args?.summary ?? profile.mood,
        wellness_score: wellnessScore,
      },
    },
  ];
}

// ─── Tool definitions (EnvironmentControllerAgent สามารถเรียกได้) ─────────────

const setAmbientLight = tool({
  name: 'set_ambient_light',
  description: 'Adjust bedroom lighting — color, intensity, and mood label',
  parameters: z.object({
    color_hex:  z.string().describe('Hex color e.g. #4a6fa5'),
    intensity:  z.number().min(0.05).max(0.22).describe('Sleep-safe brightness 0.05-0.22'),
    mood_label: z.string().describe('Mood description in English'),
    bg_from:    z.string().optional().describe('Background gradient start hex'),
    bg_to:      z.string().optional().describe('Background gradient end hex'),
  }),
  execute: async (p) => JSON.stringify({ success: true, applied: 'set_ambient_light', params: p }),
});

const playAmbientSound = tool({
  name: 'play_ambient_sound',
  description: 'Select and play ambient sound for relaxation',
  parameters: z.object({
    theme:  z.enum(['rain', 'ocean', 'forest', 'binaural', 'deep_sleep']),
    volume: z.number().min(8).max(38).describe('Sleep-safe volume %. rain 24-38, ocean 22-36, forest 18-32, binaural 12-24, deep_sleep 8-18'),
    reason: z.string().describe('Reason for choosing this sound in English'),
  }),
  execute: async (p) => JSON.stringify({ success: true, applied: 'play_ambient_sound', playing: p.theme, volume: p.volume }),
});

const setBreathingGuide = tool({
  name: 'set_breathing_guide',
  description: 'Set breathing guide rate to reduce stress',
  parameters: z.object({
    breaths_per_minute: z.number().min(4.5).max(7),
    technique: z.string().describe('Technique e.g. 4-7-8, Box Breathing, Natural'),
  }),
  execute: async (p) => JSON.stringify({ success: true, applied: 'set_breathing_guide', params: p }),
});

const logHealthSummary = tool({
  name: 'log_health_summary',
  description: 'Log short health summary and advice for the user',
  parameters: z.object({
    risk_level:     z.enum(['low', 'moderate', 'high', 'critical']),
    summary:        z.string().describe('Status summary 1-2 sentences in English'),
    wellness_score: z.number().min(0).max(100),
  }),
  execute: async (p) => JSON.stringify({ success: true, applied: 'log_health_summary', params: p }),
});

// ─── Single Environment Agent (no handoffs = no loop risk) ───────────────────

function buildFallbackResult(vitals) {
  let state;

  if (vitals.stress > 70 || vitals.hr > 95) {
    state = {
      color: '#ff6b6b', bgFrom: '#1a0202', bgTo: '#2a0505',
      sound: 'rain', volume: 50, breathRate: 7,
      technique: '4-7-8 Breathing', risk: 'high', score: 18,
      summary: 'High stress and elevated heart rate detected',
      intervention: 'Urgent calming environment',
    };
  } else if (vitals.stress > 50 || vitals.hr > 80) {
    state = {
      color: '#4fb7d8', bgFrom: '#07151b', bgTo: '#0b1d24',
      sound: 'ocean', volume: 42, breathRate: 8,
      technique: 'Box Breathing 4-4-4-4', risk: 'moderate', score: 35,
      summary: 'Stress response is moderately elevated',
      intervention: 'Ocean sound with slower guided breathing',
    };
  } else if (vitals.stress > 30 || vitals.hr > 68) {
    state = {
      color: '#00d4aa', bgFrom: '#001a10', bgTo: '#002d1a',
      sound: 'forest', volume: 36, breathRate: 7,
      technique: 'Slow Natural Breathing', risk: 'low', score: 58,
      summary: 'Body is settling but not fully sleep-ready',
      intervention: 'Forest sound and calm green lighting',
    };
  } else if (vitals.stress > 15 || vitals.hr > 58) {
    state = {
      color: '#7c5cbf', bgFrom: '#0a0515', bgTo: '#120920',
      sound: 'binaural', volume: 30, breathRate: 5.5,
      technique: '4-7-8 Breathing', risk: 'low', score: 76,
      summary: 'Body is entering a relaxed state',
      intervention: 'Binaural ambience for deeper relaxation',
    };
  } else {
    state = {
      color: '#3d7fff', bgFrom: '#020818', bgTo: '#040f2a',
      sound: 'deep_sleep', volume: 22, breathRate: 4.5,
      technique: 'Natural Sleep Breathing', risk: 'low', score: 91,
      summary: 'Body is ready for deep sleep',
      intervention: 'Deep sleep mode',
    };
  }

  const toolCalls = [
    {
      name: 'set_ambient_light',
      args: {
        color_hex: state.color,
        intensity: state.volume / 500,
        mood_label: state.intervention,
        bg_from: state.bgFrom,
        bg_to: state.bgTo,
      },
    },
    {
      name: 'play_ambient_sound',
      args: {
        theme: state.sound,
        volume: state.volume,
        reason: state.summary,
      },
    },
    {
      name: 'set_breathing_guide',
      args: {
        breaths_per_minute: state.breathRate,
        technique: state.technique,
      },
    },
    {
      name: 'log_health_summary',
      args: {
        risk_level: state.risk,
        summary: `${state.summary} - ${state.intervention}`,
        wellness_score: state.score,
      },
    },
  ];

  return {
    finalOutput: `Demo fallback: ${state.summary}. ${state.intervention}.`,
    toolCalls,
    agentTrace: [
      { type: 'fallback_item', agent: 'LocalFallbackAgent', name: 'quota_fallback' },
    ],
    isMock: true,
    mockReason: 'OpenAI quota exceeded; using local demo rules',
  };
}

function parseMaybeJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;

  const text = String(value);
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function extractToolCall(item) {
  const raw = item.rawItem ?? item.raw_item ?? item;
  const name = item.name
    ?? item.toolName
    ?? item.tool_name
    ?? item.function?.name
    ?? raw.name
    ?? raw.toolName
    ?? raw.tool_name
    ?? raw.function?.name;

  const argsRaw = item.arguments
    ?? item.args
    ?? item.function?.arguments
    ?? raw.arguments
    ?? raw.args
    ?? raw.function?.arguments;

  const args = parseMaybeJson(argsRaw) ?? {};
  return name ? { name, args } : null;
}

const environmentAgent = new Agent({
  name: 'WellnessEnvironmentAgent',
  model: AGENT_MODEL,
  modelSettings: {
    toolChoice: 'required',
    parallelToolCalls: true,
    temperature: 0.2,
  },
  instructions: `You are an AI Wellness & Sleep Environment Controller.
  
Analyze Sensor data and adjust the environment immediately by calling **all tools simultaneously**:
1. set_ambient_light — select hex color and appropriate intensity
2. play_ambient_sound — select sound theme (rain/ocean/forest/binaural/deep_sleep)
3. set_breathing_guide — set breaths per minute and technique
4. log_health_summary — summarize risk level and wellness score

Selection Rules:
- Stress > 70% or HR > 95 → rain, red-orange color, breathing 7/min, risk: high
- Stress > 50% or HR > 80 → ocean, orange-yellow color, breathing 8/min, risk: moderate  
- Stress > 30% or HR > 68 → forest, green color, breathing 7/min, risk: low
- Stress > 15% or HR > 58 → binaural, purple color, breathing 6/min, risk: low
- Below that → deep_sleep, blue color, breathing 5/min, risk: low

Call tools immediately without asking further questions. Respond in English.`,
  tools: [setAmbientLight, playAmbientSound, setBreathingGuide, logHealthSummary],
});

// ─── Main function ────────────────────────────────────────────────────────────

export async function runWellnessAgents(vitals, persona) {
  const memoryContext = `Agent memory: ${(persona.agent_memory ?? []).join(' | ') || 'none'}
Known patterns: ${(persona.known_patterns ?? []).join(', ') || 'none'}
Preferred intervention: ${JSON.stringify(persona.preferred_intervention ?? {})}`;
  const prompt = `Adjust bedroom environment for: ${persona.name} (Age ${persona.age}, ${persona.occupation})

History and Symptoms (Context):
- Background: ${persona.bio || 'No data'}
- Symptoms: ${persona.symptoms?.join(', ') || 'None'}
- Goals: ${persona.goals?.join(', ') || 'General rest'}
${memoryContext}

Current Sensor Data (Vitals):
- Heart Rate: ${vitals.hr} bpm
- Breathing Rate: ${vitals.breath} breaths/min
- Stress Level: ${vitals.stress}%
- SpO2: ${vitals.spo2}%
- HRV: ${vitals.hrv} ms

Sleep-smart-home policy:
- Use calm sleep-safe settings, not warning-mode settings.
- Light intensity must be 0.05-0.22.
- Speaker volume ranges: rain 24-38, ocean 22-36, forest 18-32, binaural 12-24, deep_sleep 8-18.
- Breathing target must be 4.5-7 breaths/minute.
- Prefer teal/blue/green/violet tones. Avoid bright orange (#FFA500) and high intensity.
- If the user is improving, maintain the environment or reduce stimulation.
- Status summary must be short and suitable for a mobile decision log.

Please call all 4 tools to immediately adjust the environment based on current Vitals and user goals.`;

  console.log('[Agents] 🚀 Starting WellnessEnvironmentAgent...');
  const t0 = Date.now();

  let result;
  try {
    result = await run(environmentAgent, prompt, { maxTurns: 10 });
  } catch (err) {
    const isQuotaError = err.status === 429
      || err.code === 'insufficient_quota'
      || err.message?.includes('quota')
      || err.message?.includes('billing');
    const isConnectionError = err.constructor?.name === 'APIConnectionError'
      || err.message?.includes('Connection error')
      || err.message?.includes('fetch failed');

    if (isQuotaError || isConnectionError) {
      console.warn('[Agents] OpenAI unavailable; using local fallback result');
      return {
        ...buildFallbackResult(vitals),
        toolCalls: normalizeToolCalls(buildFallbackResult(vitals).toolCalls, vitals),
      };
    }

    throw err;
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[Agents] ⏱ Done in ${elapsed}s — ${result.newItems?.length ?? 0} items`);

  // ── Log every item in the trace ──
  const toolCalls = [];
  for (const [i, item] of (result.newItems ?? []).entries()) {
    const agent = item.agent?.name ?? '?';
    switch (item.type) {
      case 'tool_call_item':
        try {
          const args = JSON.parse(item.arguments ?? '{}');
          console.log(`[Agents] [${i}] 🔧 ${agent} → ${item.name}(${JSON.stringify(args).slice(0, 100)})`);
          toolCalls.push({ name: item.name, args });
        } catch (_) {
          console.log(`[Agents] [${i}] 🔧 ${agent} → ${item.name}(...parse error)`);
        }
        break;
      case 'tool_call_output_item':
        console.log(`[Agents] [${i}] ✔ ${String(item.output).slice(0, 80)}`);
        break;
      case 'message_output_item':
        console.log(`[Agents] [${i}] 💬 ${agent}: ${item.content?.[0]?.text?.slice(0, 120) ?? '...'}`);
        break;
      default:
        if (item.type !== 'agent_updated_stream_event') {
          console.log(`[Agents] [${i}] [${item.type}] ${agent}`);
        }
    }
  }

  console.log(`[Agents] 📦 Tool calls: ${toolCalls.length}`);

  const normalizedToolCalls = toolCalls.filter(tc => tc?.name);
  if (normalizedToolCalls.length !== toolCalls.length) {
    const seen = new Set(normalizedToolCalls.map(tc => `${tc.name}:${JSON.stringify(tc.args)}`));
    for (const [i, item] of (result.newItems ?? []).entries()) {
      if (item.type !== 'tool_call_item') continue;
      const toolCall = extractToolCall(item);
      if (!toolCall) continue;
      const key = `${toolCall.name}:${JSON.stringify(toolCall.args)}`;
      if (!seen.has(key)) {
        console.log(`[Agents] [${i}] recovered tool -> ${toolCall.name}(${JSON.stringify(toolCall.args).slice(0, 100)})`);
        normalizedToolCalls.push(toolCall);
        seen.add(key);
      }
    }
  }

  const finalToolCalls = normalizedToolCalls.length > 0
    ? normalizedToolCalls
    : buildFallbackResult(vitals).toolCalls;
  const requiredToolNames = [
    'set_ambient_light',
    'play_ambient_sound',
    'set_breathing_guide',
    'log_health_summary',
  ];
  const hasCompleteEnvironmentPlan = requiredToolNames.every(name =>
    finalToolCalls.some(tc => tc?.name === name)
  );
  const safeFallback = hasCompleteEnvironmentPlan ? null : buildFallbackResult(vitals);
  const safeToolCalls = normalizeToolCalls(safeFallback?.toolCalls ?? finalToolCalls, vitals);

  return {
    finalOutput: result.finalOutput ?? '',
    toolCalls: safeToolCalls,
    agentTrace: (result.newItems ?? []).map(i => ({
      type:  i.type,
      agent: i.agent?.name ?? 'unknown',
      name:  i.name,
    })),
    isMock: !!safeFallback,
    mockReason: safeFallback?.mockReason,
  };
}
