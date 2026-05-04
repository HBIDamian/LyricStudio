import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;
const openAiApiKey = process.env.OPENAI_API_KEY;
const openAiModel = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
const hasLikelyOpenAiKey = Boolean(
  openAiApiKey
  && openAiApiKey !== 'your_openai_api_key_here'
  && /^sk-/.test(openAiApiKey),
);
const openai = hasLikelyOpenAiKey
  ? new OpenAI({ apiKey: openAiApiKey })
  : null;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    aiAvailable: Boolean(openai),
    model: openai ? openAiModel : null,
    reason: !openAiApiKey || openAiApiKey === 'your_openai_api_key_here'
      ? 'missing'
      : hasLikelyOpenAiKey
        ? null
        : 'invalid_key_format',
  });
});

function buildAssistantMessages({
  tool,
  text,
  part,
  tone,
  emotion,
  format,
  mood,
  perspective,
  anchor,
  contextLines = [],
}) {
  const surroundingContext = contextLines
    .filter((line) => line && line.trim())
    .slice(0, 8)
    .join('\n');

  const sharedSystem = [
    'You are Lyric Studio, a concise creative writing assistant for poets and songwriters.',
    'Keep responses lyrical, practical, and tightly formatted.',
    'Never explain your process. Return only the requested writing output.',
  ].join(' ');

  if (tool === 'rewrite') {
    return [
      { role: 'system', content: sharedSystem },
      {
        role: 'user',
        content: [
          `Rewrite the selected text in a ${tone} tone while preserving its core meaning.`,
          'Return exactly 3 short variations as a numbered list.',
          `Selected text: ${text}`,
          surroundingContext ? `Nearby lines for context:\n${surroundingContext}` : '',
        ].filter(Boolean).join('\n\n'),
      },
    ];
  }

  if (tool === 'imagery') {
    return [
      { role: 'system', content: sharedSystem },
      {
        role: 'user',
        content: [
          'Expand the selected text into vivid, sensory, poetic imagery.',
          'Return exactly 3 options. Each option should be 1 or 2 lines at most.',
          `Selected text: ${text}`,
          surroundingContext ? `Nearby lines for context:\n${surroundingContext}` : '',
        ].filter(Boolean).join('\n\n'),
      },
    ];
  }

  if (tool === 'ideas') {
    return [
      { role: 'system', content: sharedSystem },
      {
        role: 'user',
        content: [
          'The writer is looking for inspiration, not a finished piece.',
          'Ask nothing back. Instead, generate exactly 6 single-line ideas or short lyric fragments they can cherry-pick from.',
          'Do not write a full verse, chorus, poem, outline, or explanation.',
          'Keep each option distinct, suggestive, and open-ended enough for the human writer to continue.',
          part ? `Target section / use-case: ${part}` : '',
          format ? `Writing form: ${format}` : '',
          text ? `What they want to write about: ${text}` : '',
          mood ? `Mood / atmosphere: ${mood}` : '',
          perspective ? `Voice / perspective: ${perspective}` : '',
          anchor ? `Image, phrase, or detail to weave in: ${anchor}` : '',
          surroundingContext ? `Existing draft context:\n${surroundingContext}` : '',
        ].filter(Boolean).join('\n\n'),
      },
    ];
  }

  return [
    { role: 'system', content: sharedSystem },
    {
      role: 'user',
      content: [
        'Generate 5 compact metaphor ideas for the selected text or emotion.',
        'Return them as a bulleted list.',
        emotion ? `Emotion to emphasize: ${emotion}` : '',
        `Selected text: ${text}`,
        surroundingContext ? `Nearby lines for context:\n${surroundingContext}` : '',
      ].filter(Boolean).join('\n\n'),
    },
  ];
}

app.post('/api/assist', async (req, res) => {
  const {
    tool,
    text,
    part,
    tone,
    emotion,
    format,
    mood,
    perspective,
    anchor,
    contextLines,
  } = req.body ?? {};

  const normalizedText = text?.trim() ?? '';
  const normalizedMood = mood?.trim() ?? '';
  const normalizedAnchor = anchor?.trim() ?? '';

  if (!tool) {
    return res.status(400).json({
      error: 'A tool name is required.',
    });
  }

  if (!['rewrite', 'imagery', 'metaphor', 'ideas'].includes(tool)) {
    return res.status(400).json({ error: 'Unsupported assistant tool.' });
  }

  if (tool !== 'ideas' && !normalizedText) {
    return res.status(400).json({
      error: 'A tool name and selected text are required.',
    });
  }

  if (tool === 'ideas' && !normalizedText && !normalizedMood && !normalizedAnchor) {
    return res.status(400).json({
      error: 'Add a topic, mood, or anchor detail first so the assistant has something to build from.',
    });
  }

  if (!openai) {
    return res.status(503).json({
      error: 'OPENAI_API_KEY is missing or does not look valid yet. Add a real key to .env to unlock AI-assisted writing tools.',
    });
  }

  try {
    const response = await openai.responses.create({
      model: openAiModel,
      input: buildAssistantMessages({
        tool,
        text: normalizedText,
        part,
        tone,
        emotion,
        format,
        mood: normalizedMood,
        perspective,
        anchor: normalizedAnchor,
        contextLines,
      }),
    });

    const result = response.output_text?.trim();

    if (!result) {
      return res.status(502).json({
        error: 'OpenAI returned an empty response.',
      });
    }

    return res.json({
      ok: true,
      source: 'openai',
      model: openAiModel,
      result,
    });
  } catch (error) {
    console.error('Lyric Studio assistant error:', {
      status: error?.status,
      code: error?.code,
      type: error?.type,
    });

    if (error?.status === 401 || error?.code === 'invalid_api_key') {
      return res.status(401).json({
        error: 'The configured OpenAI API key appears invalid. Update OPENAI_API_KEY in .env and restart the app.',
      });
    }

    return res.status(500).json({
      error: 'The AI assistant could not complete this request right now.',
    });
  }
});

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Lyric Studio is listening on http://localhost:${port}`);
});
