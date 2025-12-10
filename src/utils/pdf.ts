import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
// Use the bundled pdf.js worker URL so Vite dev/prod resolve correctly under any base path.
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorker;

export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    // Cast to allow disableCombineTextItems, which is supported at runtime but not typed.
    const content = await page.getTextContent({ disableCombineTextItems: true } as any);

    type Line = { y: number; items: Array<{ x: number; w: number; str: string }> };
    const lines: Line[] = [];
    const Y_TOLERANCE = 2; // points

    content.items.forEach((item: any) => {
      if (!('str' in item)) return;
      const str: string = item.str || '';
      const [ , , , , x, y ] = item.transform as number[];
      const w: number = (item.width as number) ?? 0;

      // Find an existing line within tolerance on the y-axis.
      let line = lines.find((ln) => Math.abs(ln.y - y) <= Y_TOLERANCE);
      if (!line) {
        line = { y, items: [] };
        lines.push(line);
      }
      line.items.push({ x, w, str });
    });

    // Sort lines top-to-bottom (pdf y increases upward) and items left-to-right.
    lines.sort((a, b) => b.y - a.y);

    const joined = lines
      .map((line) => {
        const sorted = line.items.sort((a, b) => a.x - b.x);
        let acc = '';
        for (let idx = 0; idx < sorted.length; idx += 1) {
          const item = sorted[idx];
          if (idx > 0) {
            const prev = sorted[idx - 1];
            const gap = item.x - (prev.x + prev.w);
            if (gap > 1) acc += ' ';
          }
          acc += item.str;
        }
        return acc.trim();
      })
      .filter((l) => l.length > 0)
      .join('\n');

    pages.push(joined);
  }

  return pages.join('\n');
}
