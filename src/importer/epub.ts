import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import { parse } from 'node-html-parser';
import { htmlToText, firstHeading } from '../util/html';
import { Book, Chapter } from './types';

export async function importEpub(filePath: string, id: string): Promise<Book> {
  const buf = await fs.promises.readFile(filePath);
  const zip = await JSZip.loadAsync(buf);

  const containerXml = await readEntry(zip, 'META-INF/container.xml');
  const opfPath = containerXml?.match(/full-path\s*=\s*"([^"]+)"/i)?.[1];
  if (!opfPath) {
    throw new Error('Invalid EPUB: META-INF/container.xml has no rootfile.');
  }

  const opfXml = await readEntry(zip, opfPath);
  if (!opfXml) {
    throw new Error(`Invalid EPUB: package file "${opfPath}" not found.`);
  }

  const opfDir = opfPath.includes('/') ? opfPath.replace(/\/[^/]+$/, '') : '';
  const opf = parse(opfXml, { comment: false });

  const title =
    decodeEntities(opfXml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1]?.trim() || '') ||
    baseName(filePath);
  const author =
    decodeEntities(opfXml.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i)?.[1]?.trim() || '') ||
    'Unknown';

  const manifest = new Map<string, string>();
  for (const item of opf.querySelector('manifest')?.querySelectorAll('item') ?? []) {
    const itemId = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (itemId && href) manifest.set(itemId, href);
  }

  const spineHrefs: string[] = [];
  for (const ref of opf.querySelector('spine')?.querySelectorAll('itemref') ?? []) {
    const idref = ref.getAttribute('idref');
    if (idref && manifest.has(idref)) spineHrefs.push(manifest.get(idref)!);
  }
  if (spineHrefs.length === 0) {
    throw new Error('Invalid EPUB: spine is empty.');
  }

  const chapters: Chapter[] = [];
  let n = 0;
  for (const href of spineHrefs) {
    n += 1;
    const clean = decodeURIComponent(href.split('#')[0]);
    const entryPath = joinZipPath(opfDir, clean);
    const xhtml = await readEntry(zip, entryPath);
    if (!xhtml) continue;

    const heading = firstHeading(xhtml);
    let text = htmlToText(xhtml);
    if (text.replace(/\s/g, '').length < 20) continue;

    // Avoid repeating the heading as both the section title and the first line.
    if (heading && text.startsWith(heading)) {
      text = text.slice(heading.length).replace(/^\s+/, '');
    }

    chapters.push({ title: heading || `Section ${n}`, text });
  }

  if (chapters.length === 0) {
    throw new Error('No readable text found in this EPUB.');
  }

  return { id, title, author, format: 'epub', chapters };
}

async function readEntry(zip: JSZip, entryPath: string): Promise<string | undefined> {
  const direct = zip.file(entryPath);
  if (direct) return direct.async('string');

  const lower = entryPath.toLowerCase();
  const match = Object.keys(zip.files).find((k) => k.toLowerCase() === lower);
  return match ? zip.files[match].async('string') : undefined;
}

function joinZipPath(dir: string, rel: string): string {
  const joined = dir ? `${dir}/${rel}` : rel;
  const segments: string[] = [];
  for (const seg of joined.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') segments.pop();
    else segments.push(seg);
  }
  return segments.join('/');
}

function baseName(p: string): string {
  return path.basename(p).replace(/\.[^.]+$/, '') || 'Untitled';
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}
