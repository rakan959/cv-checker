import { nanoid } from './stringId';
import { Publication, PublicationType } from '../types';

const SECTION_HEADERS = [
  /publications/i,
  /peer reviewed journal/i,
  /journal articles/i,
  /abstracts/i,
  /poster presentation/i,
  /oral presentation/i,
  /presentations/i,
  /books?/i,
];

const TYPE_RULES: Array<{ match: RegExp; type: PublicationType }> = [
  { match: /poster/i, type: 'poster' },
  { match: /oral/i, type: 'oral' },
  { match: /journal|article|abstract/i, type: 'journal' },
];

const normalizeWhitespace = (text: string) => text.replace(/\r\n?/g, '\n');

export function cleanBrokenWords(text: string): string {
  const withoutHyphenBreaks = text.replace(/([A-Za-z])-[\s\n]+([A-Za-z])/g, '$1$2');
  return withoutHyphenBreaks.replace(/\s+\n/g, '\n');
}

export function parsePublicationsFromText(raw: string): Publication[] {
  const normalized = cleanBrokenWords(normalizeWhitespace(raw)).replace(/\t/g, ' ');
  const lines = normalized.split('\n');

  let currentSection = 'Publications';
  const paragraphs: Array<{ section: string; text: string }> = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const text = buffer.join(' ').trim();
    if (text.length > 0) {
      paragraphs.push({ section: currentSection, text });
    }
    buffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      flush();
      continue;
    }

    if (SECTION_HEADERS.some((re) => re.test(trimmed))) {
      currentSection = trimmed;
      flush();
      continue;
    }

    buffer.push(trimmed);
  }
  flush();

  const publications: Publication[] = paragraphs.map((paragraph) => {
    const parsed = extractFields(paragraph.text);
    const type = inferType(paragraph.section, parsed.typeHint);
    return {
      id: nanoid(),
      rawText: paragraph.text,
      section: paragraph.section,
      type,
      title: parsed.title,
      authors: parsed.authors,
      journalOrEvent: parsed.journal,
      year: parsed.year,
      publicationStatus: parsed.publicationStatus,
    };
  });

  return publications;
}

function inferType(section: string, hint?: PublicationType): PublicationType {
  if (hint) return hint;
  for (const rule of TYPE_RULES) {
    if (rule.match.test(section)) return rule.type;
  }
  return 'other';
}

function extractFields(text: string): {
  authors: string[];
  title: string;
  journal: string;
  year?: number;
  publicationStatus?: string;
  typeHint?: PublicationType;
} {
  const compact = text.replace(/\s+/g, ' ').trim();
  let remaining = compact;

  const publicationStatusMatch = compact.match(/Publication Status:\s*([^\.]+)\./i);
  const publicationStatus = publicationStatusMatch ? publicationStatusMatch[1].trim() : undefined;

  const authorsMatch = remaining.match(/^([^\.]+?)\.\s+(.*)$/);
  let authors: string[] = [];
  if (authorsMatch) {
    authors = authorsMatch[1]
      .split(/,|;| and /i)
      .map((a) => a.trim())
      .filter(Boolean);
    remaining = authorsMatch[2].trim();
  }

  const titleMatch = remaining.match(/^(.+?)\.\s+(.*)$/);
  let title = remaining;
  if (titleMatch) {
    title = titleMatch[1].trim();
    remaining = titleMatch[2].trim();
  }

  const journalMatch = remaining.match(/^([^\.]+?)\.\s*(.*)$/);
  let journal = remaining;
  if (journalMatch) {
    journal = journalMatch[1].trim();
    remaining = journalMatch[2].trim();
  }

  const yearMatch = compact.match(/(20\d{2}|19\d{2})/);
  const year = yearMatch ? Number(yearMatch[1]) : undefined;

  const typeHint: PublicationType | undefined = /poster presented/i.test(compact)
    ? 'poster'
    : /oral presentation/i.test(compact)
      ? 'oral'
      : undefined;

  return { authors, title, journal, year, publicationStatus, typeHint };
}
