const CLICHES = [
  {
    phrase: 'heart of gold',
    suggestions: ['quiet generosity', 'sun-warm kindness'],
  },
  {
    phrase: 'cold as ice',
    suggestions: ['glass-cold', 'winter-bare'],
  },
  {
    phrase: 'dark as night',
    suggestions: ['lightless as wet ink', 'black as a shuttered room'],
  },
  {
    phrase: 'broken heart',
    suggestions: ['split-open chest', 'ribcage full of static'],
  },
  {
    phrase: 'burning desire',
    suggestions: ['an ember under the tongue', 'a fuse hissing in the chest'],
  },
  {
    phrase: 'love is blind',
    suggestions: ['love smooths the warning signs', 'affection blurs the sharp edges'],
  },
  {
    phrase: 'head over heels',
    suggestions: ['tilted out of balance', 'thrown heart-first'],
  },
  {
    phrase: 'time will tell',
    suggestions: ['the days will expose it', 'the clock will make its argument'],
  },
  {
    phrase: 'lost in the moment',
    suggestions: ['dissolved into the hour', 'taken by the pulse of it'],
  },
  {
    phrase: 'walk in the park',
    suggestions: ['easy as a familiar corner', 'light work on level ground'],
  },
  {
    phrase: 'every cloud has a silver lining',
    suggestions: ['even storms leak a little mercy', 'bad weather still lets some light through'],
  },
  {
    phrase: 'better late than never',
    suggestions: ['late still counts if it arrives alive', 'delayed, but breathing'],
  },
  {
    phrase: 'at the end of the day',
    suggestions: ['when the noise settles', 'when all the dust lands'],
  },
  {
    phrase: 'calm before the storm',
    suggestions: ['the held breath before impact', 'a room waiting for thunder'],
  },
  {
    phrase: 'needle in a haystack',
    suggestions: ['a spark in warehouse dust', 'one bright thing in all that straw'],
  },
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function detectCliches(text = '') {
  const lowerText = text.toLowerCase();

  return CLICHES.flatMap((entry) => {
    const regex = new RegExp(`\\b${escapeRegExp(entry.phrase)}\\b`, 'g');
    const matches = [...lowerText.matchAll(regex)];

    return matches.map((match) => ({
      phrase: entry.phrase,
      index: match.index,
      suggestions: entry.suggestions,
    }));
  }).sort((left, right) => left.index - right.index);
}

export function detectClichesByLine(lines = []) {
  return lines
    .map((line) => ({
      lineNumber: line.number,
      text: line.text,
      matches: detectCliches(line.text),
    }))
    .filter((line) => line.matches.length);
}
