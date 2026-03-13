const express = require('express');
const cors = require('cors');
const OpenAI = require('openai').default;
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────────────────────
// KEYS — pon tus keys aquí
// ─────────────────────────────────────────────────────────────
const OPENAI_KEY = '';  // ← tu key de OpenAI
const CLAUDE_KEY = '';  // ← tu key de Claude (puede quedar vacío)

const openai = new OpenAI({ apiKey: OPENAI_KEY });
const anthropic = CLAUDE_KEY ? new Anthropic({ apiKey: CLAUDE_KEY }) : null;

// ─────────────────────────────────────────────────────────────
// PROVIDERS
// ─────────────────────────────────────────────────────────────
async function tryOpenAI(messages, system) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 1000,
    messages: [{ role: 'system', content: system }, ...messages],
  });
  return response.choices[0].message.content;
}

async function tryClaude(messages, system) {
  if (!anthropic) throw new Error('Claude key no configurada');
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system,
    messages,
  });
  return response.content[0].text;
}

// ─────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { messages, system } = req.body;
  let usedModel = 'openai';

  try {
    let text;
    try {
      text = await tryOpenAI(messages, system);
    } catch (e) {
      console.warn(`⚠️  OpenAI falló: ${e.message} — intentando Claude...`);
      text = await tryClaude(messages, system);
      usedModel = 'claude';
    }

    console.log(`✓ Respuesta via ${usedModel}`);
    res.json({ text });

  } catch (error) {
    console.error('✗ Ambas APIs fallaron:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => res.json({
  status: 'OK',
  openai: !!OPENAI_KEY,
  claude: !!CLAUDE_KEY,
}));

app.listen(3001, () => console.log('🚀 Backend en http://localhost:3001'));
