const ADMIN_SECRET = process.env.ADMIN_SECRET || 'sfx-admin';
const SHEETS_URL   = process.env.SHEETS_WEBHOOK_URL;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SHEETS_URL) return res.status(500).json({ error: 'SHEETS_WEBHOOK_URL not set in Vercel env vars' });

  try {
    if (req.method === 'GET') {
      const { secret } = req.query;
      if (secret !== ADMIN_SECRET) return res.status(401).json({ error: 'Unauthorized' });
      const r = await fetch(`${SHEETS_URL}?secret=${encodeURIComponent(ADMIN_SECRET)}`);
      return res.json(await r.json());
    }

    if (req.method === 'POST') {
      const r = await fetch(SHEETS_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });
      return res.json(await r.json());
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
