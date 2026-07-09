const { kv } = require('@vercel/kv');

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'sfx-admin';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateAssignments() {
  const taskOrder  = shuffle([0, 1, 2]);
  const levelOrder = shuffle([1, 2, 3]);
  return taskOrder.map((task, i) => ({ task, level: levelOrder[i] }));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { id, secret } = req.query;

    if (secret === ADMIN_SECRET) {
      const ids = await kv.smembers('participants') || [];
      const participants = await Promise.all(ids.map(pid => kv.get(`participant:${pid}`)));
      return res.json({ participants: participants.filter(Boolean) });
    }

    if (!id) return res.status(400).json({ error: 'Missing id or secret' });
    const participant = await kv.get(`participant:${id}`);
    if (!participant) return res.status(404).json({ error: 'Not found' });
    return res.json(participant);
  }

  if (req.method === 'POST') {
    const { action, id, taskIndex, result } = req.body || {};

    if (action === 'init') {
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const existing = await kv.get(`participant:${id}`);
      if (existing) return res.json(existing);

      const participant = {
        id,
        createdAt: new Date().toISOString(),
        assignments: generateAssignments(),
        results: [null, null, null],
      };
      await kv.set(`participant:${id}`, participant);
      await kv.sadd('participants', id);
      return res.json(participant);
    }

    if (action === 'result') {
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const participant = await kv.get(`participant:${id}`);
      if (!participant) return res.status(404).json({ error: 'Participant not found' });

      participant.results[taskIndex] = {
        ...result,
        completedAt: new Date().toISOString(),
      };
      await kv.set(`participant:${id}`, participant);
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
