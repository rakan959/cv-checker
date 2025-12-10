import { nanoid } from './stringId.js';
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

// Headings that typically mark the end of publications in ERAS-style exports.
const END_SECTION_HEADERS = [
  /^education/i,
  /^training/i,
  /^employment/i,
  /^experience/i,
  /^work experience/i,
  /^certifications?/i,
  /^licenses?/i,
  /^honors?/i,
  /^awards?/i,
  /^memberships?/i,
  /^volunteer/i,
  /^activities/i,
  /^skills/i,
  /^languages/i,
  /^proficient languages/i,
  /^personal statement/i,
  /^essays?/i,
  /^references?/i,
];

const TYPE_RULES: Array<{ match: RegExp; type: PublicationType }> = [
  { match: /poster/i, type: 'poster' },
  { match: /oral/i, type: 'oral' },
  { match: /journal|article|abstract/i, type: 'journal' },
];

const normalizeWhitespace = (text: string) => text.replace(/\r\n?/g, '\n');

// Regex to detect the start of an author list like "Al-Qaqaa R," or "Smith JA,"
const AUTHOR_START = /\b[A-Z][A-Za-z'\-]+\s+[A-Z](?:[A-Z]|\.)?[,]/;

function extractByPattern(body: string, pattern: RegExp): string[] {
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    results.push(match[0].trim());
  }
  return results;
}

// Split the publications block into named sections by headings.
function splitSections(text: string): Array<{ heading: string; body: string }> {
  const headingPattern = /^(Peer Reviewed Journal Articles\/Abstracts|Poster Presentation|Oral Presentation)/i;
  const lines = text.split('\n');

  const parts: Array<{ heading: string; body: string }> = [];
  let currentHeading = 'Publications';
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length) {
      parts.push({ heading: currentHeading, body: buffer.join(' ').trim() });
      buffer = [];
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const headingMatch = trimmed.match(headingPattern);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[1];
    } else {
      buffer.push(trimmed);
    }
  });

  flush();
  return parts;
}

function splitJournalEntries(body: string): string[] {
  const statusSeparator = /Publication Status:[^.]*\./gi;
  const slices: string[] = [];
  let lastIndex = 0;
  while (statusSeparator.exec(body) !== null) {
    const end = statusSeparator.lastIndex;
    const chunk = body.slice(lastIndex, end);
    slices.push(chunk);
    lastIndex = end;
  }

  const statusChunks = slices.filter((c) => c.trim().length > 0);

  const statusPattern = new RegExp(`${AUTHOR_START.source}[^]*?Publication Status:[^.]*\.(?=\s*${AUTHOR_START.source}|$)`, 'gi');
  const withStatus = extractByPattern(body, statusPattern);
  const authorPattern = new RegExp(`${AUTHOR_START.source}[^]*?(?=\s*${AUTHOR_START.source}|$)`, 'gi');
  const byAuthor = extractByPattern(body, authorPattern);

  const chosen =
    statusChunks.length > 1 ? statusChunks : withStatus.length ? withStatus : byAuthor.length ? byAuthor : body.split(/\n+/);

  return chosen
    .map((c) => c.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

// Pull out only the publications block between "Publications" and the next top-level heading.
export function extractPublicationsBlock(raw: string): string {
  const lines = normalizeWhitespace(raw)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (SECTION_HEADERS.some((re) => re.test(lines[i]))) {
      start = i;
      break;
    }
  }
  if (start === -1) return raw; // fallback to full text if no heading found

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (END_SECTION_HEADERS.some((re) => re.test(lines[i]))) {
      end = i;
      break;
    }
  }

  return lines.slice(start, end).join('\n');
}

export function cleanBrokenWords(text: string): string {
  const withoutHyphenBreaks = text.replace(/([A-Za-z])-[\s\n]+([A-Za-z])/g, '$1$2');
  const joinedSoftBreaks = withoutHyphenBreaks.replace(/([A-Za-z])\s+\n\s*([a-z])/g, '$1$2');
  const fixedKnownSplits = joinedSoftBreaks.replace(/Deve\s+loping/gi, 'Developing');
  return fixedKnownSplits.replace(/\s+\n/g, '\n');
}

