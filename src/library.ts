import * as vscode from 'vscode';
import { Book, BookMeta, ReadingPosition } from './importer/types';

const LIB_KEY = 'psr.library.v1';

/** Persists the book list (globalState) and book content (global storage files). */
export class Library {
  constructor(private readonly ctx: vscode.ExtensionContext) {}

  list(): BookMeta[] {
    return this.ctx.globalState.get<BookMeta[]>(LIB_KEY, []);
  }

  get(id: string): BookMeta | undefined {
    return this.list().find((b) => b.id === id);
  }

  async add(book: Book): Promise<BookMeta> {
    const meta: BookMeta = {
      id: book.id,
      title: book.title,
      author: book.author,
      format: book.format,
      importedAt: Date.now(),
      chapterTitles: book.chapters.map((c) => c.title),
      position: { chapterIndex: 0, pageIndex: 0 },
    };

    await this.writeContent(book);
    const next = [meta, ...this.list().filter((b) => b.id !== book.id)];
    await this.ctx.globalState.update(LIB_KEY, next);
    return meta;
  }

  async remove(id: string): Promise<void> {
    await this.ctx.globalState.update(
      LIB_KEY,
      this.list().filter((b) => b.id !== id)
    );
    try {
      await vscode.workspace.fs.delete(this.contentUri(id));
    } catch {
      /* file may not exist */
    }
  }

  async savePosition(id: string, position: ReadingPosition): Promise<void> {
    const next = this.list().map((b) => (b.id === id ? { ...b, position } : b));
    await this.ctx.globalState.update(LIB_KEY, next);
  }

  async loadContent(id: string): Promise<Book> {
    const bytes = await vscode.workspace.fs.readFile(this.contentUri(id));
    return JSON.parse(Buffer.from(bytes).toString('utf8')) as Book;
  }

  private async writeContent(book: Book): Promise<void> {
    await vscode.workspace.fs.createDirectory(this.ctx.globalStorageUri);
    const bytes = Buffer.from(JSON.stringify(book), 'utf8');
    await vscode.workspace.fs.writeFile(this.contentUri(book.id), bytes);
  }

  private contentUri(id: string): vscode.Uri {
    return vscode.Uri.joinPath(this.ctx.globalStorageUri, `${id}.json`);
  }
}
