import * as vscode from 'vscode';
import { Library } from '../library';
import { Book, BookMeta } from '../importer/types';
import { paginate } from './pagination';
import { render, languageForMode, extForMode, DisguiseMode } from './disguise';

export const READER_SCHEME = 'psr';

interface Session {
  meta: BookMeta;
  book: Book;
  chapterIndex: number;
  pageIndex: number;
  pages: string[];
}

/**
 * Owns the reading session and serves the disguised text through a virtual,
 * read-only document. Each navigation opens a fresh virtual URI so the content
 * provider is always re-invoked; the previous reader tab is then closed.
 */
export class ReaderController implements vscode.TextDocumentContentProvider {
  private readonly changeEmitter = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this.changeEmitter.event;

  private session: Session | undefined;
  private currentUri: vscode.Uri | undefined;
  private version = 0;
  private readonly status: vscode.StatusBarItem;

  constructor(ctx: vscode.ExtensionContext, private readonly library: Library) {
    this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1);
    ctx.subscriptions.push(
      this.changeEmitter,
      this.status,
      vscode.window.onDidChangeActiveTextEditor((e) => this.syncContext(e)),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('plainSightReader')) void this.refresh();
      })
    );
  }

  provideTextDocumentContent(): string {
    const s = this.session;
    if (!s) return '// no book open';

    const chapter = s.book.chapters[s.chapterIndex];
    const { content } = render(s.pages[s.pageIndex] ?? '', {
      mode: this.mode,
      codeLanguage: this.cfg.get<string>('codeLanguage', 'typescript'),
      wrapColumn: this.cfg.get<number>('wrapColumn', 100),
      chapterTitle: chapter?.title ?? 'Section',
      bookTitle: s.book.title,
      pageIndex: s.pageIndex,
      pageCount: s.pages.length,
    });
    return content;
  }

  async open(meta: BookMeta): Promise<void> {
    const book = await this.library.loadContent(meta.id);
    const chapterIndex = clamp(meta.position.chapterIndex, 0, book.chapters.length - 1);
    const pages = this.pagesFor(book, chapterIndex);
    this.session = {
      meta,
      book,
      chapterIndex,
      pages,
      pageIndex: clamp(meta.position.pageIndex, 0, pages.length - 1),
    };
    await this.show();
  }

  /** Re-render after a settings change, re-paginating and keeping the reader near the same spot. */
  async refresh(): Promise<void> {
    const s = this.session;
    if (!s) return;
    const anchor = (s.pages[s.pageIndex] ?? '').slice(0, 24);
    s.pages = this.pagesFor(s.book, s.chapterIndex);
    const found = anchor ? s.pages.findIndex((p) => p.startsWith(anchor)) : -1;
    s.pageIndex = found >= 0 ? found : clamp(s.pageIndex, 0, s.pages.length - 1);
    await this.show();
  }

  nextPage = () => this.move(1, 0);
  prevPage = () => this.move(-1, 0);
  nextChapter = () => this.move(0, 1);
  prevChapter = () => this.move(0, -1);

  async goToChapter(index: number): Promise<void> {
    const s = this.session;
    if (!s) return;
    s.chapterIndex = clamp(index, 0, s.book.chapters.length - 1);
    s.pages = this.pagesFor(s.book, s.chapterIndex);
    s.pageIndex = 0;
    await this.show();
    await this.persist();
  }

  async cycleDisguise(): Promise<void> {
    const order: DisguiseMode[] = ['code', 'markdown', 'log'];
    const next = order[(order.indexOf(this.mode) + 1) % order.length];
    await this.cfg.update('disguiseMode', next, vscode.ConfigurationTarget.Global);
    // onDidChangeConfiguration triggers refresh(); nothing else needed here.
    vscode.window.setStatusBarMessage(`Reader: ${next}`, 1200);
  }

  async panic(): Promise<void> {
    if (this.currentUri) await this.closeTabFor(this.currentUri);
    this.currentUri = undefined;
    this.status.hide();
    const extra = this.cfg.get<string>('panicCommand', '').trim();
    if (extra) {
      try {
        await vscode.commands.executeCommand(extra);
      } catch {
        /* ignore invalid command id */
      }
    }
  }

  chapterTitles(): string[] {
    return this.session?.book.chapters.map((c) => c.title) ?? [];
  }

  isReaderUri(uri: vscode.Uri | undefined): boolean {
    return uri?.scheme === READER_SCHEME;
  }

  // --- internals -----------------------------------------------------------

  private get cfg(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('plainSightReader');
  }

  private get mode(): DisguiseMode {
    return this.cfg.get<DisguiseMode>('disguiseMode', 'code');
  }

  private pagesFor(book: Book, chapterIndex: number): string[] {
    const text = book.chapters[chapterIndex]?.text ?? '';
    return paginate(text, this.cfg.get<number>('charsPerPage', 1600));
  }

  private async move(deltaPage: number, deltaChapter: number): Promise<void> {
    const s = this.session;
    if (!s) {
      vscode.window.showInformationMessage('Plain Sight Reader: no book open.');
      return;
    }

    if (deltaChapter !== 0) {
      const target = clamp(s.chapterIndex + deltaChapter, 0, s.book.chapters.length - 1);
      if (target === s.chapterIndex) return;
      s.chapterIndex = target;
      s.pages = this.pagesFor(s.book, target);
      s.pageIndex = deltaChapter > 0 ? 0 : s.pages.length - 1;
    } else {
      let target = s.pageIndex + deltaPage;
      if (target < 0) {
        if (s.chapterIndex === 0) {
          target = 0;
        } else {
          s.chapterIndex -= 1;
          s.pages = this.pagesFor(s.book, s.chapterIndex);
          target = s.pages.length - 1;
        }
      } else if (target >= s.pages.length) {
        if (s.chapterIndex >= s.book.chapters.length - 1) {
          target = s.pages.length - 1;
        } else {
          s.chapterIndex += 1;
          s.pages = this.pagesFor(s.book, s.chapterIndex);
          target = 0;
        }
      }
      s.pageIndex = target;
    }

    await this.show();
    await this.persist();
  }

  private async show(): Promise<void> {
    const s = this.session;
    if (!s) return;

    const codeLanguage = this.cfg.get<string>('codeLanguage', 'typescript');
    const ext = extForMode(this.mode, codeLanguage);
    const uri = vscode.Uri.parse(
      `${READER_SCHEME}:/${s.meta.id}/${slugify(s.book.title)}${ext}?v=${(this.version += 1)}`
    );

    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.languages.setTextDocumentLanguage(doc, languageForMode(this.mode, codeLanguage));
    await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: false });

    const previous = this.currentUri;
    this.currentUri = uri;
    if (previous && previous.toString() !== uri.toString()) {
      await this.closeTabFor(previous);
    }

    this.updateStatus();
    this.syncContext(vscode.window.activeTextEditor);
  }

  private async closeTabFor(uri: vscode.Uri): Promise<void> {
    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        if (
          tab.input instanceof vscode.TabInputText &&
          tab.input.uri.toString() === uri.toString()
        ) {
          try {
            await vscode.window.tabGroups.close(tab, false);
          } catch {
            /* tab already gone */
          }
        }
      }
    }
  }

  private async persist(): Promise<void> {
    const s = this.session;
    if (!s) return;
    await this.library.savePosition(s.meta.id, {
      chapterIndex: s.chapterIndex,
      pageIndex: s.pageIndex,
    });
  }

  private updateStatus(): void {
    const s = this.session;
    if (!s || !this.cfg.get<boolean>('showStatusBar', false)) {
      this.status.hide();
      return;
    }
    const chapterCount = Math.max(1, s.book.chapters.length);
    const withinChapter = s.pages.length > 0 ? s.pageIndex / s.pages.length : 0;
    const pct = Math.round(((s.chapterIndex + withinChapter) / chapterCount) * 100);
    this.status.text = `$(book) ${pct}%`;
    this.status.tooltip = `${s.book.title} — ${s.book.chapters[s.chapterIndex]?.title ?? ''}`;
    this.status.show();
  }

  private syncContext(editor: vscode.TextEditor | undefined): void {
    void vscode.commands.executeCommand(
      'setContext',
      'plainSightReader.active',
      this.isReaderUri(editor?.document.uri)
    );
  }
}

function clamp(n: number, lo: number, hi: number): number {
  if (hi < lo) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'notes'
  );
}
