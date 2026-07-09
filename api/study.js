const ADMIN_SECRET = process.env.ADMIN_SECRET || 'sfx-admin';
const DB = process.env.FIREBASE_DB_URL; // e.g. https://your-project-default-rtdb.firebaseio.com

async function fbGet(path) {
  const res = await fetch(`${DB}/${path}.json`);
  return res.json();
}

async function fbPut(path, data) {
  await fetch(`${DB}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function generateAssignments() {
  const tasks  = shuffle([0, 1, 2]);
  const levels = shuffle([1, 2, 3]);
  return tasks.map((task, i) => ({ task, level: levels[i] }));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!DB) return res.status(500).json({ error: 'FIREBASE_DB_URL not set in Vercel env vars' });

  try {
    if (req.method === 'GET') {
      const { secret } = req.query;
      if (secret !== ADMIN_SECRET) return res.status(401).json({ error: 'Unauthorized' });
      const all = await fbGet('participants');
      const participants = all ? Object.values(all) : [];
      return res.json({ participants });
    }

    if (req.method === 'POST') {
      const { action, id, taskIndex, result } = req.body || {};

      if (action === 'init') {
        if (!id) return res.status(400).json({ error: 'Missing id' });
        let participant = await fbGet(`participants/${id}`);
        if (participant) return res.json(participant);
        participant = {
          id,
          createdAt: new Date().toISOString(),
          assignments: generateAssignments(),
          results: [null, null, null],
        };
        await fbPut(`participants/${id}`, participant);
        return res.json(participant);
      }

      if (action === 'result') {
        if (!id) return res.status(400).json({ error: 'Missing id' });
        const participant = await fbGet(`participants/${id}`);
        if (!participant) return res.status(404).json({ error: 'Participant not found' });
        participant.results[taskIndex] = { ...result, completedAt: new Date().toISOString() };
        await fbPut(`participants/${id}`, participant);
        return res.json({ ok: true });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
