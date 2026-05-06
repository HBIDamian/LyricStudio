import { requestAssistant } from '../api.js';
import { stripInlineMarkdownFormatting } from '../textCleanup.js';

function stripIdeaMarker(line = '') {
  return stripInlineMarkdownFormatting(line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim());
}

function normalizeRhymePattern(rhymePattern = '', lineCount = 1) {
  const normalizedLineCount = Math.min(4, Math.max(1, Number.parseInt(lineCount, 10) || 1));
  const normalizedPattern = rhymePattern.trim().toUpperCase();

  if (normalizedLineCount <= 1) {
    return '';
  }

  if (!normalizedPattern || normalizedPattern.length !== normalizedLineCount) {
    return '';
  }

  return /^[A-Z]+$/.test(normalizedPattern) ? normalizedPattern : '';
}

function cleanIdeas(text, lineCount = 1) {
  const normalizedLineCount = Math.min(4, Math.max(1, Number.parseInt(lineCount, 10) || 1));
  const rawLines = text
    .split('\n')
    .map((line) => stripIdeaMarker(line))
    .filter(Boolean);
  const originalLines = text.split('\n');
  const groupedIdeas = [];
  let currentIdea = [];
  let sawExplicitIdeaMarkers = false;

  const flushIdea = () => {
    if (!currentIdea.length) {
      return;
    }

    groupedIdeas.push(currentIdea);
    currentIdea = [];
  };

  for (const originalLine of originalLines) {
    const trimmed = originalLine.trim();

    if (!trimmed) {
      flushIdea();
      continue;
    }

    const hasMarker = /^\s*(?:[-*]|\d+[.)])\s*/.test(originalLine);
    const cleanedLine = stripIdeaMarker(originalLine);

    if (!cleanedLine) {
      continue;
    }

    if (hasMarker) {
      sawExplicitIdeaMarkers = true;
      flushIdea();
    }

    currentIdea.push(cleanedLine);
  }

  flushIdea();

  if (normalizedLineCount === 1) {
    if (groupedIdeas.length) {
      return groupedIdeas
        .map((idea) => idea[0])
        .filter(Boolean)
        .slice(0, 6);
    }

    return rawLines.slice(0, 6);
  }

  if (groupedIdeas.length && (sawExplicitIdeaMarkers || groupedIdeas.some((idea) => idea.length > 1))) {
    return groupedIdeas
      .map((idea) => idea.slice(0, normalizedLineCount).join('\n'))
      .filter(Boolean)
      .slice(0, 6);
  }

  const chunkedIdeas = [];

  for (let index = 0; index < rawLines.length; index += normalizedLineCount) {
    const idea = rawLines.slice(index, index + normalizedLineCount);

    if (!idea.length) {
      continue;
    }

    chunkedIdeas.push(idea.join('\n'));

    if (chunkedIdeas.length === 6) {
      break;
    }
  }

  return chunkedIdeas;
}

function localIdeaSeeds({
  text,
  part,
  format,
  mood,
  perspective,
  anchor,
  lineCount = 1,
}) {
  const topic = text.trim() || 'something hard to say directly';
  const partLabel = part.trim() || 'any part of the piece';
  const tone = mood.trim() || 'raw and quietly vivid';
  const detail = anchor.trim() || 'a detail that keeps catching in the mind';
  const voice = perspective.trim() || 'first person';
  const form = format.trim() || 'song lyrics';
  const normalizedLineCount = Math.min(4, Math.max(1, Number.parseInt(lineCount, 10) || 1));

  const ideaGroups = [
    [
      `For the ${partLabel} of this ${form}, let the ${detail} be the sign that ${topic} is still unresolved.`,
      `Keep the ${tone} energy close, like the thought is arriving mid-breath.`,
      `Let the ${voice} voice sound like it almost understands the feeling, but not quite.`,
      'Leave a little emotional space at the end so the writer can keep building from it.',
    ],
    [
      `Write the ${partLabel} in a ${tone} ${voice} voice: “I keep finding ${detail} where ${topic} should have faded.”`,
      'Let the image carry the ache before you explain the ache directly.',
      'Aim for a phrase that feels lived-in instead of polished smooth.',
      'End on a note that invites the next line instead of resolving everything.',
    ],
    [
      `Try a version with motion: “By the time I reached ${detail}, ${topic} had already changed its name.”`,
      'Use movement to show how the feeling shifted while the speaker was catching up.',
      'Give the line enough detail that it feels seen, not generic.',
      'Keep the final beat a little unfinished so it still feels like a spark.',
    ],
    [
      `Keep one option cleaner and more direct: “${detail} makes ${topic} sound smaller than it feels.”`,
      'Let the language stay simple while the emotional contrast does the heavy lifting.',
      'This works best if the line feels honest before it tries to feel clever.',
      'Leave room for a stronger follow-up image in the next bar or line.',
    ],
    [
      `Let one line lean emotional instead of literal: “Even ${detail} knows what this ${topic} costs me.”`,
      `Keep the ${tone} mood present without over-explaining it.`,
      `Make the ${voice} perspective feel immediate, like it is being admitted in real time.`,
      'The last beat should hint at consequence more than explanation.',
    ],
    [
      `Add tension for the ${partLabel}: “I came here for answers, but ${detail} only made ${topic} louder.”`,
      `Let the ${form} stay open-ended enough that it can grow into a verse, hook, or pivot.`,
      'Use the contrast between intention and result to create momentum.',
      'Finish with a phrase that naturally points toward another image or confession.',
    ],
  ];

  return ideaGroups.map((idea) => idea.slice(0, normalizedLineCount).join('\n'));
}

export async function generateLineIdeas({
  text,
  part = 'any part of the piece',
  format = 'song lyrics',
  mood = '',
  perspective = 'first person',
  anchor = '',
  lineCount = 1,
  rhymePattern = '',
  contextLines = [],
  aiAvailable = false,
}) {
  const normalizedLineCount = Math.min(4, Math.max(1, Number.parseInt(lineCount, 10) || 1));
  const normalizedRhymePattern = normalizeRhymePattern(rhymePattern, normalizedLineCount);
  const strictRhymeError = normalizedRhymePattern
    ? `A locked ${normalizedRhymePattern} rhyme pattern was requested, so Lyric Studio explicitly asks the AI to follow it with perfect rhyme.`
    : '';

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
        lineCount: normalizedLineCount,
        rhymePattern: normalizedRhymePattern,
        contextLines,
      });

      return {
        source: 'openai',
        note: `Generated with ${response.model}. Built as line sparks, not a finished draft.`,
        ideas: cleanIdeas(response.result, normalizedLineCount),
      };
    } catch (error) {
      if (normalizedRhymePattern) {
        return {
          source: 'error',
          note: `${error.message} ${strictRhymeError}`.trim(),
          ideas: [],
        };
      }

      return {
        source: 'fallback',
        note: error.message,
        ideas: localIdeaSeeds({
          text,
          part,
          format,
          mood,
          perspective,
          anchor,
          lineCount: normalizedLineCount,
        }),
      };
    }
  }

  if (normalizedRhymePattern) {
    return {
      source: 'error',
      note: `A locked ${normalizedRhymePattern} rhyme pattern needs AI mode so Lyric Studio can ask for exact perfect-rhyme patterns.`,
      ideas: [],
    };
  }

  return {
    source: 'fallback',
    note: 'OpenAI is not configured yet, so these are lightweight browser-side idea sparks.',
    ideas: localIdeaSeeds({
      text,
      part,
      format,
      mood,
      perspective,
      anchor,
      lineCount: normalizedLineCount,
    }),
  };
}