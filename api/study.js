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

// Firebase strips null values, so we store results as keyed objects
// and reconstruct 3-element arrays on read.
function normalize(p) {
  if (!p) return null;
  const r  = p.results   || {};
  const r2 = p.p2results || {};
  return {
    ...p,
    results:   [r[0]  || null, r[1]  || null, r[2]  || null],
    p2results: [r2[0] || null, r2[1] || null, r2[2] || null],
  };
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

function generateP2Assignments() {
  const tasks     = shuffle([0, 1, 2]);
  const paramSets = shuffle(['full', 'reduced', 'minimal']);
  return tasks.map((task, i) => ({ task, paramSet: paramSets[i] }));
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
      const participants = all ? Object.values(all).map(normalize).filter(Boolean) : [];
      return res.json({ participants });
    }

    if (req.method === 'POST') {
      const { action, id, taskIndex, result } = req.body || {};

      if (action === 'init') {
        if (!id) return res.status(400).json({ error: 'Missing id' });
        const existing = await fbGet(`participants/${id}`);
        if (existing) {
          // Backfill p2assignments for participants created before Part 2 was added
          if (!existing.p2assignments) {
            existing.p2assignments = generateP2Assignments();
            existing.p2results = existing.p2results || {};
            await fbPut(`participants/${id}`, existing);
          }
          return res.json(normalize(existing));
        }
        const participant = {
          id,
          createdAt: new Date().toISOString(),
          assignments:   generateAssignments(),
          results:       {},  // keyed object avoids Firebase null-stripping
          p2assignments: generateP2Assignments(),
          p2results:     {},
        };
        await fbPut(`participants/${id}`, participant);
        return res.json(normalize(participant));
      }

      if (action === 'result') {
        if (!id) return res.status(400).json({ error: 'Missing id' });
        const participant = await fbGet(`participants/${id}`);
        if (!participant) return res.status(404).json({ error: 'Participant not found' });
        if (!participant.results) participant.results = {};
        participant.results[taskIndex] = { ...result, completedAt: new Date().toISOString() };
        await fbPut(`participants/${id}`, participant);
        return res.json({ ok: true });
      }

      if (action === 'result2') {
        if (!id) return res.status(400).json({ error: 'Missing id' });
        const participant = await fbGet(`participants/${id}`);
        if (!participant) return res.status(404).json({ error: 'Participant not found' });
        if (!participant.p2results) participant.p2results = {};
        participant.p2results[taskIndex] = { ...result, completedAt: new Date().toISOString() };
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
