/**
 * Multi-Agent Sleep Environment System
 *
 * Tier 1: @openai/agents SDK (via local Express server on :3001)
 *   — uses Agent + run() + handoffs officially
 * Tier 2: Direct OpenAI fetch (Chat Completions + function calling)
 * Tier 3: Mock (offline demo)
 */

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const API_URL = 'https://api.openai.com/v1/chat/completions';
const AGENT_SERVER = import.meta.env.VITE_AGENT_SERVER ?? '';  // blank = relative /api/... (Vercel)
const ENABLE_DIRECT_OPENAI = import.meta.env.VITE_ENABLE_DIRECT_OPENAI === 'true';
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL ?? 'gpt-4o';

const SOUND_PROFILES = {
  rain: { volume: [24, 38], defaultVolume: 32, color: '#5ea8c8', bgFrom: '#07151b', bgTo: '#0b1d24' },
  ocean: { volume: [22, 36], defaultVolume: 30, color: '#4fb7d8', bgFrom: '#07151b', bgTo: '#0b1d24' },
  forest: { volume: [18, 32], defaultVolume: 26, color: '#37c6a6', bgFrom: '#071714', bgTo: '#0b1f1b' },
  binaural: { volume: [12, 24], defaultVolume: 18, color: '#8b7cf6', bgFrom: '#0d1020', bgTo: '#14182b' },
  deep_sleep: { volume: [8, 18], defaultVolume: 14, color: '#5b8def', bgFrom: '#07111f', bgTo: '#0a1426' },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function normalizeToolCalls(toolCalls) {
  const validToolCalls = (toolCalls ?? []).filter(tc => tc?.name);
  const soundCall = validToolCalls.find(tc => tc.name === 'play_ambient_sound');
  const theme = SOUND_PROFILES[soundCall?.args?.theme] ? soundCall.args.theme : 'ocean';
  const profile = SOUND_PROFILES[theme];
  const volume = Math.round(clamp(soundCall?.args?.volume ?? profile.defaultVolume, profile.volume[0], profile.volume[1]));
  const intensity = clamp(volume / 220, 0.05, 0.22);

  return validToolCalls.map(tc => {
    if (tc.name === 'play_ambient_sound') {
      return { ...tc, args: { ...tc.args, theme, volume } };
    }
    if (tc.name === 'set_ambient_light') {
      return {
        ...tc,
        args: {
          ...tc.args,
          color_hex: profile.color,
          intensity,
          bg_from: profile.bgFrom,
          bg_to: profile.bgTo,
        },
      };
    }
    if (tc.name === 'set_breathing_guide') {
      return {
        ...tc,
        args: {
          ...tc.args,
          breaths_per_minute: clamp(tc.args?.breaths_per_minute ?? 6, 4.5, 7),
        },
      };
    }
    return tc;
  });
}

// ─── Tier 1: Try local @openai/agents server ─────────────────────────────────
async function tryAgentServer(vitals, persona) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 60000); // 60s timeout

  try {
    const res = await fetch(`${AGENT_SERVER}/api/wellness-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vitals, persona }),
      signal: controller.signal,
    });

    clearTimeout(id);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error ?? `Server HTTP ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function chat(messages, tools = null, toolChoice = 'auto') {
  const body = {
    model: OPENAI_MODEL,
    messages,
    temperature: 0.3,
    max_tokens: 600,
  };
  if (tools) {
    body.tools = tools;
    body.tool_choice = toolChoice;
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const raw = err?.error?.message ?? `HTTP ${res.status}`;
    // Sanitize: remove project IDs, API key fragments, tokens
    const msg = raw
      .replace(/proj_[A-Za-z0-9]+/g, '[project]')
      .replace(/sk-[A-Za-z0-9-]+/g, '[key]')
      .replace(/org-[A-Za-z0-9]+/g, '[org]')
      .slice(0, 120);
    const e = new Error(msg);
    e.isQuota = res.status === 429 || raw.includes('quota') || raw.includes('billing') || raw.includes('exceeded');
    throw e;
  }

  return res.json();
}

// ─── Mock Agent — simulates realistic GPT-4o output when API is unavailable ────
function mockAgentCycle(vitals, persona) {
  // Decide state locally (same logic as agentEnvironment rules)
  let health_state, primary_concern, sleep_readiness, recommended_intervention;
  let lightColor, bgFrom, bgTo, sound, volume, breathRate, technique, riskLevel, wellnessScore;

  if (vitals.stress > 70 || vitals.hr > 95) {
    health_state = 'critical'; primary_concern = 'High stress level and HR exceeding threshold';
    sleep_readiness = 15; recommended_intervention = 'Urgent relaxation needed';
    lightColor = '#ff6b6b'; bgFrom = '#1a0202'; bgTo = '#2a0505';
    sound = 'rain'; volume = 50; breathRate = 7; technique = '4-7-8 Breathing';
    riskLevel = 'high'; wellnessScore = 18;
  } else if (vitals.stress > 50 || vitals.hr > 80) {
    health_state = 'stressed'; primary_concern = 'Sympathetic nervous system highly active';
    sleep_readiness = 32; recommended_intervention = 'Ocean sound + slow breathing';
    lightColor = '#4fb7d8'; bgFrom = '#07151b'; bgTo = '#0b1d24';
    sound = 'ocean'; volume = 42; breathRate = 8; technique = 'Box Breathing 4-4-4-4';
    riskLevel = 'moderate'; wellnessScore = 35;
  } else if (vitals.stress > 30 || vitals.hr > 68) {
    health_state = 'moderate'; primary_concern = 'Body relaxing, not yet ready for sleep';
    sleep_readiness = 55; recommended_intervention = 'Forest sound and slower breathing';
    lightColor = '#00d4aa'; bgFrom = '#001a10'; bgTo = '#002d1a';
    sound = 'forest'; volume = 36; breathRate = 7; technique = 'Slow Natural Breathing';
    riskLevel = 'low'; wellnessScore = 58;
  } else if (vitals.stress > 15 || vitals.hr > 58) {
    health_state = 'relaxed'; primary_concern = 'Entering Parasympathetic state';
    sleep_readiness = 74; recommended_intervention = 'Binaural Theta to enter Delta waves';
    lightColor = '#7c5cbf'; bgFrom = '#0a0515'; bgTo = '#120920';
    sound = 'binaural'; volume = 30; breathRate = 5.5; technique = '4-7-8 Breathing';
    riskLevel = 'low'; wellnessScore = 76;
  } else {
    health_state = 'deep_sleep_ready'; primary_concern = 'Body ready for deep sleep';
    sleep_readiness = 92; recommended_intervention = 'Deep Sleep mode';
    lightColor = '#3d7fff'; bgFrom = '#020818'; bgTo = '#040f2a';
    sound = 'deep_sleep'; volume = 22; breathRate = 4.5; technique = 'Natural Sleep Breathing';
    riskLevel = 'low'; wellnessScore = 91;
  }

  const healthState = {
    health_state, primary_concern, sleep_readiness,
    autonomic_balance: vitals.hr < 65 ? 'parasympathetic' : vitals.hr < 80 ? 'balanced' : 'sympathetic',
    recommended_intervention,
  };

  const toolCalls = [
    { name: 'set_ambient_light', args: { color_hex: lightColor, intensity: volume / 500, mood_label: recommended_intervention, bg_from: bgFrom, bg_to: bgTo } },
    { name: 'play_ambient_sound', args: { theme: sound, volume, reason: primary_concern } },
    { name: 'set_breathing_guide', args: { breaths_per_minute: breathRate, technique } },
    { name: 'log_health_summary', args: { risk_level: riskLevel, summary: `${primary_concern} — ${recommended_intervention}`, wellness_score: wellnessScore } },
  ];

  return { healthState, toolCalls };
}

// ─── Environment Tools (ที่ Agent สามารถเรียกได้) ────────────────────────────

export const ENV_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'set_ambient_light',
      description: 'Adjust bedroom lighting — color, intensity, and mood',
      parameters: {
        type: 'object',
        properties: {
          color_hex: { type: 'string', description: 'Hex color e.g. #4a6fa5' },
          intensity: { type: 'number', minimum: 0.05, maximum: 0.22, description: 'Sleep-safe brightness 0.05-0.22' },
          mood_label: { type: 'string', description: 'Mood description e.g. relaxed, ready to sleep' },
          bg_from: { type: 'string', description: 'Background gradient start color hex' },
          bg_to: { type: 'string', description: 'Background gradient end color hex' },
        },
        required: ['color_hex', 'intensity', 'mood_label'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'play_ambient_sound',
      description: 'Select and play ambient sound to enhance relaxation',
      parameters: {
        type: 'object',
        properties: {
          theme: { type: 'string', enum: ['rain', 'ocean', 'forest', 'binaural', 'deep_sleep'] },
          volume: { type: 'number', minimum: 8, maximum: 38, description: 'Sleep-safe volume percentage. rain 24-38, ocean 22-36, forest 18-32, binaural 12-24, deep_sleep 8-18' },
          reason: { type: 'string', description: 'Reason for choosing this sound' },
        },
        required: ['theme', 'volume', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_breathing_guide',
      description: 'Set breathing guide rate to reduce stress',
      parameters: {
        type: 'object',
        properties: {
          breaths_per_minute: { type: 'number', minimum: 4.5, maximum: 7 },
          technique: { type: 'string', description: 'Technique e.g. 4-7-8, Box Breathing, Natural' },
        },
        required: ['breaths_per_minute', 'technique'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_health_summary',
      description: 'Log short health summary and advice for the user',
      parameters: {
        type: 'object',
        properties: {
          risk_level: { type: 'string', enum: ['low', 'moderate', 'high', 'critical'] },
          summary: { type: 'string', description: 'Status summary 1-2 sentences (English)' },
          wellness_score: { type: 'number', minimum: 0, maximum: 100 },
        },
        required: ['risk_level', 'summary', 'wellness_score'],
      },
    },
  },
];

// ─── Agent 1: SensorAnalystAgent ─────────────────────────────────────────────

async function runSensorAnalyst(vitals, persona) {
  const messages = [
    {
      role: 'system',
      content: `You are an AI Health Analyst specializing in Wearable Sensor data analysis.
Analyze vital signs and output ONLY JSON.

Respond in JSON format as follows:
{
  "health_state": "relaxed|moderate|stressed|critical",
  "primary_concern": "Primary concern",
  "sleep_readiness": 0-100,
  "autonomic_balance": "parasympathetic|balanced|sympathetic",
  "recommended_intervention": "Brief explanation of recommended action"
}`,
    },
    {
      role: 'user',
      content: `Analyze Sensor data for ${persona.name} (${persona.occupation}):

History and Symptoms (Context):
- Background: ${persona.bio || 'No data'}
- Symptoms: ${persona.symptoms?.join(', ') || 'None'}
- Goals: ${persona.goals?.join(', ') || 'General rest'}
- Agent memory: ${persona.agent_memory?.join(' | ') || 'none'}
- Known patterns: ${persona.known_patterns?.join(', ') || 'none'}
- Preferred intervention: ${JSON.stringify(persona.preferred_intervention ?? {})}

Basic Info: Age ${persona.age}

Heart Rate: ${vitals.hr} bpm
Breathing Rate: ${vitals.breath} breaths/min
Stress Level: ${vitals.stress}%
SpO2: ${vitals.spo2}%
HRV: ${vitals.hrv} ms`,
    },
  ];

  const data = await chat(messages);
  const text = data.choices[0].message.content;

  try {
    // Extract JSON from response
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { health_state: 'moderate', primary_concern: 'Unable to analyze', sleep_readiness: 50, autonomic_balance: 'balanced', recommended_intervention: 'Check connection' };
  } catch {
    return { health_state: 'moderate', primary_concern: text.slice(0, 100), sleep_readiness: 50, autonomic_balance: 'balanced', recommended_intervention: text.slice(0, 100) };
  }
}

// ─── Agent 2: EnvironmentControllerAgent (Function Calling) ──────────────────

async function runEnvironmentController(vitals, healthState, persona) {
  const messages = [
    {
      role: 'system',
      content: `You are an AI Smart Home Environment Controller.
Your task is to adjust the bedroom environment to suit the user's health state.

You must call all of these tools:
1. set_ambient_light
2. play_ambient_sound
3. set_breathing_guide
4. log_health_summary

Use the provided health data to make appropriate decisions.`,
    },
    {
      role: 'user',
      content: `User: ${persona.name} (Age ${persona.age}, ${persona.occupation})

History and Symptoms (Context):
- Background: ${persona.bio || 'No data'}
- Symptoms: ${persona.symptoms?.join(', ') || 'None'}
- Goals: ${persona.goals?.join(', ') || 'General rest'}
- Agent memory: ${persona.agent_memory?.join(' | ') || 'none'}
- Known patterns: ${persona.known_patterns?.join(', ') || 'none'}
- Preferred intervention: ${JSON.stringify(persona.preferred_intervention ?? {})}

Analysis from SensorAnalyst:
${JSON.stringify(healthState, null, 2)}

Current Vitals:
HR: ${vitals.hr}, Breath: ${vitals.breath}, Stress: ${vitals.stress}%

Sleep-smart-home policy:
- Light intensity must be 0.05-0.22.
- Speaker volume ranges: rain 24-38, ocean 22-36, forest 18-32, binaural 12-24, deep_sleep 8-18.
- Breathing target must be 4.5-7 breaths/minute.
- Prefer teal/blue/green/violet tones. Avoid bright orange (#FFA500) and high intensity.
- If the user is improving, maintain the environment or reduce stimulation.
- Thai summary must be short and suitable for a mobile decision log.

Please call all 4 tools to immediately adjust the environment based on the user's goals and symptoms.`,
    },
  ];

  const toolCalls = [];
  let continueLoop = true;
  const currentMessages = [...messages];

  // Agentic loop — agent may call multiple tools
  while (continueLoop) {
    const data = await chat(currentMessages, ENV_TOOLS, 'auto');
    const choice = data.choices[0];
    const msg = choice.message;

    currentMessages.push(msg);

    if (choice.finish_reason === 'tool_calls' && msg.tool_calls?.length > 0) {
      for (const tc of msg.tool_calls) {
        const args = JSON.parse(tc.function.arguments);
        toolCalls.push({ name: tc.function.name, args, id: tc.id });

        // Return tool result (simulated execution)
        currentMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({ success: true, executed: tc.function.name, args }),
        });
      }
    } else {
      continueLoop = false;
    }

    // Safety: max 6 tool calls per run
    if (toolCalls.length >= 6) continueLoop = false;
  }

  return toolCalls;
}

// ─── Map tool calls → environment state ──────────────────────────────────────

const SOUND_COLOR_MAP = {
  rain: { color: '#5ea8c8', bgFrom: '#07151b', bgTo: '#0b1d24' },
  ocean: { color: '#4fb7d8', bgFrom: '#07151b', bgTo: '#0b1d24' },
  forest: { color: '#37c6a6', bgFrom: '#071714', bgTo: '#0b1f1b' },
  binaural: { color: '#8b7cf6', bgFrom: '#0d1020', bgTo: '#14182b' },
  deep_sleep: { color: '#5b8def', bgFrom: '#07111f', bgTo: '#0a1426' },
};

export function toolCallsToEnvironment(toolCalls) {
  const validToolCalls = normalizeToolCalls(toolCalls);
  const env = {
    color: '#8b8b9e', bgFrom: '#0a0a0f', bgTo: '#111118',
    moodLabel: '...', lightLabel: '...', sound: null,
    volume: 40, breathTarget: 10, technique: 'Natural',
    riskLevel: 'moderate', summary: '', wellnessScore: 50,
  };

  for (const tc of validToolCalls) {
    if (tc.name === 'set_ambient_light') {
      env.color = tc.args.color_hex ?? env.color;
      env.moodLabel = tc.args.mood_label ?? env.moodLabel;
      env.lightLabel = `ความสว่าง ${Math.round((tc.args.intensity ?? 0.2) * 100)}%`;
      if (tc.args.bg_from) env.bgFrom = tc.args.bg_from;
      if (tc.args.bg_to) env.bgTo = tc.args.bg_to;
    }
    if (tc.name === 'play_ambient_sound') {
      env.sound = tc.args.theme;
      env.volume = tc.args.volume ?? 40;
      const fallback = SOUND_COLOR_MAP[tc.args.theme];
      if (fallback && env.color === '#8b8b9e') env.color = fallback.color;
    }
    if (tc.name === 'set_breathing_guide') {
      env.breathTarget = tc.args.breaths_per_minute ?? 10;
      env.technique = tc.args.technique ?? 'Natural';
    }
    if (tc.name === 'log_health_summary') {
      env.riskLevel = tc.args.risk_level;
      env.summary = tc.args.summary;
      env.wellnessScore = tc.args.wellness_score;
    }
  }

  return env;
}

// ─── Main Orchestrator — 3-Tier Fallback ──────────────────────────────────────
//  Tier 1: @openai/agents SDK via local server (port 3001)
//  Tier 2: Direct OpenAI fetch (Chat Completions)
//  Tier 3: Mock (offline demo)

export async function runMultiAgentCycle(vitals, persona, onProgress) {

  // ── Tier 1: @openai/agents SDK server ──────────────────────────────────────
  try {
    onProgress?.({ phase: 'sdk', message: '🤖 @openai/agents SDK — Coordinating agents...' });
    const data = await tryAgentServer(vitals, persona);

    // Map server tool calls → environment
    const { toolCalls = [], agentTrace = [], finalOutput = '', isMock = false, mockReason } = data;
    const validToolCalls = normalizeToolCalls(toolCalls);
    const environment = toolCallsToEnvironment(validToolCalls);

    const logCall = validToolCalls.find(tc => tc.name === 'log_health_summary');
    const healthState = {
      health_state: logCall?.args?.risk_level ?? 'moderate',
      primary_concern: logCall?.args?.summary ?? finalOutput.slice(0, 80),
      sleep_readiness: logCall?.args?.wellness_score ?? 50,
      autonomic_balance: vitals.hr < 65 ? 'parasympathetic' : vitals.hr < 80 ? 'balanced' : 'sympathetic',
      recommended_intervention: finalOutput.slice(0, 120),
    };

    onProgress?.({ phase: 'done', message: `✅ SDK: ${agentTrace.length} agent steps, ${toolCalls.length} tool calls` });
    return { healthState, toolCalls: validToolCalls, environment, isMock, mockReason, tier: isMock ? 'server-fallback' : 'sdk' };

  } catch (sdkErr) {
    console.group('%c[Tier1 SDK] Failed', 'color:#ff6b6b;font-weight:bold');
    console.error('Message:', sdkErr.message);
    console.error('Full err:', sdkErr);
    console.groupEnd();
    onProgress?.({ phase: 'tier1_fail', message: `⚠️ SDK Server: ${sdkErr.message?.slice(0, 55)} — trying Tier 2...` });
  }

  // ── Tier 2: Direct API ──────────────────────────────────────────────────────
  if (API_KEY && ENABLE_DIRECT_OPENAI) {
    try {
      onProgress?.({ phase: 'analyst', message: '🔬 SensorAnalystAgent — analyzing vitals...' });
      const healthState = await runSensorAnalyst(vitals, persona);

      onProgress?.({ phase: 'controller', message: '🏠 EnvironmentControllerAgent — calling tools...' });
      const toolCalls = await runEnvironmentController(vitals, healthState, persona);

      const environment = toolCallsToEnvironment(toolCalls);
      return { healthState, toolCalls, environment, isMock: false, tier: 'direct' };

    } catch (apiErr) {
      console.group('%c[Tier2 Direct] Failed', 'color:#f39c12;font-weight:bold');
      console.error('Message:', apiErr.message);
      console.error('isQuota:', apiErr.isQuota);
      console.error('Status :', apiErr.status);
      console.error('Full err:', apiErr);
      console.groupEnd();

      const isQuota = apiErr.isQuota || apiErr.message?.includes('quota') || apiErr.message?.includes('billing') || apiErr.message?.includes('exceeded');
      const label = isQuota ? '⚡ Quota Exceeded' : `⚠️ ${apiErr.message?.slice(0, 50)}`;
      onProgress?.({ phase: 'mock', message: `${label} — using Demo Mode` });
    }
  } else {
    onProgress?.({ phase: 'mock', message: '⚡ Demo Mode — No API Key' });
  }

  // ── Tier 3: Mock ───────────────────────────────────────────────────────────
  await new Promise(r => setTimeout(r, 900));
  const { healthState, toolCalls } = mockAgentCycle(vitals, persona);
  const environment = toolCallsToEnvironment(toolCalls);
  return { healthState, toolCalls, environment, isMock: true, tier: 'mock' };
}
