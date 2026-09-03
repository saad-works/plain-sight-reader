import * as crypto from 'crypto';
import * as path from 'path';
import { Book } from './types';
import { importPdf } from './pdf';
import { importEpub } from './epub';

export async function importBook(filePath: string): Promise<Book> {
  const ext = path.extname(filePath).toLowerCase();
  const id = crypto.randomBytes(8).toString('hex');

  if (ext === '.pdf') return importPdf(filePath, id);
  if (ext === '.epub') return importEpub(filePath, id);

  throw new Error(`Unsupported file type "${ext || '(none)'}". Use a .pdf or .epub file.`);
}

export * from './types';
