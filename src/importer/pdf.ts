import * as fs from 'fs';
import * as path from 'path';
import { Book, Chapter } from './types';

// pdf-parse's index.js runs a debug block when required directly; the lib entry
// point avoids that. No type definitions ship with the package.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse: (data: Buffer, opts?: PdfParseOptions) => Promise<{ text: string; numpages: number }> =
  require('pdf-parse/lib/pdf-parse.js');

interface PdfParseOptions {
  pagerender?: (pageData: PdfPageData) => Promise<string>;
  max?: number;
}

interface PdfPageData {
  getTextContent(opts: { normalizeWhitespace: boolean; disableCombineTextItems: boolean }): Promise<{
    items: Array<{ str: string; transform: number[] }>;
  }>;
}

const CHAPTER_RE = /^\s*(chapter|part|book|section)\s+([0-9]+|[ivxlcdm]+)\b.*$/i;
const PAGES_PER_GROUP = 8;

export async function importPdf(filePath: string, id: string): Promise<Book> {
  const buf = await fs.promises.readFile(filePath);
  const pages: string[] = [];

  await pdfParse(buf, {
    pagerender: (pageData) =>
      pageData
        .getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false })
        .then((content) => {
          let lastY: number | undefined;
          let text = '';
          for (const item of content.items) {
            const y = item.transform?.[5];
            if (lastY !== undefined && y !== undefined && Math.abs(lastY - y) > 1) {
              text += '\n';
            }
            text += item.str;
            lastY = y;
          }
          pages.push(cleanPage(text));
          return text;
        }),
  });

  if (pages.every((p) => p.trim().length === 0)) {
    throw new Error(
      'No selectable text found in this PDF (it is likely a scanned image). OCR is not supported.'
    );
  }

  return {
    id,
    title: baseName(filePath),
    author: 'Unknown',
    format: 'pdf',
    chapters: chapterize(pages),
  };
}

function cleanPage(t: string): string {
  return t
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function chapterize(pages: string[]): Chapter[] {
  const marks: Array<{ index: number; title: string }> = [];
  pages.forEach((page, i) => {
    const heading = page
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0 && l.length < 90 && CHAPTER_RE.test(l));
    if (heading) marks.push({ index: i, title: heading.replace(/\s+/g, ' ').slice(0, 80) });
  });

  const chapters: Chapter[] = [];

  if (marks.length >= 2) {
    if (marks[0].index > 0) {
      chapters.push({
        title: 'Front Matter',
        text: pages.slice(0, marks[0].index).join('\n\n').trim(),
      });
    }
    marks.forEach((mark, i) => {
      const end = i + 1 < marks.length ? marks[i + 1].index : pages.length;
      chapters.push({
        title: mark.title,
        text: pages.slice(mark.index, end).join('\n\n').trim(),
      });
    });
  } else {
    for (let i = 0; i < pages.length; i += PAGES_PER_GROUP) {
      const end = Math.min(i + PAGES_PER_GROUP, pages.length);
      chapters.push({
        title: `Pages ${i + 1}–${end}`,
        text: pages.slice(i, end).join('\n\n').trim(),
      });
    }
  }

  const nonEmpty = chapters.filter((c) => c.text.length > 0);
  return nonEmpty.length > 0 ? nonEmpty : [{ title: 'Document', text: pages.join('\n\n').trim() }];
}

function baseName(p: string): string {
  return path.basename(p).replace(/\.[^.]+$/, '') || 'Untitled';
}
