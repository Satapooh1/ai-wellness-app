/**
 * Express API Server — ให้ frontend เรียก @openai/agents SDK
 * POST /api/wellness-agent { vitals, persona }
 */

import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

try {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../.env');
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const [k, ...rest] = line.split('=');
    const key = k?.trim();
    if (key && !key.startsWith('#')) {
      const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
      if (key === 'VITE_OPENAI_API_KEY' && !process.env.OPENAI_API_KEY) {
        process.env.OPENAI_API_KEY = val;
      }
    }
  }
} catch (_) { /* .env not found is OK */ }

// ─── Process-level error catchers (แสดง error ที่ซ่อนอยู่) ─────────────────────
process.on('uncaughtException', (err) => {
  console.error('\n[FATAL] Uncaught Exception:');
  console.error('  Message:', err.message);
  console.error('  Stack  :', err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('\n[FATAL] Unhandled Promise Rejection:');
  console.error('  Reason:', reason?.message ?? reason);
  if (reason?.stack) console.error('  Stack :', reason.stack.split('\n').slice(0,5).join('\n'));
});

process.on('exit', (code) => {
  console.log(`\n[Server] Process exiting — code: ${code}`);
});

// Keep event loop alive even if no requests pending
process.stdin.resume();

// ─── Load agents (wrap to show module load errors) ────────────────────────────
console.log('[Server] Loading wellness agents module...');
let runWellnessAgents;
let runHealthAnalysisAgent;
try {
  const mod = await import('./wellnessAgents.mjs');
  const healthMod = await import('./healthAnalysisAgent.mjs');
  runWellnessAgents = mod.runWellnessAgents;
  runHealthAnalysisAgent = healthMod.runHealthAnalysisAgent;
  console.log('[Server] ✅ Agents module loaded OK');
} catch (modErr) {
  console.error('[Server] ❌ Failed to load wellnessAgents.mjs:');
  console.error('  Message:', modErr.message);
  console.error('  Stack  :', modErr.stack);
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Load .env manually (lightweight, no extra deps) ─────────────────────────
try {
  const envPath = resolve(__dirname, '../.env');
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const [k, ...rest] = line.split('=');
    const key = k?.trim();
    if (key && !key.startsWith('#')) {
      const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
      // Also map VITE_OPENAI_API_KEY → OPENAI_API_KEY
      if (key === 'VITE_OPENAI_API_KEY' && !process.env.OPENAI_API_KEY) {
        process.env.OPENAI_API_KEY = val;
      }
    }
  }
} catch (_) { /* .env not found is OK */ }

const app  = express();
const PORT = process.env.AGENT_PORT ?? 3001;

app.use(cors()); // Allow all origins for local dev
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasKey: !!process.env.OPENAI_API_KEY });
});

// ── Main agent endpoint ───────────────────────────────────────────────────────
app.post('/api/health-analysis', async (req, res) => {
  const { persona } = req.body ?? {};
  const startTime = Date.now();

  if (!persona) {
    console.error('[HealthAgent] Bad request - missing persona');
    return res.status(400).json({ error: 'persona required' });
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('[HealthAgent] OPENAI_API_KEY not set');
    return res.status(503).json({ error: 'OPENAI_API_KEY not configured on server' });
  }

  console.log(`\n[HealthAgent] New analysis - ${persona.name}`);

  try {
    const result = await runHealthAnalysisAgent(persona);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[HealthAgent] Done in ${elapsed}s - impact ${result.impact_score}/100`);
    res.json({ ok: true, ...result });
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\n[HealthAgent] ERROR after ${elapsed}s`);
    console.error(`[HealthAgent] Message : ${err.message}`);
    console.error(`[HealthAgent] Type    : ${err.constructor?.name ?? 'Error'}`);
    if (err.status) console.error(`[HealthAgent] Status  : ${err.status}`);
    if (err.code) console.error(`[HealthAgent] Code    : ${err.code}`);

    const message = String(err.message ?? 'Health analysis failed')
      .replace(/proj_[A-Za-z0-9]+/g, '[project]')
      .replace(/sk-[A-Za-z0-9-]+/g, '[key]')
      .replace(/org-[A-Za-z0-9]+/g, '[org]')
      .slice(0, 160);

    res.status(500).json({ error: message, type: err.constructor?.name });
  }
});

app.post('/api/wellness-agent', async (req, res) => {
  const { vitals, persona } = req.body ?? {};
  const startTime = Date.now();

  if (!vitals || !persona) {
    console.error('[Server] ❌ Bad request — missing vitals or persona');
    return res.status(400).json({ error: 'vitals and persona required' });
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('[Server] ❌ OPENAI_API_KEY not set');
    return res.status(503).json({ error: 'OPENAI_API_KEY not configured on server' });
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[Agent] ▶ New request — ${persona.name}`);
  console.log(`[Agent]   HR:${vitals.hr} Breath:${vitals.breath} Stress:${vitals.stress}% SpO2:${vitals.spo2} HRV:${vitals.hrv}ms`);
  console.log(`${'─'.repeat(60)}`);

  try {
    const result = await runWellnessAgents(vitals, persona);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n[Agent] ✅ Done in ${elapsed}s`);
    console.log(`[Agent]   Tool calls: ${result.toolCalls.length}`);
    result.toolCalls.forEach((tc, i) => {
      console.log(`[Agent]   [${i+1}] ${tc.name}(${JSON.stringify(tc.args).slice(0, 80)}...)`);
    });
    if (result.finalOutput) {
      console.log(`[Agent]   Final: ${result.finalOutput.slice(0, 120)}`);
    }
    console.log(`${'─'.repeat(60)}\n`);

    res.json({ ok: true, ...result });
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\n[Agent] ❌ ERROR after ${elapsed}s`);
    console.error(`[Agent]   Message : ${err.message}`);
    console.error(`[Agent]   Type    : ${err.constructor?.name ?? 'Error'}`);
    if (err.status)  console.error(`[Agent]   Status  : ${err.status}`);
    if (err.code)    console.error(`[Agent]   Code    : ${err.code}`);
    if (err.stack)   console.error(`[Agent]   Stack   :\n${err.stack.split('\n').slice(0,6).join('\n')}`);
    console.error(`${'─'.repeat(60)}\n`);
    res.status(500).json({ error: err.message, type: err.constructor?.name });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🤖 Wellness Agent Server running on http://localhost:${PORT}`);
  console.log(`   API Key: ${process.env.OPENAI_API_KEY ? '✅ loaded' : '❌ missing'}\n`);
});
