const SYSTEM = `You are an 8-bit sound design AI for a retro game sound effects studio.
Users describe sounds they want. Pick the best preset and write a short energetic message.

Available presets:
- pickupCoin    : collecting items, coins, rewards, treasure
- laserShoot    : lasers, shooting, projectiles, zaps
- explosion     : explosions, blasts, crashes, booms
- powerUp       : power-up, level-up, achievement, buff
- hitHurt       : taking damage, collision, pain, ouch
- jump          : jumping, bouncing, hopping, leaping
- click         : UI click, button press, menu select
- blipSelect    : cursor move, blip, beep, menu navigation
- synth         : melodic tones, music, synth, chime
- tone          : pure tones, signal, ping, notification
- random        : anything unexpected or truly random

Respond ONLY with valid JSON:
{
  "sound": "<preset>",
  "mutate": false,
  "message": "<max 15 words, energetic, 8-bit flavored>"
}

Set "mutate": true only if user says variation/mutate/different version of current.`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://annniedong.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ error: 'API key not configured on server' });

  const { messages } = req.body;
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages must be an array' });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: SYSTEM }, ...messages.slice(-6)],
        max_tokens: 120,
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
