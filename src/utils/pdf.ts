import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

const workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).toString();
GlobalWorkerOptions.workerSrc = workerSrc;

export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item: any) => ('str' in item ? (item as any).str : '') as string);
    pages.push(strings.join(' '));
  }

  return pages.join('\n');
}
