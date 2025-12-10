import { Publication, VerificationResult } from '../types';

type Signature = { last: string; initials: string };

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

// Produce last name + initials, tolerant of middle names and punctuation.
// Accept both "First Last" and "Last F I" forms by detecting 1-char trailing tokens.
function toSignature(name: string): Signature {
  const tokens = normalize(name).split(' ').filter(Boolean);
  if (tokens.length === 0) return { last: '', initials: '' };

  const trailing = tokens[tokens.length - 1];
  const leading = tokens[0];

  if (trailing.length === 1 && tokens.length >= 2) {
    const last = leading;
    const initials = tokens.slice(1).map((t) => t[0]).join('');
    return { last, initials };
  }

  const last = trailing;
  const initials = tokens.slice(0, -1).map((t) => t[0]).join('');
  return { last, initials };
}

function signaturesMatch(a: Signature, b: Signature): boolean {
  if (!a.last || !b.last) return false;
  if (a.last !== b.last) return false;
  if (!a.initials || !b.initials) return true;
  return a.initials.startsWith(b.initials) || b.initials.startsWith(a.initials);
}

function isEtAl(author: string): boolean {
  return /\bet\s*al\.?/i.test(author);
}

function authorsAlign(cvAuthors: string[], externalAuthors: string[]): boolean {
  const externalSigs = externalAuthors.map(toSignature);

  // CV must start from first external author.
  if (externalSigs.length === 0 && cvAuthors.length > 0) return false;

  for (let i = 0; i < cvAuthors.length; i += 1) {
    const cvAuthor = cvAuthors[i];
    if (isEtAl(cvAuthor)) return true; // remaining authors implied

    const cvSig = toSignature(cvAuthor);
    const extSig = externalSigs[i];
    if (!extSig) return false;
    if (!signaturesMatch(cvSig, extSig)) return false;
  }

  // If CV list ends early without et al, still acceptable; must maintain order from first author.
  return true;
}

export function verifyPublication(
  publication: Publication,
  externalAuthors: string[],
): VerificationResult {
  const authorListsAlign = authorsAlign(publication.authors, externalAuthors);

  if (externalAuthors.length === 0) {
    return {
      authorship: 'unknown',
      position: 'unknown',
      status: 'warning',
      details: 'No external author data to verify.',
    };
  }

  if (authorListsAlign) {
    return {
      authorship: 'match',
      position: 'match',
      status: 'good',
      details: 'CV authors align with external list.',
    };
  }

  return {
    authorship: 'mismatch',
    position: 'mismatch',
    status: 'bad',
    details: 'CV authors do not match external list.',
  };
}
