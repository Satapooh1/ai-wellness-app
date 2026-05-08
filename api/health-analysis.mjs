/**
 * Vercel Serverless Function — POST /api/health-analysis
 * แทน Express route ใน server/index.mjs
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runHealthAnalysisAgent } from '../server/healthAnalysisAgent.mjs';

function loadEnv() {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const envPath = resolve(__dirname, '../.env');
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
  } catch (_) { /* .env not found is OK on Vercel */ }
}

export default async function handler(req, res) {
  loadEnv();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { persona } = req.body ?? {};
  if (!persona) return res.status(400).json({ error: 'persona required' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY not configured' });

  const startTime = Date.now();
  console.log(`[health-analysis] ▶ ${persona.name}`);

  try {
    const result = await runHealthAnalysisAgent(persona);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[health-analysis] ✅ Done in ${elapsed}s`);
    return res.json({ ok: true, ...result });
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[health-analysis] ❌ ERROR after ${elapsed}s: ${err.message}`);
    const message = String(err.message ?? 'Health analysis failed')
      .replace(/proj_[A-Za-z0-9]+/g, '[project]')
      .replace(/sk-[A-Za-z0-9-]+/g, '[key]')
      .slice(0, 160);
    return res.status(500).json({ error: message, type: err.constructor?.name });
  }
}
