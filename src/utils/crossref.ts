import { CrossrefCandidate, Publication } from '../types';
import { similarityScore, yearProximityScore } from './fuzzy';
import { nanoid } from './stringId';

const CROSSREF_ENDPOINT = 'https://api.crossref.org/works';

export async function searchCrossref(publication: Publication): Promise<CrossrefCandidate[]> {
  const queryParts = [publication.title, publication.journalOrEvent, publication.year ?? ''];
  const query = encodeURIComponent(queryParts.filter(Boolean).join(' '));
  const url = `${CROSSREF_ENDPOINT}?query.bibliographic=${query}&rows=5`; // CORS-friendly

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Crossref request failed: ${response.status}`);
  }
  const data = await response.json();

  const items: any[] = data?.message?.items ?? [];
  const candidates: CrossrefCandidate[] = items.map((item) => {
    const title = Array.isArray(item.title) ? item.title[0] : item.title ?? '';
    const journal = Array.isArray(item['container-title']) ? item['container-title'][0] : item['container-title'];
    const authors = Array.isArray(item.author)
      ? item.author
          .map((a: any) => [a.given, a.family].filter(Boolean).join(' ').trim())
          .filter(Boolean)
      : [];
    const year = item['published-print']?.['date-parts']?.[0]?.[0] || item['published-online']?.['date-parts']?.[0]?.[0];

    const titleScore = similarityScore(publication.title, title ?? '');
    const journalScore = similarityScore(publication.journalOrEvent, journal ?? '');
    const yearScore = yearProximityScore(publication.year, year);
    const compositeScore = Number((titleScore * 0.6 + journalScore * 0.25 + yearScore * 0.15).toFixed(3));

    return {
      id: nanoid(),
      doi: item.DOI,
      title: title ?? '',
      authors,
      journal: journal ?? '',
      year,
      score: compositeScore,
      source: 'Crossref',
    };
  });

  return candidates.sort((a, b) => b.score - a.score);
}

export function pickBestCandidate(candidates: CrossrefCandidate[]): CrossrefCandidate | undefined {
  if (candidates.length === 0) return undefined;
  const [first, second] = candidates;
  if (!second) return first;
  return first.score - (second.score ?? 0) > 0.1 ? first : undefined;
}
