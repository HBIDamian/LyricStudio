import { WORD_BANK } from './wordBank.js';

function normalizeWord(word = '') {
  return word.toLowerCase().replace(/[^a-z]/g, '');
}

function extractWords(text = '') {
  return (text.toLowerCase().match(/[a-z']+/g) || [])
    .map(normalizeWord)
    .filter(Boolean);
}

function getTargetWord(text) {
  return extractWords(text).at(-1) || '';
}

function getVowelGroups(word) {
  return normalizeWord(word).match(/[aeiouy]+/g) || [];
}

function getRhymeKey(word) {
  const normalized = normalizeWord(word);

  if (!normalized) {
    return '';
  }

  const matches = [...normalized.matchAll(/[aeiouy]+/g)];

  if (!matches.length) {
    return normalized.slice(-3);
  }

  const lastMatch = matches.at(-1);
  return normalized.slice(lastMatch.index);
}

function sharedSuffixLength(left, right) {
  let length = 0;

  while (
    length < left.length
    && length < right.length
    && left.at(-(length + 1)) === right.at(-(length + 1))
  ) {
    length += 1;
  }

  return length;
}

function nearRhymeScore(candidate, target) {
  const suffix = sharedSuffixLength(candidate, target);
  const candidateVowelTail = getVowelGroups(candidate).at(-1);
  const targetVowelTail = getVowelGroups(target).at(-1);
  const sameVowelTail = candidateVowelTail && candidateVowelTail === targetVowelTail;
  const sameEndingPair = candidate.slice(-2) === target.slice(-2);

  return suffix + (sameVowelTail ? 2 : 0) + (sameEndingPair ? 1 : 0) - Math.abs(candidate.length - target.length) * 0.08;
}

export function findRhymes(selectionText, contextText = '') {
  const target = getTargetWord(selectionText);

  if (!target) {
    return {
      target: '',
      perfect: [],
      near: [],
    };
  }

  const perfectKey = getRhymeKey(target);
  const pool = [...new Set([...WORD_BANK, ...extractWords(contextText)])]
    .map(normalizeWord)
    .filter((word) => word && word !== target);

  const perfect = pool
    .filter((candidate) => getRhymeKey(candidate) === perfectKey && sharedSuffixLength(candidate, target) >= Math.min(2, perfectKey.length))
    .sort((left, right) => {
      return sharedSuffixLength(right, target) - sharedSuffixLength(left, target)
        || Math.abs(left.length - target.length) - Math.abs(right.length - target.length)
        || left.localeCompare(right);
    })
    .slice(0, 10);

  const near = pool
    .filter((candidate) => !perfect.includes(candidate) && nearRhymeScore(candidate, target) >= 3)
    .sort((left, right) => nearRhymeScore(right, target) - nearRhymeScore(left, target) || left.localeCompare(right))
    .slice(0, 10);

  return {
    target,
    perfect,
    near,
  };
}
