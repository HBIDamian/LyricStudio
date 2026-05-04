import { analyzeLines } from './tools/syllableCounter.js';

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'your',
  'from',
  'into',
  'over',
  'like',
  'have',
  'when',
  'then',
  'they',
  'them',
  'their',
  'there',
  'where',
  'what',
  'you',
  'are',
  'was',
  'were',
  'will',
  'just',
  'only',
  'but',
  'our',
  'out',
  'all',
  'too',
  'not',
  'had',
  'has',
  'his',
  'her',
  'its',
  'who',
  'why',
  'how',
  'can',
  'let',
  'get',
  'got',
  'off',
  'don',
  'ain',
]);

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values) {
  if (values.length < 2) {
    return 0;
  }

  const mean = average(values);
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

function findLineBySyllableCount(lines, comparator) {
  return lines.reduce((candidate, line) => {
    if (!candidate) {
      return line;
    }

    return comparator(line.syllables, candidate.syllables) ? line : candidate;
  }, null);
}

function extractWords(text) {
  return text.toLowerCase().match(/[a-z']+/g) || [];
}

function getRepeatedWords(lines) {
  const frequencies = new Map();

  lines
    .flatMap((line) => extractWords(line.text))
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .forEach((word) => {
      frequencies.set(word, (frequencies.get(word) || 0) + 1);
    });

  return [...frequencies.entries()]
    .filter(([, count]) => count > 1)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6)
    .map(([word, count]) => `${word} ×${count}`);
}

function getRepeatedEndings(lines) {
  const endings = new Map();

  lines.forEach((line) => {
    const words = extractWords(line.text);
    const endWord = words.at(-1);

    if (!endWord) {
      return;
    }

    endings.set(endWord, (endings.get(endWord) || 0) + 1);
  });

  return [...endings.entries()]
    .filter(([, count]) => count > 1)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 4)
    .map(([word, count]) => `${word} ×${count}`);
}

function getStanzaCount(lines) {
  let stanzaCount = 0;
  let insideStanza = false;

  lines.forEach((line) => {
    if (line.text.trim()) {
      if (!insideStanza) {
        stanzaCount += 1;
        insideStanza = true;
      }

      return;
    }

    insideStanza = false;
  });

  return stanzaCount;
}

export function buildDraftAnalysis(lines) {
  const nonEmptyLines = lines.filter((line) => line.text.trim());

  if (!nonEmptyLines.length) {
    return {
      rhythmSummary: 'Add a few lines to see rhythmic balance.',
      rhythmLines: [],
      repetitionSummary: 'Repeated words and line endings will appear here.',
      repeatedWords: [],
      repeatedEndings: [],
      structureSummary: 'Line count, stanza breaks, and shape cues live here.',
      structureItems: [],
    };
  }

  const syllableLines = analyzeLines(nonEmptyLines);
  const syllableCounts = syllableLines.map((line) => line.syllables);
  const syllableAverage = average(syllableCounts);
  const rhythmVariance = variance(syllableCounts);
  const minSyllableLine = findLineBySyllableCount(syllableLines, (left, right) => left < right);
  const maxSyllableLine = findLineBySyllableCount(syllableLines, (left, right) => left > right);
  const syllableRange = (maxSyllableLine?.syllables ?? 0) - (minSyllableLine?.syllables ?? 0);
  const totalWords = nonEmptyLines.reduce((sum, line) => sum + extractWords(line.text).length, 0);
  const averageWords = totalWords / nonEmptyLines.length;
  const stanzaCount = getStanzaCount(lines);
  const longestLine = nonEmptyLines.reduce((longest, line) => {
    if (!longest || line.text.length > longest.text.length) {
      return line;
    }

    return longest;
  }, null);

  const rhythmMood = rhythmVariance < 5
    ? 'steady and song-like'
    : rhythmVariance < 12
      ? 'loosely balanced with a natural sway'
      : 'intentionally jagged and free-form';

  return {
    rhythmSummary: `Average ${syllableAverage.toFixed(1)} syllables per non-empty line — the draft feels ${rhythmMood}.`,
    rhythmLines: [
      { label: 'Avg. syllables / line', value: syllableAverage.toFixed(1) },
      { label: 'Rhythm range', value: `${minSyllableLine?.syllables ?? 0}–${maxSyllableLine?.syllables ?? 0} syllables` },
      {
        label: 'Tightest line',
        value: minSyllableLine ? `#${minSyllableLine.number} · ${minSyllableLine.syllables} syllables` : '—',
      },
      {
        label: 'Broadest line',
        value: maxSyllableLine ? `#${maxSyllableLine.number} · ${maxSyllableLine.syllables} syllables` : '—',
      },
      {
        label: 'Pulse swing',
        value: `${syllableRange.toFixed(0)} syllable ${syllableRange === 1 ? 'step' : 'steps'}`,
      },
    ],
    repetitionSummary: getRepeatedWords(nonEmptyLines).length || getRepeatedEndings(nonEmptyLines).length
      ? 'A few words or endings are recurring enough to shape the draft’s texture.'
      : 'Repetition is light right now, so the language feels relatively varied.',
    repeatedWords: getRepeatedWords(nonEmptyLines),
    repeatedEndings: getRepeatedEndings(nonEmptyLines),
    structureSummary: `${lines.length} total lines, ${stanzaCount || 1} stanza${stanzaCount === 1 ? '' : 's'}, and about ${averageWords.toFixed(1)} words per active line.`,
    structureItems: [
      { label: 'Total lines', value: String(lines.length) },
      { label: 'Non-empty lines', value: String(nonEmptyLines.length) },
      { label: 'Stanzas', value: String(stanzaCount || 1) },
      { label: 'Avg. words / line', value: averageWords.toFixed(1) },
      {
        label: 'Longest line',
        value: longestLine ? `#${longestLine.number} · ${longestLine.text.length} chars` : '—',
      },
    ],
  };
}
