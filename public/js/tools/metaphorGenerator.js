import { requestAssistant } from '../api.js';

const EMOTION_BANK = {
  longing: [
    'a radio hunting a vanished station',
    'tide pulling at a closed harbor',
    'a match waiting for the strike',
    'a window lit in another city',
    'gravity leaning toward a missing moon',
  ],
  heartbreak: [
    'glass learning the shape of the floor',
    'a hymn with its throat cut open',
    'weather moving through an abandoned house',
    'a bell still ringing after the tower falls',
    'salt in a room built for sleep',
  ],
  wonder: [
    'a doorway cut into the sky',
    'light teaching dust how to dance',
    'a pocket of stars in daylight',
    'rain speaking in silver threads',
    'the first breath of a newly opened room',
  ],
  rage: [
    'a furnace swallowing its own walls',
    'lightning trapped in a locked jaw',
    'an engine redlining in the ribs',
    'a city siren in a sleeping church',
    'iron heated past the point of prayer',
  ],
  hope: [
    'a seed splitting stone from underneath',
    'morning finding the seam in heavy curtains',
    'a lantern refusing the wind',
    'roots mapping water in the dark',
    'a bridge appearing through fog one plank at a time',
  ],
};

function cleanBullets(text) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 5);
}

function localMetaphors(text, emotion) {
  const subject = text.trim() || 'This feeling';
  const normalizedEmotion = emotion.trim().toLowerCase();
  const stems = EMOTION_BANK[normalizedEmotion];

  if (!stems) {
    return [
      `${subject} is a room humming with ${emotion}.`,
      `${subject} is weather carrying the taste of ${emotion}.`,
      `${subject} is a match head lit by ${emotion}.`,
      `${subject} is a tide answering only to ${emotion}.`,
      `${subject} is a window rattling with ${emotion}.`,
    ];
  }

  return stems.map((stem) => `${subject} is ${stem}.`);
}

export async function generateMetaphors({ text, emotion = 'longing', contextLines = [], aiAvailable = false }) {
  if (aiAvailable) {
    try {
      const response = await requestAssistant({
        tool: 'metaphor',
        text,
        emotion,
        contextLines,
      });

      return {
        source: 'openai',
        note: `Generated with ${response.model}.`,
        metaphors: cleanBullets(response.result),
      };
    } catch (error) {
      return {
        source: 'fallback',
        note: error.message,
        metaphors: localMetaphors(text, emotion),
      };
    }
  }

  return {
    source: 'fallback',
    note: 'OpenAI is not configured yet, so these are lightweight browser-side metaphors.',
    metaphors: localMetaphors(text, emotion),
  };
}
