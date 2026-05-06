import { requestAssistant } from '../api.js';
import { stripInlineMarkdownFormatting } from '../textCleanup.js';

const VISUALS = ['smoke-blue', 'amber-lit', 'rain-glossed', 'velvet-dark', 'silver-edged'];
const TEXTURES = ['static in the ribs', 'dust on the windowsill', 'salt on the mouth', 'heat under the skin', 'echo in the floorboards'];
const MOTIONS = ['leaning into the room', 'drifting through the rafters', 'collecting at the edges', 'moving like slow weather', 'opening like a bruise at dusk'];

function splitOptions(text) {
  return text
    .split(/\n+/)
    .map((line) => stripInlineMarkdownFormatting(line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim()))
    .filter(Boolean)
    .slice(0, 3);
}

function localImagery(text) {
  const seed = text.trim();

  if (!seed) {
    return [];
  }

  return [0, 1, 2].map((index) => {
    return `${seed}, ${VISUALS[index]} and ${MOTIONS[index]}, with ${TEXTURES[index]}.`;
  });
}

export async function expandImagery({ text, contextLines = [], aiAvailable = false }) {
  if (aiAvailable) {
    try {
      const response = await requestAssistant({
        tool: 'imagery',
        text,
        contextLines,
      });

      return {
        source: 'openai',
        note: `Generated with ${response.model}.`,
        variants: splitOptions(response.result),
      };
    } catch (error) {
      return {
        source: 'fallback',
        note: error.message,
        variants: localImagery(text),
      };
    }
  }

  return {
    source: 'fallback',
    note: 'OpenAI is not configured yet, so these are lightweight browser-side expansions.',
    variants: localImagery(text),
  };
}
