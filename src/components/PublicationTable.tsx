import { Publication, PublicationType } from '../types';

const typeLabels: Record<PublicationType, string> = {
  journal: 'Journal/Abstract',
  poster: 'Poster',
  oral: 'Oral',
  other: 'Other',
};

type Props = {
  publications: Publication[];
  onChange: (id: string, patch: Partial<Publication>) => void;
};

export function PublicationTable({ publications, onChange }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-500">
            <th className="px-3 py-2">Section</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Authors</th>
            <th className="px-3 py-2">Journal / Event</th>
            <th className="px-3 py-2">Year</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {publications.map((pub) => (
            <tr key={pub.id} className="align-top">
              <td className="px-3 py-2">
                <input
                  className="input"
                  value={pub.section}
                  onChange={(e) => onChange(pub.id, { section: e.target.value })}
                />
              </td>
              <td className="px-3 py-2">
                <select
                  className="input"
                  value={pub.type}
                  onChange={(e) => onChange(pub.id, { type: e.target.value as PublicationType })}
                >
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                <textarea
                  className="input min-w-[260px]"
                  rows={2}
                  value={pub.title}
                  onChange={(e) => onChange(pub.id, { title: e.target.value })}
                />
              </td>
              <td className="px-3 py-2">
                <textarea
                  className="input min-w-[220px]"
                  rows={2}
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
              <td className="px-3 py-2">
                <input
                  className="input min-w-[200px]"
                  value={pub.journalOrEvent}
                  onChange={(e) => onChange(pub.id, { journalOrEvent: e.target.value })}
                />
              </td>
              <td className="px-3 py-2 w-24">
                <input
                  className="input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pub.year ?? ''}
                  onChange={(e) =>
                    onChange(pub.id, {
                      year: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
