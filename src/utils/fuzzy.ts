const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (value: string) => normalize(value).split(' ').filter(Boolean);

export function similarityScore(a: string, b: string): number {
  if (!a || !b) return 0;
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const intersection = [...setA].filter((t) => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size || 1;
  const jaccard = intersection / union;

  const charDice = diceCoefficient(normalize(a), normalize(b));

  return Number((jaccard * 0.6 + charDice * 0.4).toFixed(3));
}

function diceCoefficient(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const bigrams = (text: string) => {
    const grams: Record<string, number> = {};
    for (let i = 0; i < text.length - 1; i += 1) {
      const gram = text.slice(i, i + 2);
      grams[gram] = (grams[gram] ?? 0) + 1;
    }
    return grams;
  };

  const gramsA = bigrams(a);
  const gramsB = bigrams(b);
  let intersection = 0;

  for (const gram in gramsA) {
    if (gramsB[gram]) {
      intersection += Math.min(gramsA[gram], gramsB[gram]);
    }
  }

  return (2 * intersection) / (a.length - 1 + b.length - 1);
}

export function yearProximityScore(expected?: number, actual?: number): number {
  if (!expected || !actual) return 0.4; // neutral-ish score when missing data
  const diff = Math.abs(expected - actual);
  if (diff === 0) return 1;
  if (diff === 1) return 0.8;
  if (diff === 2) return 0.6;
  if (diff <= 4) return 0.4;
  return 0.2;
}
