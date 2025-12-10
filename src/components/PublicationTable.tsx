import { Publication } from '../types';

type Props = {
  publications: Publication[];
  onChange: (id: string, patch: Partial<Publication>) => void;
};

export function PublicationTable({ publications, onChange }: Props) {
  const MONTH_PATTERN = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i;

  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const parseJournal = (value: string) => {
    const base = (value || '').trim();
    const [leftRaw, ...rest] = base.split(';');
    const details = rest.join(';').trim();

    const left = leftRaw ? leftRaw.trim() : '';
    const parts = left.split('.').map((p) => p.trim()).filter(Boolean);

    let journal = parts.join('. ');
    let monthYear = '';

    if (parts.length >= 2 && MONTH_PATTERN.test(parts[parts.length - 1])) {
      monthYear = parts[parts.length - 1];
      journal = parts.slice(0, -1).join('. ');
    }

    return { journal, monthYear, details };
  };

  const composeJournal = (journal: string, monthYear: string, details: string) => {
    const parts = [journal.trim(), monthYear.trim()].filter(Boolean);
    let combined = parts.join('. ');
    if (details.trim()) combined = `${combined}${combined ? '; ' : ''}${details.trim()}`;
    return combined.trim();
  };

  return (
    <div className="space-y-3">
      {publications.map((pub, idx) => {
        const { journal, monthYear, details } = parseJournal(pub.journalOrEvent);
        return (
          <div key={pub.id} className="rounded border border-slate-800 bg-slate-900 shadow-sm">
            <div className="border-b border-slate-800 bg-slate-800 px-3 py-2 text-xs font-semibold uppercase text-slate-300">
              Publication {idx + 1}
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-800 text-slate-100">
                <tr className="align-top">
                  <td className="px-3 py-2" colSpan={2}>
                    <div className="text-[11px] uppercase text-slate-400">Title</div>
                    <textarea
                      className="input w-full resize-none overflow-hidden bg-slate-950"
                      rows={1}
                      ref={autoResize}
                      onInput={(e) => autoResize(e.currentTarget)}
                      value={pub.title}
                      onChange={(e) => onChange(pub.id, { title: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-[11px] uppercase text-slate-400">Authors</div>
                    <textarea
                      className="input w-full resize-none overflow-hidden bg-slate-950"
                      rows={1}
                      ref={autoResize}
                      onInput={(e) => autoResize(e.currentTarget)}
                      value={pub.authors.join(', ')}
                      onChange={(e) =>
                        onChange(pub.id, {
                          authors: e.target.value
                            .split(/,|;|\nand /i)
                            .map((a) => a.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </td>
                </tr>
                <tr className="align-top">
                  <td className="px-3 py-2">
                    <div className="text-[11px] uppercase text-slate-400">Journal</div>
                    <input
                      className="input w-full bg-slate-950"
                      value={journal}
                      onChange={(e) =>
                        onChange(pub.id, {
                          journalOrEvent: composeJournal(e.target.value, monthYear, details),
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-[11px] uppercase text-slate-400">Pages / Volume</div>
                    <input
                      className="input w-full bg-slate-950"
                      value={details}
                      placeholder="e.g., 144(Suppl 2):A12971"
                      onChange={(e) =>
                        onChange(pub.id, {
                          journalOrEvent: composeJournal(journal, monthYear, e.target.value),
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-[11px] uppercase text-slate-400">Month / Year</div>
                    <input
                      className="input w-full bg-slate-950"
                      value={monthYear || (pub.year ? `${pub.year}` : '')}
                      placeholder="e.g., November 2021"
                      onChange={(e) => {
                        const text = e.target.value;
                        const yearMatch = text.match(/(20\d{2}|19\d{2})/);
                        const newYear = yearMatch ? Number(yearMatch[1]) : undefined;
                        onChange(pub.id, {
                          journalOrEvent: composeJournal(journal, text, details),
                          year: newYear,
                        });
                      }}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
