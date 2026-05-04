const OVERRIDES = new Map([
  ['beautiful', 3],
  ['camera', 3],
  ['choir', 1],
  ['different', 2],
  ['every', 2],
  ['family', 3],
  ['fire', 1],
  ['hour', 1],
  ['lyric', 2],
  ['memory', 3],
  ['poem', 2],
  ['poetry', 3],
  ['studio', 3],
  ['toward', 1],
]);

function normalizeWord(word = '') {
  return word
    .toLowerCase()
    .replace(/[^a-z']/g, '')
    .replace(/^'+|'+$/g, '');
}

export function countWordSyllables(word) {
  const normalized = normalizeWord(word);

  if (!normalized) {
    return 0;
  }

  if (OVERRIDES.has(normalized)) {
    return OVERRIDES.get(normalized);
  }

  if (normalized.length <= 3) {
    return 1;
  }

  let working = normalized.replace(/(?:'s|')$/g, '');
  working = working.replace(/^y/, '');

  let count = (working.match(/[aeiouy]+/g) || []).length;

  if (working.endsWith('e') && !working.endsWith('le') && count > 1) {
    count -= 1;
  }

  if (/(?:ed|es)$/.test(working) && !/(ted|ded|ses|zes|xes|ches|shes)$/.test(working) && count > 1) {
    count -= 1;
  }

  if (/[^aeiou]le$/.test(working)) {
    count += 1;
  }

  if (/ia/.test(working)) {
    count += 1;
  }

  if (/riet|dien|iu|io/.test(working)) {
    count += 1;
  }

  if (/[^aeiouy]y$/.test(working)) {
    count += 1;
  }

  return Math.max(1, count);
}

export function countSyllables(text = '') {
  const words = text.match(/[a-zA-Z']+/g) || [];
  return words.reduce((sum, word) => sum + countWordSyllables(word), 0);
}

export function analyzeLines(lines = []) {
  return lines.map((line) => ({
    ...line,
    syllables: countSyllables(line.text),
  }));
}
