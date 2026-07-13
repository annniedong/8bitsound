const SYSTEM = `You are a pixel-art assistant for an 8-bit sprite generation studio.
The user describes a visual change they want to make to their pixel sprite.
You adjust visual synthesis parameters to achieve the desired effect.

Available parameters:
- preset: one of [manual, coin, gem, potion, sword, slime, skull, tree, mushroom, star]
- silhouetteType: one of [blob, round, tall, wide, spiky, boxy, blade, tree]
- symmetry: one of [none, vertical, horizontal, quad]
- fillRatio: 0.12–0.88
- complexity: 0–1
- outline: 0–1
- pixelJitter: 0–1
- paletteHue: 0–360
- paletteCount: 2–6
- contrast: 0–1
- brightness: 0.2–1
- saturation: 0–1
- ditherAmount: 0–1
- highlightStrength: 0–1
- shadowStrength: 0–1
- detailDensity: 0–1
- glowAmount: 0–1

Respond ONLY with valid JSON:
{
  "updates": { "paletteHue": 120, "saturation": 0.8 },
  "message": "<short description, max 15 words>"
}

Only include parameters that should change.`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ error: 'API key not configured' });

  const { prompt, currentParams } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  const userMsg = currentParams
    ? `Current params: ${JSON.stringify(currentParams)}\n\nUser request: ${prompt}`
    : prompt;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userMsg }],
        max_tokens: 200,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'OpenAI error' });
    }
    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
