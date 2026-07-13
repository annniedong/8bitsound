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
  const r3 = p.p3results || {};
  return {
    ...p,
    results:   [r[0]  || null, r[1]  || null, r[2]  || null],
    p2results: [r2[0] || null, r2[1] || null, r2[2] || null],
    p3results: [r3[0]||null, r3[1]||null, r3[2]||null, r3[3]||null, r3[4]||null, r3[5]||null],
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

async function generateP3Assignments() {
  let counter = await fbGet('p3counter') || { A: 0, B: 0, C: 0 };
  const minVal = Math.min(counter.A, counter.B, counter.C);
  const least  = ['A', 'B', 'C'].filter(o => counter[o] === minVal);
  const order  = least[Math.floor(Math.random() * least.length)];
  counter[order] = (counter[order] || 0) + 1;
  await fbPut('p3counter', counter);
  return { order };
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
          let dirty = false;
          if (!existing.p2assignments) {
            existing.p2assignments = generateP2Assignments();
            existing.p2results = existing.p2results || {};
            dirty = true;
          }
          if (!existing.p3assignments) {
            existing.p3assignments = await generateP3Assignments();
            existing.p3results = existing.p3results || {};
            dirty = true;
          }
          if (dirty) await fbPut(`participants/${id}`, existing);
          return res.json(normalize(existing));
        }
        const participant = {
          id,
          createdAt: new Date().toISOString(),
          assignments:   generateAssignments(),
          results:       {},
          p2assignments: generateP2Assignments(),
          p2results:     {},
          p3assignments: await generateP3Assignments(),
          p3results:     {},
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

      if (action === 'result3') {
        if (!id) return res.status(400).json({ error: 'Missing id' });
        const participant = await fbGet(`participants/${id}`);
        if (!participant) return res.status(404).json({ error: 'Participant not found' });
        if (!participant.p3results) participant.p3results = {};
        participant.p3results[taskIndex] = { ...result, completedAt: new Date().toISOString() };
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
