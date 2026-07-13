const ADMIN_SECRET = process.env.ADMIN_SECRET || 'pl-lab';
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
// and reconstruct fixed-length arrays on read.
function normalize(p) {
  if (!p) return null;
  const r  = p.results   || {};
  const r2 = p.p2results || {};
  const r3 = p.p3results || {};
  const r4 = p.p4results || {};
  return {
    ...p,
    results:   [r[0]  || null, r[1]  || null, r[2]  || null],
    p2results: [r2[0] || null, r2[1] || null, r2[2] || null],
    p3results: [r3[0] || null, r3[1] || null, r3[2] || null],
    p4results: [r4[0] || null, r4[1] || null, r4[2] || null],
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

// P1: sound tasks × AI levels
function generateAssignments() {
  const tasks  = shuffle([0, 1, 2]);
  const levels = shuffle([1, 2, 3]);
  return tasks.map((task, i) => ({ task, level: levels[i] }));
}

// P2: sound tasks × param restriction sets
function generateP2Assignments() {
  const tasks     = shuffle([0, 1, 2]);
  const paramSets = shuffle(['full', 'reduced', 'minimal']);
  return tasks.map((task, i) => ({ task, paramSet: paramSets[i] }));
}

// P3: visual tasks × AI levels (mirrors P1)
function generateP3Assignments() {
  const tasks  = shuffle([0, 1, 2]);
  const levels = shuffle(['manual', 'preset', 'chat']);
  return tasks.map((task, i) => ({ task, level: levels[i] }));
}

// P4: visual tasks × param restriction sets (mirrors P2)
function generateP4Assignments() {
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
          let dirty = false;
          if (!existing.p2assignments) {
            existing.p2assignments = generateP2Assignments();
            existing.p2results = existing.p2results || {};
            dirty = true;
          }
          if (!existing.p3assignments) {
            existing.p3assignments = generateP3Assignments();
            existing.p3results = existing.p3results || {};
            dirty = true;
          }
          if (!existing.p4assignments) {
            existing.p4assignments = generateP4Assignments();
            existing.p4results = existing.p4results || {};
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
          p3assignments: generateP3Assignments(),
          p3results:     {},
          p4assignments: generateP4Assignments(),
          p4results:     {},
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

      if (action === 'result4') {
        if (!id) return res.status(400).json({ error: 'Missing id' });
        const participant = await fbGet(`participants/${id}`);
        if (!participant) return res.status(404).json({ error: 'Participant not found' });
        if (!participant.p4results) participant.p4results = {};
        participant.p4results[taskIndex] = { ...result, completedAt: new Date().toISOString() };
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
