require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.post('/api/chat', async (req, res) => {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not set on server' });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages must be an array' });
  }

  const system = `You are an 8-bit sound design AI for a retro game sound effects studio.
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

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          ...messages.slice(-6),
        ],
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
});

app.post('/api/pixel-assistant', async (req, res) => {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set on server' });

  const { prompt, currentParams } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  const PIXEL_SYSTEM = `You are a pixel-art assistant for an 8-bit sprite generation studio.
The user describes a visual change they want to make to their pixel sprite.
You adjust visual synthesis parameters to achieve the desired effect.

Available parameters:
- preset: one of [manual, coin, gem, potion, sword, slime, skull, tree, mushroom, star]
- silhouetteType: one of [blob, round, tall, wide, spiky, boxy, blade, tree]
- symmetry: one of [none, vertical, horizontal, quad]
- fillRatio: 0.12-0.88, complexity: 0-1, outline: 0-1, pixelJitter: 0-1
- paletteHue: 0-360, paletteCount: 2-6, contrast: 0-1, brightness: 0.2-1
- saturation: 0-1, ditherAmount: 0-1, highlightStrength: 0-1, shadowStrength: 0-1
- detailDensity: 0-1, glowAmount: 0-1

Respond ONLY with valid JSON: { "updates": { "paletteHue": 120 }, "message": "<max 15 words>" }
Only include parameters that should change.`;

  const userMsg = currentParams
    ? `Current params: ${JSON.stringify(currentParams)}\n\nUser request: ${prompt}`
    : prompt;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: PIXEL_SYSTEM }, { role: 'user', content: userMsg }],
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
});

app.listen(PORT, () => {
  console.log(`\n  SFX STUDIO\n`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  Level 1 (manual only):    ?level=1`);
  console.log(`  Level 2 (presets):        ?level=2`);
  console.log(`  Level 3 (AI assistant):   ?level=3\n`);
});
