import React, { useMemo, useState } from 'react';
import { Stepper } from './components/Stepper';
import { PublicationTable } from './components/PublicationTable';
import { parsePublicationsFromText } from './utils/parseText';
import { extractTextFromPdf } from './utils/pdf';
import { searchCrossref, pickBestCandidate } from './utils/crossref';
import { exportCsv, exportHtml } from './utils/exporters';
import { verifyPublication, UserProfile } from './utils/verify';
import { Publication, VerificationResult } from './types';

const steps = [
  { label: 'Input', description: 'Paste text or upload PDF' },
  { label: 'Identity', description: 'Who are we looking for?' },
  { label: 'Match', description: 'Crossref suggestions' },
  { label: 'Verify', description: 'Authorship + position' },
  { label: 'Report', description: 'Export & share' },
];

function useVerification(publications: Publication[], user: UserProfile) {
  return useMemo(() => {
    const verification: Record<string, VerificationResult> = {};
    publications.forEach((pub) => {
      const selected = pub.match?.candidates.find((c) => c.id === pub.match?.selectedId);
      if (!selected) return;
      verification[pub.id] = verifyPublication(pub, selected.authors, user);
    });
    return verification;
  }, [publications, user]);
}

export default function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [inputText, setInputText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [matchProgress, setMatchProgress] = useState('');
  const [publications, setPublications] = useState<Publication[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>({ fullName: '', variants: [] });

  const verification = useVerification(publications, userProfile);

  const summary = useMemo(() => {
    let good = 0;
    let warning = 0;
    let bad = 0;
    publications.forEach((pub) => {
      const status = verification[pub.id]?.status;
      if (status === 'good') good += 1;
      else if (status === 'warning') warning += 1;
      else if (status === 'bad') bad += 1;
    });
    const total = publications.length;
    const unmatched = total - (good + warning + bad);
    return { good, warning, bad, unmatched, total };
  }, [publications, verification]);

  const handleParse = (source: string) => {
    setIsParsing(true);
    setTimeout(() => {
      const parsed = parsePublicationsFromText(source);
      setPublications(parsed);
      setIsParsing(false);
    }, 50);
  };

  const handlePdfUpload = async (file?: File | null) => {
    if (!file) return;
    setIsParsing(true);
    try {
      const text = await extractTextFromPdf(file);
      const parsed = parsePublicationsFromText(text);
      setPublications(parsed);
      setInputText(text);
    } catch (error) {
      console.error(error);
      alert('Could not read that PDF. Please ensure it is not password protected.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleUpdatePublication = (id: string, patch: Partial<Publication>) => {
    setPublications((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const handleSearchCrossref = async () => {
    setIsMatching(true);
    setMatchProgress('Starting Crossref lookup...');

    const updated: Publication[] = [];
    for (let i = 0; i < publications.length; i += 1) {
      const pub = publications[i];
      setMatchProgress(`Searching ${i + 1}/${publications.length}: ${pub.title.slice(0, 60)}...`);
      try {
        const candidates = await searchCrossref(pub);
        const auto = pickBestCandidate(candidates);
        updated.push({
          ...pub,
          match: {
            candidates,
            selectedId: auto?.id,
            autoSelected: Boolean(auto),
          },
        });
      } catch (err) {
        console.error(err);
        updated.push({ ...pub, match: { candidates: [], selectedId: undefined } });
      }
    }

    setPublications(updated);
    setIsMatching(false);
    setMatchProgress('');
  };

  const selectedCandidate = (pub: Publication) => pub.match?.candidates.find((c) => c.id === pub.match?.selectedId);

  const handleSelectCandidate = (pubId: string, candidateId: string) => {
    setPublications((prev) =>
      prev.map((p) =>
        p.id === pubId
          ? {
              ...p,
              match: {
                candidates: p.match?.candidates ?? [],
                selectedId: candidateId,
              },
            }
          : p,
      ),
    );
  };

  const canProceed = (step: number) => {
    if (step === 0) return publications.length > 0;
    if (step === 1) return Boolean(userProfile.fullName.trim());
    if (step === 2) return publications.every((p) => (p.match?.candidates.length ?? 0) > 0);
    return true;
  };

  const renderMatchCard = (pub: Publication) => {
    const candidates = pub.match?.candidates ?? [];
    return (
      <div key={pub.id} className="card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase text-slate-500">CV entry</div>
            <div className="font-semibold text-slate-900">{pub.title}</div>
            <div className="text-sm text-slate-600">{pub.authors.join(', ')}</div>
            <div className="text-sm text-slate-500">{pub.journalOrEvent}</div>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{pub.type}</span>
        </div>

        {candidates.length === 0 && (
          <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
            No Crossref candidates yet. Try adjusting the title or year.
          </div>
        )}

        {candidates.length > 0 && (
          <div className="mt-3 space-y-3">
            {candidates.slice(0, 3).map((c) => {
              const isSelected = pub.match?.selectedId === c.id;
              return (
                <label
                  key={c.id}
                  className={`flex w-full cursor-pointer gap-3 rounded-xl border px-3 py-2 transition ${
                    isSelected ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-brand-200'
                  }`}
                >
                  <input
                    type="radio"
                    className="mt-1"
                    name={`candidate-${pub.id}`}
                    checked={isSelected}
                    onChange={() => handleSelectCandidate(pub.id, c.id)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-slate-900">{c.title}</div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {Math.round(c.score * 100)}%
                      </span>
                    </div>
                    <div className="text-sm text-slate-600">{c.authors.join(', ')}</div>
                    <div className="text-sm text-slate-500">{c.journal}</div>
                    <div className="text-xs text-slate-500">{c.year ?? 'Year n/a'}</div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderVerificationRow = (pub: Publication) => {
    const result = verification[pub.id];
    const external = selectedCandidate(pub);
    const badgeColor =
      result?.status === 'good' ? 'bg-green-100 text-green-800' : result?.status === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800';
    return (
      <div key={pub.id} className="card p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase text-slate-500">CV entry</div>
            <div className="font-semibold text-slate-900">{pub.title}</div>
            <div className="text-sm text-slate-600">{pub.authors.join(', ')}</div>
            <div className="text-sm text-slate-500">{pub.journalOrEvent}</div>
          </div>
          <div className={`self-start rounded-full px-3 py-1 text-xs font-semibold ${badgeColor}`}>
            {result?.status ?? 'unverified'}
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs uppercase text-slate-500">CV authors</div>
            <div className="text-sm text-slate-700">{pub.authors.join(', ') || '—'}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs uppercase text-slate-500">External authors</div>
            <div className="text-sm text-slate-700">{external?.authors.join(', ') || '—'}</div>
          </div>
        </div>
        <div className="mt-2 text-sm text-slate-600">{result?.details ?? 'No candidate selected yet.'}</div>
      </div>
    );
  };

  const goToStep = (step: number) => setCurrentStep(step);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">CV publication checker</div>
            <div className="text-xl font-semibold text-slate-900">Trust but verify your ERAS publications</div>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <div className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
              <span>Verified</span>
              <span className="text-green-600">{summary.good}</span>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
              <span>Issues</span>
              <span className="text-amber-600">{summary.warning + summary.bad}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-6 pb-20">
        <Stepper steps={steps} current={currentStep} />

        <section className="card p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Step 1: Add your publications</h2>
              <p className="text-sm text-slate-600">Paste the publications section or upload your ERAS PDF export.</p>
            </div>
            <div className="flex gap-2">
              <button className="button-secondary" onClick={() => goToStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0}>
                Back
              </button>
              <button className="button-primary" onClick={() => goToStep(Math.min(4, currentStep + 1))} disabled={!canProceed(currentStep)}>
                Next
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[2fr,1fr]">
            <div>
              <label className="label">Paste publications</label>
              <textarea
                className="input mt-1 h-48 w-full resize-vertical"
                placeholder="Paste your publications section here..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <div className="mt-2 flex gap-2">
                <button className="button-primary" onClick={() => handleParse(inputText)} disabled={isParsing || !inputText.trim()}>
                  {isParsing ? 'Parsing…' : 'Parse text'}
                </button>
                <label className="button-secondary cursor-pointer" htmlFor="pdf-upload">
                  Upload ERAS PDF
                  <input
                    id="pdf-upload"
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => handlePdfUpload(e.target.files?.[0])}
                  />
                </label>
              </div>
              <p className="helper mt-1">Handles wrapped lines, hyphen breaks, and common ERAS headings.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 shadow-inner">
              <div className="font-semibold text-slate-900">Tips</div>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-slate-600">
                <li>Works best with ERAS exports that include headings (Publications, Poster Presentation, etc.).</li>
                <li>Clean up typos to improve matching accuracy.</li>
                <li>You can edit any row after parsing.</li>
              </ul>
            </div>
          </div>

          {publications.length > 0 && (
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-800">Detected publications ({publications.length})</div>
                <button className="button-secondary" onClick={() => setPublications([])}>
                  Clear all
                </button>
              </div>
              <PublicationTable publications={publications} onChange={handleUpdatePublication} />
            </div>
          )}
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Step 2: Who is the CV owner?</h2>
              <p className="text-sm text-slate-600">Provide the full name and common variants (initials, maiden names).</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Full name</label>
              <input
                className="input mt-1"
                placeholder="e.g., Rakan Al-Qaqaa"
                value={userProfile.fullName}
                onChange={(e) => setUserProfile((u) => ({ ...u, fullName: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Name variants</label>
              <textarea
                className="input mt-1"
                rows={3}
                placeholder="Al-Qaqaa R\nRakan A\nR Al-Qaqaa"
                value={userProfile.variants.join('\n')}
                onChange={(e) => setUserProfile((u) => ({ ...u, variants: e.target.value.split(/\n/).map((v) => v.trim()).filter(Boolean) }))}
              />
              <p className="helper mt-1">Use one variant per line. Include initials the way they appear in publications.</p>
            </div>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Step 3: Match with Crossref</h2>
              <p className="text-sm text-slate-600">We search Crossref by title, journal, and year. Adjust entries to improve matches.</p>
            </div>
            <div className="flex gap-2">
              <button className="button-secondary" onClick={() => handleSearchCrossref()} disabled={isMatching || publications.length === 0}>
                {isMatching ? 'Searching…' : 'Search all'}
              </button>
            </div>
          </div>
          {matchProgress && <div className="mt-2 text-sm text-slate-600">{matchProgress}</div>}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {publications.map(renderMatchCard)}
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Step 4: Verify authorship & position</h2>
              <p className="text-sm text-slate-600">Green means authorship + position match. Yellow is partial. Red means not found.</p>
            </div>
            <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
              {summary.good} verified · {summary.warning} partial · {summary.bad} mismatched · {summary.unmatched} unassigned
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {publications.length === 0 && <div className="text-sm text-slate-600">No publications loaded yet.</div>}
            {publications.map(renderVerificationRow)}
          </div>
        </section>

        <section className="card p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Step 5: Export report</h2>
              <p className="text-sm text-slate-600">Download as CSV or a shareable HTML report.</p>
            </div>
            <div className="flex gap-2">
              <button className="button-secondary" onClick={() => exportCsv(publications, verification, selectedCandidate)} disabled={publications.length === 0}>
                Export CSV
              </button>
              <button className="button-primary" onClick={() => exportHtml(publications, verification, selectedCandidate)} disabled={publications.length === 0}>
                Export HTML report
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
