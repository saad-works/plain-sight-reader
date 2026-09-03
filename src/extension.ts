import * as vscode from 'vscode';
import { Library } from './library';
import { importBook } from './importer';
import { ReaderController, READER_SCHEME } from './reader/readerController';

export function activate(context: vscode.ExtensionContext): void {
  const library = new Library(context);
  const reader = new ReaderController(context, library);

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(READER_SCHEME, reader)
  );

  const register = (id: string, handler: (...args: unknown[]) => unknown) =>
    context.subscriptions.push(vscode.commands.registerCommand(id, handler));

  register('plainSightReader.importBook', async () => {
    const picks = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: 'Import',
      filters: { 'E-books': ['pdf', 'epub'] },
    });
    if (!picks || picks.length === 0) return;

    let meta;
    let sectionCount = 0;
    try {
      meta = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Importing book…' },
        async () => {
          const book = await importBook(picks[0].fsPath);
          sectionCount = book.chapters.length;
          return library.add(book);
        }
      );
    } catch (err) {
      vscode.window.showErrorMessage(`Import failed: ${(err as Error).message}`);
      return;
    }

    const openNow = 'Open now';
    const choice = await vscode.window.showInformationMessage(
      `Imported “${meta.title}” — ${sectionCount} section(s).`,
      openNow
    );
    if (choice === openNow) await reader.open(meta);
  });

  register('plainSightReader.openBook', async () => {
    const books = library.list();
    if (books.length === 0) {
      const doImport = 'Import a book';
      const choice = await vscode.window.showInformationMessage(
        'Your library is empty.',
        doImport
      );
      if (choice === doImport) {
        await vscode.commands.executeCommand('plainSightReader.importBook');
      }
      return;
    }

    const pick = await vscode.window.showQuickPick(
      books.map((b) => ({
        label: b.title,
        description: b.author,
        detail: `${b.format.toUpperCase()} · ${b.chapterTitles.length} sections · resumes at ${
          b.position.chapterIndex + 1
        }.${b.position.pageIndex + 1}`,
        bookId: b.id,
      })),
      { placeHolder: 'Open book', matchOnDescription: true }
    );
    if (!pick) return;

    const meta = library.get(pick.bookId);
    if (meta) await reader.open(meta);
  });

  register('plainSightReader.goToChapter', async () => {
    const titles = reader.chapterTitles();
    if (titles.length === 0) {
      vscode.window.showInformationMessage('Plain Sight Reader: no book open.');
      return;
    }
    const pick = await vscode.window.showQuickPick(
      titles.map((title, index) => ({ label: `${index + 1}. ${title}`, index })),
      { placeHolder: 'Jump to section' }
    );
    if (pick) await reader.goToChapter(pick.index);
  });

  register('plainSightReader.removeBook', async () => {
    const books = library.list();
    if (books.length === 0) return;
    const pick = await vscode.window.showQuickPick(
      books.map((b) => ({ label: b.title, description: b.author, bookId: b.id })),
      { placeHolder: 'Remove book from library' }
    );
    if (!pick) return;
    await library.remove(pick.bookId);
    vscode.window.setStatusBarMessage('Removed from library.', 1500);
  });

  register('plainSightReader.nextPage', () => reader.nextPage());
  register('plainSightReader.prevPage', () => reader.prevPage());
  register('plainSightReader.nextChapter', () => reader.nextChapter());
  register('plainSightReader.prevChapter', () => reader.prevChapter());
  register('plainSightReader.cycleDisguise', () => reader.cycleDisguise());
  register('plainSightReader.panic', () => reader.panic());
}

export function deactivate(): void {
  /* nothing to clean up beyond context.subscriptions */
}
