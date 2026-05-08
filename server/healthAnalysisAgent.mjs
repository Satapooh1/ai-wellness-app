import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod/v3';

const getAgentModel = () => process.env.OPENAI_HEALTH_MODEL
  ?? process.env.OPENAI_AGENT_MODEL
  ?? process.env.OPENAI_MODEL
  ?? 'gpt-4o';

const recordHealthInsight = tool({
  name: 'record_health_insight',
  description: 'Return the final health insight for the user as structured JSON.',
  parameters: z.object({
    risk_level: z.enum(['low', 'moderate', 'high', 'critical']),
    impact_score: z.number().min(0).max(100).describe('0 means no urgent concern, 100 means very high impact risk'),
    confidence: z.number().min(0).max(100),
    headline: z.string().describe('Short English headline with the main insight'),
    risks: z.string().describe('English risk summary, 2-4 lines, specific to the wearable data'),
    advice: z.string().describe('English actionable advice for today, concise but practical'),
    top_signals: z.array(z.object({
      label: z.string(),
      value: z.string(),
      severity: z.enum(['good', 'watch', 'risk', 'critical']),
      why: z.string(),
    })).min(3).max(5),
    action_plan: z.array(z.object({
      title: z.string(),
      today: z.string(),
      why: z.string(),
    })).min(3).max(4),
    smart_home_action: z.object({
      action_type: z.string(),
      description: z.string(),
    }),
    red_flags: z.array(z.string()).max(4),
  }),
  execute: async (p) => JSON.stringify({ success: true, insight: p }),
});

function localHealthInsight(persona) {
  const m = persona.metrics;
  const lowSleep = m.sleep_hours < 6;
  const highStress = m.stress_level >= 70;
  const lowHrv = m.hrv < 30;
  const lowSteps = m.steps_today < 3000;
  const highHr = m.heart_rate_avg >= 85;
  const highBmi = m.bmi >= 27;

  let impact = 28;
  if (lowSleep) impact += 18;
  if (highStress) impact += 20;
  if (lowHrv) impact += 16;
  if (lowSteps) impact += 12;
  if (highHr) impact += 12;
  if (highBmi) impact += 10;
  impact = Math.min(96, impact);

  const riskLevel = impact >= 78 ? 'critical' : impact >= 62 ? 'high' : impact >= 42 ? 'moderate' : 'low';
  const headline = riskLevel === 'critical'
    ? 'Body under high strain, reduce load today'
    : riskLevel === 'high'
      ? 'Risks found that need management within 24 hours'
      : riskLevel === 'moderate'
        ? 'Signs of fatigue detected, adjust behavior today'
        : 'Overall well controlled, maintain rest rhythms';

  const topSignals = [
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
  ];

  if (highBmi) {
    topSignals.push({
      label: 'BMI',
      value: String(m.bmi),
      severity: 'watch',
      why: 'High BMI combined with low activity is a signal for preventive management',
    });
  }

  return {
    risk_level: riskLevel,
    impact_score: impact,
    confidence: 82,
    headline,
    risks: `${headline}\nKey points: Slept ${m.sleep_hours} hrs, stress ${m.stress_level}%, HRV ${m.hrv} ms, and walked ${m.steps_today.toLocaleString()} steps, which collectively reflect strain on the body's recovery system.`,
    advice: 'Focus on 3 things today: reduce pre-sleep stimulus, add light post-meal movement, and do 5 minutes of breathing to reduce sympathetic load',
    top_signals: topSignals,
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
      description: 'Adjust lighting to low warm/cool tones based on body state, play soft ambient sound, and set breathing guide to transition body to rest mode',
    },
    red_flags: [
      'Seek immediate medical attention if experiencing chest pain, shortness of breath, dizziness, or severe palpitations',
      'This advice is insight from wearable data, not a medical diagnosis',
    ],
    isMock: true,
    mockReason: 'OpenAI quota unavailable; using local health insight rules',
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

function normalizeInsight(value) {
  const parsed = parseMaybeJson(value);
  if (!parsed) return null;
  return parsed.insight ?? parsed;
}

const healthInsightAgent = new Agent({
  name: 'HealthInsightAgent',
  model: getAgentModel(),
  modelSettings: {
    toolChoice: 'record_health_insight',
    parallelToolCalls: false,
    temperature: 0.2,
  },
  toolUseBehavior: {
    stopAtToolNames: ['record_health_insight'],
  },
  instructions: `You are a Health Insight Agent for a preventive wellness prototype.

Analyze wearable data, profile, symptoms, and goals, then call the record_health_insight tool exactly once.
Do not reply in plain text, do not reply with empty JSON, and do not summarize without calling the tool.

Important Rules:
- Respond in English, make it easy to understand and specific to the provided data.
- Help the user see the impact: explicitly state which metric affects recovery, sleep, stress, or metabolic risk.
- Do not diagnose medical conditions or make claims beyond wearable data.
- Provide an action plan achievable within 24 hours.
- If there are danger signals, carefully include red_flags.`,
  tools: [recordHealthInsight],
});

export async function runHealthAnalysisAgent(persona) {
  const prompt = `Analyze this user's health:

Name: ${persona.name}
Age: ${persona.age}
Occupation: ${persona.occupation}
Context: ${persona.bio ?? 'No data'}
Symptoms: ${(persona.symptoms ?? []).join(', ') || 'No data'}
Goals: ${(persona.goals ?? []).join(', ') || 'No data'}

Wearable metrics:
- Sleep hours: ${persona.metrics.sleep_hours}
- Sleep quality: ${persona.metrics.sleep_quality}%
- Average HR: ${persona.metrics.heart_rate_avg} bpm
- Night HR: ${persona.metrics.heart_rate_night} bpm
- Stress: ${persona.metrics.stress_level}%
- Steps today: ${persona.metrics.steps_today}
- HRV: ${persona.metrics.hrv} ms
- BMI: ${persona.metrics.bmi}

Sleep 7-day chart:
${JSON.stringify(persona.sleep_chart)}`;

  try {
    const result = await run(healthInsightAgent, prompt, { maxTurns: 6 });
    const items = result.newItems ?? [];
    const toolCall = items.find(i => i.type === 'tool_call_item' && i.name === 'record_health_insight');
    const toolOutput = items.find(i => i.type === 'tool_call_output_item' && i.name === 'record_health_insight');
    const structuredInsight = normalizeInsight(toolCall?.arguments)
      ?? normalizeInsight(toolOutput?.output)
      ?? normalizeInsight(result.finalOutput);

    if (!structuredInsight) {
      throw new Error('HealthInsightAgent did not return structured insight');
    }

    return {
      ...structuredInsight,
      agentTrace: items.map(i => ({
        type: i.type,
        agent: i.agent?.name ?? 'unknown',
        name: i.name,
      })),
      isMock: false,
    };
  } catch (err) {
    const isQuotaError = err.status === 429
      || err.code === 'insufficient_quota'
      || err.message?.includes('quota')
      || err.message?.includes('billing');

    const isConnectionError = err.constructor?.name === 'APIConnectionError'
      || err.message?.includes('Connection error');

    if (isQuotaError || isConnectionError) {
      console.warn('[HealthAgent] OpenAI unavailable; using local fallback result');
      return localHealthInsight(persona);
    }

    throw err;
  }
}
