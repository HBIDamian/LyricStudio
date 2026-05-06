import { requestAssistant } from '../api.js';
import { stripInlineMarkdownFormatting } from '../textCleanup.js';

function cleanList(text) {
  return text
    .split(/\n+/)
    .map((line) => stripInlineMarkdownFormatting(line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim()))
    .filter(Boolean)
    .slice(0, 3);
}

function localRewrite(text, tone) {
  const seed = text.trim();
  const normalizedTone = tone.trim().toLowerCase();

  if (!seed) {
    return [];
  }

  const variants = {
    poetic: [
      `${seed}, with the edges turned luminous.`,
      `${seed} until it sounds like weather in stained glass.`,
      `${seed}, softer and stranger under moonlit air.`,
    ],
    darker: [
      `${seed}, but with ash caught in its teeth.`,
      `${seed} under a bruised and flickering sky.`,
      `${seed}, where even the light sounds tired.`,
    ],
    simpler: [
      `${seed}.`,
      `Keep it plain: ${seed.toLowerCase()}.`,
      `Strip it back to this: ${seed.toLowerCase()}.`,
    ],
    emotional: [
      `${seed}, with my chest still open.`,
      `${seed} like a confession I can’t swallow back.`,
      `${seed}, and let the ache show first.`,
    ],
  };

  if (variants[normalizedTone]) {
    return variants[normalizedTone];
  }

  return [
    `${seed}, recast in a ${tone} tone.`,
    `${seed}, but make it feel more ${tone}.`,
    `${seed}, as if the voice were unmistakably ${tone}.`,
  ];
}

export async function rewriteSelection({ text, tone = 'poetic', contextLines = [], aiAvailable = false }) {
  if (aiAvailable) {
    try {
      const response = await requestAssistant({
        tool: 'rewrite',
        text,
        tone,
        contextLines,
      });

      return {
        source: 'openai',
        note: `Generated with ${response.model}.`,
        variants: cleanList(response.result),
      };
    } catch (error) {
      return {
        source: 'fallback',
        note: error.message,
        variants: localRewrite(text, tone),
      };
    }
  }

  return {
    source: 'fallback',
    note: 'OpenAI is not configured yet, so these are lightweight browser-side sketches.',
    variants: localRewrite(text, tone),
  };
}
