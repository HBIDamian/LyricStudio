import { requestAssistant } from '../api.js';

function cleanIdeas(text) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 6);
}

function localIdeaSeeds({ text, part, format, mood, perspective, anchor }) {
  const topic = text.trim() || 'something hard to say directly';
  const partLabel = part.trim() || 'any part of the piece';
  const tone = mood.trim() || 'raw and quietly vivid';
  const detail = anchor.trim() || 'a detail that keeps catching in the mind';
  const voice = perspective.trim() || 'first person';
  const form = format.trim() || 'song lyrics';

  return [
    `For the ${partLabel} of this ${form}, let the ${detail} be the sign that ${topic} is still unresolved.`,
    `Write the ${partLabel} in a ${tone} ${voice} voice: “I keep finding ${detail} where ${topic} should have faded.”`,
    `Try a version with motion: “By the time I reached ${detail}, ${topic} had already changed its name.”`,
    `Keep one option cleaner and more direct: “${detail} makes ${topic} sound smaller than it feels.”`,
    `Let one line lean emotional instead of literal: “Even ${detail} knows what this ${topic} costs me.”`,
    `Add tension for the ${partLabel}: “I came here for answers, but ${detail} only made ${topic} louder.”`,
  ];
}

export async function generateLineIdeas({
  text,
  part = 'any part of the piece',
  format = 'song lyrics',
  mood = '',
  perspective = 'first person',
  anchor = '',
  contextLines = [],
  aiAvailable = false,
}) {
  if (aiAvailable) {
    try {
      const response = await requestAssistant({
        tool: 'ideas',
        text,
        part,
        format,
        mood,
        perspective,
        anchor,
        contextLines,
      });

      return {
        source: 'openai',
        note: `Generated with ${response.model}. Built as line sparks, not a finished draft.`,
        ideas: cleanIdeas(response.result),
      };
    } catch (error) {
      return {
        source: 'fallback',
        note: error.message,
        ideas: localIdeaSeeds({ text, part, format, mood, perspective, anchor }),
      };
    }
  }

  return {
    source: 'fallback',
    note: 'OpenAI is not configured yet, so these are lightweight browser-side idea sparks.',
    ideas: localIdeaSeeds({ text, part, format, mood, perspective, anchor }),
  };
}