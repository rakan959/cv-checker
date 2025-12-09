export type PublicationType = 'journal' | 'poster' | 'oral' | 'other';

export type Publication = {
  id: string;
  rawText: string;
  section: string;
  type: PublicationType;
  title: string;
  authors: string[];
  journalOrEvent: string;
  year?: number;
  publicationStatus?: string;
  match?: PublicationMatch;
};

export type CrossrefCandidate = {
  id: string;
  doi?: string;
  title: string;
  authors: string[];
  journal?: string;
  year?: number;
  score: number;
  source: string;
};

export type PublicationMatch = {
  candidates: CrossrefCandidate[];
  selectedId?: string;
  autoSelected?: boolean;
};

export type VerificationResult = {
  authorship: 'match' | 'mismatch' | 'unknown';
  position: 'match' | 'mismatch' | 'unknown';
  status: 'good' | 'warning' | 'bad';
  details: string;
};
