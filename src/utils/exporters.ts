import { Publication, VerificationResult, CrossrefCandidate } from '../types';

const escapeCsv = (value: string | number | undefined | null) => {
  const str = value === undefined || value === null ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const downloadText = (filename: string, text: string, mime = 'text/plain') => {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export function exportCsv(
  publications: Publication[],
  verification: Record<string, VerificationResult>,
  selected: (pub: Publication) => CrossrefCandidate | undefined,
) {
  const headers = [
    'Section',
    'Type',
    'Title',
    'Authors (CV)',
    'Journal/Event (CV)',
    'Year (CV)',
    'External Title',
    'External Authors',
    'External Journal',
    'External Year',
    'Authorship Status',
    'Position Status',
    'Overall Status',
    'Details',
  ];

  const rows = publications.map((pub) => {
    const result = verification[pub.id];
    const external = selected(pub);
    return [
      pub.section,
      pub.type,
      pub.title,
      pub.authors.join('; '),
      pub.journalOrEvent,
      pub.year ?? '',
      external?.title ?? '',
      external?.authors.join('; ') ?? '',
      external?.journal ?? '',
      external?.year ?? '',
      result?.authorship ?? '',
      result?.position ?? '',
      result?.status ?? '',
      result?.details ?? '',
    ];
  });

  const csv = [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
  downloadText('cv-checker-report.csv', csv, 'text/csv');
}

export function exportHtml(
  publications: Publication[],
  verification: Record<string, VerificationResult>,
  selected: (pub: Publication) => CrossrefCandidate | undefined,
) {
  const rows = publications
    .map((pub) => {
      const result = verification[pub.id];
      const external = selected(pub);
      const badgeColor =
        result?.status === 'good' ? '#16a34a' : result?.status === 'warning' ? '#f59e0b' : '#dc2626';
      return `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 12px;">${pub.title}</td>
        <td style="padding:8px 12px;">${pub.authors.join(', ')}</td>
        <td style="padding:8px 12px;">${pub.journalOrEvent || ''}</td>
        <td style="padding:8px 12px;">${pub.year ?? ''}</td>
        <td style="padding:8px 12px;">${external?.title ?? ''}</td>
        <td style="padding:8px 12px;">${external?.authors.join(', ') ?? ''}</td>
        <td style="padding:8px 12px;">${external?.journal ?? ''}</td>
        <td style="padding:8px 12px;">${external?.year ?? ''}</td>
        <td style="padding:8px 12px;"><span style="color:${badgeColor};font-weight:600;">${result?.status ?? ''}</span><div style="color:#6b7280;font-size:12px;">${result?.details ?? ''}</div></td>
      </tr>`;
    })
    .join('');

  const html = `<!doctype html>
  <html><head><meta charset="UTF-8"><title>CV Checker Report</title></head>
  <body style="font-family:Arial, sans-serif; background:#f8fafc; color:#0f172a;">
    <main style="max-width:1200px; margin:32px auto; background:white; padding:24px 28px; border-radius:16px; box-shadow:0 12px 40px rgba(15,23,42,0.08);">
      <h1 style="font-size:24px; margin-bottom:4px;">CV Publication Checker</h1>
      <p style="color:#6b7280; margin-top:0;">Verification summary exported from the web app.</p>
      <table style="width:100%; border-collapse:collapse; font-size:14px;">${rows}</table>
    </main>
  </body></html>`;

  downloadText('cv-checker-report.html', html, 'text/html');
}
