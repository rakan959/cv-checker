import { useMemo, useState } from 'react';
import { PublicationTable } from './components/PublicationTable';
import { parsePublicationsFromText, extractPublicationsBlock } from './utils/parseText';
import { extractTextFromPdf } from './utils/pdf';
import { searchCrossref, pickBestCandidate } from './utils/crossref';
import { exportCsv, exportHtml } from './utils/exporters';
import { verifyPublication } from './utils/verify';
import { Publication, VerificationResult } from './types';

function useVerification(publications: Publication[]) {
  return useMemo(() => {
    const verification: Record<string, VerificationResult> = {};
    publications.forEach((pub) => {
      const selected = pub.match?.candidates.find((c) => c.id === pub.match?.selectedId);
      if (!selected) return;
      verification[pub.id] = verifyPublication(pub, selected.authors);
    });
    return verification;
  }, [publications]);
}

export default function App() {
  const [inputText, setInputText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [matchProgress, setMatchProgress] = useState('');
  const [publications, setPublications] = useState<Publication[]>([]);
  const verification = useVerification(publications);

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

  const handlePdfUploads = async (files?: FileList | null) => {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;

    setIsParsing(true);
    const allParsed: Publication[] = [];
    const collectedTexts: string[] = [];

    for (const file of list) {
      try {
        const fullText = await extractTextFromPdf(file);
        const scopedText = extractPublicationsBlock(fullText);
        const parsed = parsePublicationsFromText(scopedText);
        allParsed.push(...parsed);
        collectedTexts.push(scopedText);
      } catch (error) {
        console.error(error);
        alert(`Could not read ${file.name}. Please ensure it is not password protected.`);
      }
    }

    if (allParsed.length > 0) {
      setPublications((prev) => [...prev, ...allParsed]);
    }

    if (collectedTexts.length > 0) {
      const combined = collectedTexts.join('\n\n');
      setInputText((prev) => (prev ? `${prev}\n\n${combined}` : combined));
    }

    try {
      if (allParsed.length > 0) {
        await handleSearchCrossref(allParsed);
      }
    } finally {
      setIsParsing(false);
    }
  };

  const handleUpdatePublication = (id: string, patch: Partial<Publication>) => {
    setPublications((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const handleSearchCrossref = async (list?: Publication[]) => {
    const source = list ?? publications;
    if (source.length === 0) return;

    setIsMatching(true);
    setMatchProgress('Starting Crossref lookup...');

    const updated: Publication[] = [];
    for (let i = 0; i < source.length; i += 1) {
      const pub = source[i];
      setMatchProgress(`Searching ${i + 1}/${source.length}: ${pub.title.slice(0, 60)}...`);
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

    setPublications((prev) => {
      const merged = [...prev];
      updated.forEach((u) => {
        const idx = merged.findIndex((p) => p.id === u.id);
        if (idx >= 0) merged[idx] = u;
        else merged.push(u);
      });
      return merged;
    });

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

  

  const renderMatchCard = (pub: Publication) => {
    const candidates = pub.match?.candidates ?? [];
    return (
      <div key={pub.id} className="card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs uppercase text-slate-300">CV entry</div>
            <div className="font-semibold text-slate-50">{pub.title}</div>
            <div className="text-sm text-slate-100">{pub.authors.join(', ')}</div>
            <div className="text-sm text-slate-200">{pub.journalOrEvent}</div>
          </div>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100">{pub.type}</span>
        </div>

        {candidates.length === 0 && (
          <div className="mt-3 rounded-lg border border-dashed border-slate-800 bg-slate-950 p-3 text-sm text-slate-200">
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
                    isSelected ? 'border-brand-400 bg-brand-400/10' : 'border-slate-700 hover:border-brand-300'
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
                      <div className="font-semibold text-slate-100">{c.title}</div>
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-100">
                        {Math.round(c.score * 100)}%
                      </span>
                    </div>
                    <div className="text-sm text-slate-200">{c.authors.join(', ')}</div>
                    <div className="text-sm text-slate-300">{c.journal}</div>
                    <div className="text-xs text-slate-400">{c.year ?? 'Year n/a'}</div>
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
      result?.status === 'good'
        ? 'bg-green-900/60 text-green-100'
        : result?.status === 'warning'
          ? 'bg-amber-900/60 text-amber-100'
          : 'bg-rose-900/60 text-rose-100';
    return (
      <div key={pub.id} className="card p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-xs uppercase text-slate-400">CV entry</div>
            <div className="font-semibold text-slate-100">{pub.title}</div>
            <div className="text-sm text-slate-200">{pub.authors.join(', ')}</div>
            <div className="text-sm text-slate-400">{pub.journalOrEvent}</div>
          </div>
            <div className={`self-start rounded-full px-3 py-1 text-xs font-semibold ${badgeColor}`}>
            {result?.status ?? 'unverified'}
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs uppercase text-slate-400">CV authors</div>
            <div className="text-sm text-slate-100">{pub.authors.join(', ') || '—'}</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs uppercase text-slate-400">External authors</div>
            <div className="text-sm text-slate-100">{external?.authors.join(', ') || '—'}</div>
          </div>
        </div>
        <div className="mt-2 text-sm text-slate-200">{result?.details ?? 'No candidate selected yet.'}</div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-2xl font-semibold text-slate-100">CV Publication Checker</div>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <div className="flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1 font-semibold text-slate-200">
              <span>Verified</span>
              <span className="text-green-600">{summary.good}</span>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1 font-semibold text-slate-200">
              <span>Issues</span>
              <span className="text-amber-400">{summary.warning + summary.bad}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-6 pb-20">
        <section className="card p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Step 1: Add publications</h2>
              <p className="text-sm text-slate-300">Paste the publications section or upload an ERAS PDF export.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[2fr,1fr]">
            <div>
              <label className="label">Paste publications</label>
              <textarea
                className="input mt-1 h-48 w-full resize-vertical"
                placeholder="Paste publications section here..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <div className="mt-2 flex gap-2">
                <button className="button-primary" onClick={() => handleParse(inputText)} disabled={isParsing || !inputText.trim()}>
                  {isParsing ? 'Parsing…' : 'Parse text'}
                </button>
                <label className="button-secondary cursor-pointer" htmlFor="pdf-upload">
                  Upload ERAS PDFs
                  <input
                    id="pdf-upload"
                    type="file"
                    accept="application/pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => handlePdfUploads(e.target.files)}
                  />
                </label>
              </div>
              <p className="helper mt-1">Handles wrapped lines, hyphen breaks, and common ERAS headings.</p>
              <p className="helper mt-1">
                Processing stays in your browser; PDFs never leave your device. We only call the public Crossref API to fetch
                matching articles.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200 shadow-inner">
              <div className="font-semibold text-slate-100">Tips</div>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-slate-300">
                <li>Works best with ERAS exports that include headings (Publications, Poster Presentation, etc.).</li>
                <li>Clean up typos to improve matching accuracy.</li>
                <li>You can edit any row after parsing.</li>
              </ul>
            </div>
          </div>

          {publications.length > 0 && (
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-100">Detected publications ({publications.length})</div>
                <button className="button-secondary" onClick={() => setPublications([])}>
                  Clear all
                </button>
              </div>
              <PublicationTable publications={publications} onChange={handleUpdatePublication} />
            </div>
          )}
        </section>

        <section className="card p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Step 2: Match with Crossref</h2>
              <p className="text-sm text-slate-300">We search Crossref by title, journal, and year. Adjust entries to improve matches.</p>
            </div>
            <div className="flex gap-2">
              <button className="button-secondary" onClick={() => handleSearchCrossref()} disabled={isMatching || publications.length === 0}>
                {isMatching ? 'Searching…' : 'Search all'}
              </button>
            </div>
          </div>
          {matchProgress && <div className="mt-2 text-sm text-slate-300">{matchProgress}</div>}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {publications.map(renderMatchCard)}
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Step 3: Verify authorship & position</h2>
              <p className="text-sm text-slate-300">Green means authorship + position match. Yellow is partial. Red means not found.</p>
            </div>
            <div className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100">
              {summary.good} verified · {summary.warning} partial · {summary.bad} mismatched · {summary.unmatched} unassigned
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {publications.length === 0 && <div className="text-sm text-slate-300">No publications loaded yet.</div>}
            {publications.map(renderVerificationRow)}
          </div>
        </section>

        <section className="card p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Step 4: Export report</h2>
              <p className="text-sm text-slate-300">Download as CSV or a shareable HTML report.</p>
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
