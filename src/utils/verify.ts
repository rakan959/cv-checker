import { Publication, VerificationResult } from '../types';

export type UserProfile = {
  fullName: string;
  variants: string[];
};

type Signature = { last: string; initials: string };

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

function toSignature(name: string): Signature {
  const tokens = normalize(name).split(' ').filter(Boolean);
  if (tokens.length === 0) return { last: '', initials: '' };
  const last = tokens[tokens.length - 1];
  const initials = tokens.slice(0, -1).map((t) => t[0]).join('');
  return { last, initials };
}

function authorIndex(authors: string[], signatures: Signature[]): number {
  for (let i = 0; i < authors.length; i += 1) {
    const sig = toSignature(authors[i]);
    if (sig.last.length === 0) continue;
    const match = signatures.find(
      (s) => s.last === sig.last && (s.initials === '' || sig.initials.startsWith(s.initials) || s.initials.startsWith(sig.initials)),
    );
    if (match) return i;
  }
  return -1;
}

export function verifyPublication(
  publication: Publication,
  externalAuthors: string[],
  user: UserProfile,
): VerificationResult {
  const signatures: Signature[] = [user.fullName, ...user.variants].filter(Boolean).map(toSignature);

  const cvIndex = authorIndex(publication.authors, signatures);
  const externalIndex = authorIndex(externalAuthors, signatures);

  if (externalAuthors.length === 0) {
    return {
      authorship: 'unknown',
      position: 'unknown',
      status: 'warning',
      details: 'No external author data to verify.',
    };
  }

  if (externalIndex === -1) {
    return {
      authorship: 'mismatch',
      position: 'mismatch',
      status: 'bad',
      details: 'Name not found in external author list.',
    };
  }

  const positionMatch = cvIndex === -1 || cvIndex === externalIndex;

  return {
    authorship: 'match',
    position: positionMatch ? 'match' : 'mismatch',
    status: positionMatch ? 'good' : 'warning',
    details: positionMatch
      ? 'Authorship and position align.'
      : `Authorship found, but position differs (CV: ${cvIndex + 1 || 'n/a'}, external: ${externalIndex + 1}).`,
  };
}