export function parsePublicationsFromText(raw: string): Publication[] {
  const scoped = extractPublicationsBlock(raw);
  const normalized = cleanBrokenWords(normalizeWhitespace(scoped))
    .replace(/\t/g, ' ')
    // Strip ERAS page headers / footers.
    .replace(/MyERAS Application\s+Page\s+\d+/gi, '')
    // Hard stop if other sections leak in the same page line.
    .split(/\nProficient Languages/i)[0]
    // Keep line structure while trimming extra spaces.
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{2,}/g, '\n');

  const headingBreaker = /(Peer Reviewed Journal Articles\/Abstracts|Poster Presentation|Oral Presentation)(?!:)/gi;
  const normalizedWithHeadings = normalized.replace(headingBreaker, '\n$1\n');

  // Break the publications block into sub-sections by heading, then split entries per section type.
  const sections = splitSections(normalizedWithHeadings);

  const paragraphs: Array<{ section: string; text: string }> = [];

  sections.forEach((section) => {
    const heading = section.heading;
    if (/journal|abstract/i.test(heading)) {
      splitJournalEntries(section.body).forEach((t) => paragraphs.push({ section: heading, text: t }));
    }
    // Posters and oral presentations are intentionally ignored.
  });

  const filtered = paragraphs.filter((paragraph) => /Publication Status:/i.test(paragraph.text));

  const publications: Publication[] = filtered.map((paragraph) => {
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

  const publicationStatusMatch = compact.match(/Publication Status:\s*([^\.]+)\./i);
  const publicationStatus = publicationStatusMatch ? publicationStatusMatch[1].trim() : undefined;

  const stripped = (publicationStatusMatch ? compact.replace(publicationStatusMatch[0], '').trim() : compact).replace(/\s{2,}/g, ' ');
  let remaining = stripped;

  const authorsMatch = remaining.match(/^([^\.]+?)\.\s+(.*)$/);
  let authors: string[] = [];
  if (authorsMatch) {
    const rawAuthors = authorsMatch[1]
      .split(/,|;| and /i)
      .map((a) => a.trim())
      .filter(Boolean);

    const cleaned = rawAuthors
      .map((name) => name.replace(/[^A-Za-z\s]/g, '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    // Keep authors in order; include explicit "et al" to represent remaining authors.
    authors = cleaned;

    remaining = authorsMatch[2].trim();
  }

  const presentationMatch = remaining.match(/^(.*?)(Poster presented:|Oral presentation:)\s*(.*)$/i);
  let title = remaining;
  let journal = remaining;
  if (presentationMatch) {
    const eventPart = presentationMatch[1].trim();
    const titlePart = presentationMatch[3].trim();
    const isOral = /Oral presentation:/i.test(presentationMatch[2]);

    if (isOral) {
      // Oral: research title is before the marker; event is after marker up to the date; drop location/date from title.
      title = eventPart.replace(/\.+$/, '').trim();
      const afterMarker = titlePart.split(/;\s*\d{2}\/\d{2}\/\d{4}/)[0] || titlePart;
      journal = afterMarker.replace(/\.+$/, '').trim();
    } else {
      // Poster: event before marker, title after marker; strip location/date from titlePart.
      const withoutLocation = titlePart
        .replace(/\.\s*[A-Z][^;]*;\s*\d{2}\/\d{2}\/\d{4}\.?/gi, ' ')
        .replace(/\.?\s*[A-Z][^;]*;\s*\d{2}\/\d{2}\/\d{4}.*$/i, '')
        .replace(/\s+Published$/i, '')
        .trim();
      title = withoutLocation || titlePart;
      journal = eventPart.replace(/\.+$/, '').trim();
    }

    title = title.replace(/Deve\s+loping/gi, 'Developing').replace(/\s{2,}/g, ' ').trim();
    journal = journal.replace(/\s{2,}/g, ' ').trim();
  } else {
    const normalizedRemaining = remaining.replace(/\.\s+\./g, '. ').replace(/\s+Published$/i, '').trim();

    const titleMatch = normalizedRemaining.match(/^(.+?)\.\s+(.*)$/);
    if (titleMatch) {
      title = titleMatch[1].trim();
      remaining = titleMatch[2].trim();
    }

    const months = /(January|February|March|April|May|June|July|August|September|October|November|December)/i;
    const remClean = remaining.replace(/\s+Published$/i, '').trim();

    let journalName = remClean.replace(/^[\.\s]+/, '').trim();
    let detail = '';
    const trailingNameMatch = remClean.match(/([A-Z][A-Za-z\s]+)(?:\s*)$/);
    const monthMatch = remClean.match(months);
    if (monthMatch) {
      const monthIdx = monthMatch.index ?? -1;
      if (trailingNameMatch) {
        const name = trailingNameMatch[1].trim();
        const nameIdx = remClean.lastIndexOf(name);
        const detailPart = remClean.slice(0, nameIdx).replace(/^[\.\s]+/, '').replace(/\s+Published$/i, '').trim();
        journalName = name;
        detail = detailPart;
      } else if (monthIdx >= 0) {
        journalName = remClean.slice(0, monthIdx).replace(/^[\.\s]+/, '').replace(/\.+$/, '').trim();
        detail = remClean.slice(monthIdx).trim();
      }
    }
    if (!journalName && trailingNameMatch) {
      journalName = trailingNameMatch[1].trim();
    }
    if (!journalName && remClean) {
      journalName = remClean;
    }

    if (journalName) {
      journal = detail ? `${journalName}. ${detail}` : journalName;
    }
  }

  journal = journal.replace(/\.\s*\./g, '. ').replace(/\s{2,}/g, ' ').trim();

  const yearMatch = compact.match(/(20\d{2}|19\d{2})/);
  const year = yearMatch ? Number(yearMatch[1]) : undefined;

  const typeHint: PublicationType | undefined = /poster presented/i.test(compact)
    ? 'poster'
    : /oral presentation/i.test(compact)
      ? 'oral'
      : undefined;

  return { authors, title, journal, year, publicationStatus, typeHint };
}
