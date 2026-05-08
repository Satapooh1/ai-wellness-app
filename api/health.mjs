/**
 * Vercel Serverless Function — GET /api/health
 * Health check endpoint
 */
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    ok: true,
    hasKey: !!process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_AGENT_MODEL ?? 'gpt-4o',
    timestamp: new Date().toISOString(),
  });
}
