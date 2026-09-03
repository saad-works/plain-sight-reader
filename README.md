# Plain Sight Reader

> Read **PDF** and **EPUB** e‑books inside **VS Code** — rendered as source code, Markdown docs, or log output, so reading blends into a normal editor session.

[![Version](https://img.shields.io/badge/version-0.1.1-blue.svg)](https://github.com/saad-works/plain-sight-reader/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.84-007ACC.svg?logo=visualstudiocode)](https://code.visualstudio.com/)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

**Plain Sight Reader** is a Visual Studio Code extension for people who want to read a book in their development environment without it looking like they are reading a book. Import an e‑book, and its text appears in a normal editor tab — as commented source code (in the language of your choice), as a Markdown document, or as a stream of timestamped log lines. Page through it with the keyboard, jump between chapters, and hit a panic key to close it instantly.

It is a focused, offline, no‑telemetry **e‑book reader for developers** — a discreet way to read novels, non‑fiction, RFCs, documentation, or long‑form articles during downtime, commutes on a remote box, or a slow CI run.

---

## Table of contents

- [Why use it](#why-use-it)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Disguise modes](#disguise-modes)
- [Commands](#commands)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Settings](#settings)
- [How it works](#how-it-works)
- [Privacy](#privacy)
- [Supported formats](#supported-formats)
- [FAQ](#faq)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Why use it

- **Read without context‑switching.** No second app, no browser tab, no phone. The book is a tab next to your code.
- **Low profile.** A glance at your screen reads as "documentation" or "logs," not *Dune*.
- **Keyboard‑driven.** Turn pages and jump chapters without touching the mouse.
- **Yours, offline.** Books live on your machine. The extension makes zero network requests.
- **It resumes.** Close the tab, restart VS Code, reopen the book — you are back where you left off.

Typical uses: reading a novel on a break, getting through a technical book a page at a time, reviewing a long PDF spec, or catching up on saved long‑form articles exported to EPUB.

---

## Features

| | |
|---|---|
| 📥 **Import PDF & EPUB** | Text is extracted, split into sections, and stored locally in a personal library. |
| 🎭 **Three disguise modes** | `code` (8 languages), `markdown`, and `log` — switch any time with one keystroke. |
| ⌨️ **Keyboard navigation** | Next/previous page, next/previous section, jump‑to‑section quick pick. |
| 🔖 **Automatic bookmarks** | Reading position is saved per book and restored on reopen. |
| 🚨 **Panic key** | One shortcut closes the reader tab immediately (optionally runs another command). |
| 🧩 **No sidebar, no clutter** | Everything runs through the Command Palette and quick picks. |
| 📴 **Fully offline** | No accounts, no telemetry, no external calls. |

---

## Requirements

- **VS Code 1.84** or newer.
- To build from source: **Node.js 18+** and npm.

No other runtime dependencies — the extension is bundled into a single file.

---

## Installation

### Option A — install the packaged extension (recommended)

1. Download `plain-sight-reader-<version>.vsix` (from the repo's Releases, or build it yourself — see below).
2. In VS Code: **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`) → **Extensions: Install from VSIX…** → choose the file.
3. **Developer: Reload Window**.

The extension is now active in **every** VS Code window on that machine. Repeat on other machines with the same `.vsix` — there is nothing to sync or sign in to.

### Option B — build from source

```bash
git clone https://github.com/saad-works/plain-sight-reader.git
cd plain-sight-reader
npm install
npm run compile          # bundle to dist/extension.js
npx @vscode/vsce package # produces plain-sight-reader-<version>.vsix
```

Then install the generated `.vsix` as in Option A.

### Option C — run it in development

Open the folder in VS Code and press <kbd>F5</kbd>. A second VS Code window (the *Extension Development Host*) launches with the extension loaded. Use `npm run watch` for incremental rebuilds.

---

## Quick start

1. **Command Palette → `Plain Sight Reader: Import Book…`** and pick a `.pdf` or `.epub`.
2. When prompted, choose **Open now** (or later: **`Plain Sight Reader: Open Book…`**).
3. The book opens as an editor tab. Turn pages with <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>.</kbd> and <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>,</kbd>.

Change how it looks with **`Cycle Disguise Mode`** (<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>M</kbd>), and set the code language in **Settings → `plainSightReader.codeLanguage`**.

---

## Disguise modes

Cycle modes with <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>M</kbd>, or set `plainSightReader.disguiseMode`. The reader tab's file extension and syntax highlighting follow the mode automatically.

### `code`

Each page is split into small groups of paragraphs. Every group becomes a **documentation comment** attached to a plausible, synthetic declaration — a function, struct, guard clause, property, or constant — so the page reads as a heavily‑documented source file rather than a wall of comments.

Set the language with `plainSightReader.codeLanguage`. Supported: `typescript` (default), `javascript`, `csharp`, `java`, `go`, `rust`, `ruby`, `python`. Any other value falls back to `typescript`.

**TypeScript**

```ts
// ThePierAtLowTide — Northbound
// part 3 of 9

import { normalize } from "./normalize";
import type { Frame, Node, Segment } from "./types";

/**
 * The morning fog had not yet lifted from the harbour when Elena stepped onto the pier,
 * her boots loud on the wet planks. She had rehearsed the conversation a dozen times on
 * the train, and every version ended badly.
 */
export function resolveEntry(input: Entry, offset = 0): Entry {
  const entry = input.slice(offset);
  return normalize(entry);
}
```

**C#**

```csharp
internal static class ThePierAtLowTide
{
    /// <summary>
    /// When he finally appeared at the end of the pier he was not alone. The second figure
    /// hung back, half hidden by the mist, and Elena felt the shape of the afternoon change.
    /// </summary>
    public static IReadOnlyList<Scope> Scopes { get; } = new List<Scope>();
}
```

### `markdown`

Renders as a clean Markdown document — a section heading, a subtle progress line, then the prose. Looks like reading project docs or a design note.

```md
# The Pier at Low Tide

_Northbound — part 3 of 9_

The morning fog had not yet lifted from the harbour when Elena stepped onto the pier…
```

### `log`

Renders as timestamped application logs. Each sentence is a log line with a rotating level (`INFO`, `DEBUG`, `WARN`, `TRACE`).

```log
2026-01-01 09:00:00.000  INFO   reader.stream  The morning fog had not yet lifted from the harbour.
2026-01-01 09:00:01.373  DEBUG  reader.stream  She had rehearsed the conversation a dozen times on the train.
2026-01-01 09:00:02.746  INFO   reader.stream  Every version ended badly.
```

---

## Commands

All commands are under the **Plain Sight Reader** category in the Command Palette (`Ctrl+Shift+P`).

| Command | ID | Description |
|---|---|---|
| Import Book… | `plainSightReader.importBook` | Pick a `.pdf` / `.epub` and add it to your library |
| Open Book… | `plainSightReader.openBook` | Choose a book and start (or resume) reading |
| Go to Section… | `plainSightReader.goToChapter` | Jump to a section via quick pick |
| Remove Book… | `plainSightReader.removeBook` | Delete a book and its saved position |
| Next Page | `plainSightReader.nextPage` | Turn forward (wraps into the next section) |
| Previous Page | `plainSightReader.prevPage` | Turn back (wraps into the previous section) |
| Next Section | `plainSightReader.nextChapter` | Go to the start of the next section |
| Previous Section | `plainSightReader.prevChapter` | Go to the start of the previous section |
| Cycle Disguise Mode | `plainSightReader.cycleDisguise` | Rotate `code` → `markdown` → `log` |
| Panic (Close Reader) | `plainSightReader.panic` | Close the reader tab immediately |

---

## Keyboard shortcuts

| Keys | Action | Active when |
|---|---|---|
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>.</kbd> | Next page | reader tab focused |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>,</kbd> | Previous page | reader tab focused |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>.</kbd> | Next section | reader tab focused |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>,</kbd> | Previous section | reader tab focused |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>M</kbd> | Cycle disguise mode | reader tab focused |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Q</kbd> | Panic — close reader | always |

Rebind any of these in **Preferences: Open Keyboard Shortcuts** (search for `plainSightReader`). On macOS, substitute <kbd>Cmd</kbd> where appropriate via your own bindings.

---

## Settings

Open **Settings** (`Ctrl+,`) and search for *Plain Sight Reader*, or edit `settings.json`.

| Setting | Type | Default | Description |
|---|---|---|---|
| `plainSightReader.disguiseMode` | `code` \| `markdown` \| `log` | `code` | How book text is displayed. |
| `plainSightReader.codeLanguage` | string | `typescript` | Language for the `code` disguise: `typescript`, `javascript`, `csharp`, `java`, `go`, `rust`, `ruby`, `python`. |
| `plainSightReader.charsPerPage` | number | `1600` | Approximate characters per page. Lower = more frequent page turns. |
| `plainSightReader.wrapColumn` | number | `100` | Line‑wrap width for the `code` disguise. |
| `plainSightReader.showStatusBar` | boolean | `false` | Show a subtle reading‑progress indicator in the status bar. |
| `plainSightReader.panicCommand` | string | `""` | Optional command ID to run *after* the panic key closes the reader tab (e.g. `workbench.action.quickOpen`). |

Changes apply live — the open reader re‑renders and keeps your place.

```jsonc
// settings.json
{
  "plainSightReader.disguiseMode": "code",
  "plainSightReader.codeLanguage": "csharp",
  "plainSightReader.charsPerPage": 1400,
  "plainSightReader.showStatusBar": false
}
```

---

## How it works

```
import  ─▶  parse (pdf-parse / jszip + node-html-parser)
        ─▶  extract text, split into sections
        ─▶  store as JSON in the extension's global storage
                                   │
open    ─▶  load JSON ─▶ paginate ─▶ render through the active disguise
        ─▶  show as a read-only virtual document (custom `psr:` URI scheme)

navigate ─▶ each page turn re-renders and saves { section, page } to your library
```

- **Parsing.** PDFs go through [`pdf-parse`](https://www.npmjs.com/package/pdf-parse) page by page; chapter headings ("Chapter 3", "Part II", …) are detected where present, otherwise pages are grouped in blocks. EPUBs are unzipped with [`jszip`](https://www.npmjs.com/package/jszip); the OPF spine is read for order and metadata, and each XHTML document is converted to text.
- **Storage.** Book text is written as a JSON file under VS Code's per‑extension global storage; the library index and per‑book reading position live in `globalState`. Uninstalling and reinstalling keeps your library (it is keyed by extension ID, not bundled in the `.vsix`).
- **Rendering.** The reader is a **read‑only virtual document**. It cannot be edited or accidentally saved, and it never touches your workspace files.

---

## Privacy

Plain Sight Reader is fully local:

- **No network requests.** Nothing is uploaded, checked, or phoned home.
- **No telemetry or analytics.**
- **No accounts.**
- Your books and reading positions never leave your machine.

---

## Supported formats

| Format | Support | Notes |
|---|---|---|
| **EPUB** (`.epub`) | ✅ EPUB 2 & 3 | Spine order and metadata (title, author) are read from the OPF. Footnotes, tables, and complex layouts are flattened to text. |
| **PDF** (`.pdf`) | ✅ text‑based PDFs | Text is extracted per page. **Scanned / image‑only PDFs have no text layer and cannot be read** (no OCR). Multi‑column and heavily designed layouts may extract imperfectly. |
| MOBI / AZW3 | ❌ | Convert to EPUB first (e.g. with Calibre). |

---

## FAQ

**Is this a way to read books at work without anyone noticing?**
That is the design goal. In `code` or `log` mode a passing glance reads as ordinary editor content. It is not invisible to someone who stops and reads your screen.

**Can I read novels, not just technical books?**
Yes. Any text‑based EPUB or PDF works — fiction, non‑fiction, articles, specs.

**Does it work over SSH / in a remote or container workspace?**
It runs wherever the extension host runs. Import and library storage happen on that host.

**Will my place be saved if I close VS Code?**
Yes. Position is saved on every page turn and restored when you reopen the book.

**Does it change or create files in my project?**
No. The reader is a read‑only virtual document; book data is kept in the extension's private global storage.

**Why is a VS Code extension written in TypeScript and not C#?**
VS Code's extension host only runs JavaScript/TypeScript. You can still *display* the book as C# (or Go, Rust, Python, …) via `plainSightReader.codeLanguage`.

**Can I sync my library across machines?**
Not automatically. Copy the same `.vsix` to each machine and re‑import, or copy the extension's global storage folder manually.

**Is it on the VS Code Marketplace?**
Not yet — install from the `.vsix` for now.

---

## Troubleshooting

**"No selectable text found in this PDF."**
The PDF is a scanned image with no text layer. Run it through OCR (e.g. Calibre, `ocrmypdf`) or find a text‑based copy.

**The code disguise still looks like a wall of comments with an empty class.**
You are running an older build. Uninstall the extension, **Developer: Reload Window**, install the current `.vsix`, and reload again. If a second VS Code window (or an <kbd>F5</kbd> dev host) is open, it may be running the old build.

**Page‑turn shortcuts do nothing.**
They only fire while the reader tab is focused (`when: plainSightReader.active`). Click the tab first, or use the Command Palette.

**Sections are just "Pages 1–8", "Pages 9–16", …**
No chapter headings were detected in the PDF, so pages were grouped in fixed blocks. This is expected for many PDFs.

---

## Limitations

- No OCR — scanned PDFs are not supported.
- PDF chapter detection is heuristic; results vary by document.
- Text extraction favours readability over exact layout; footnotes, endnotes, tables, and multi‑column pages may be reflowed or reordered.
- Images, figures, and formatting (bold/italic, links) are dropped.
- Library sync across machines is manual.

---

## Roadmap

- [ ] Quick‑pick command to switch code language without opening Settings
- [ ] Configurable panic behaviour (switch tab vs. close vs. run command)
- [ ] Per‑book disguise/language overrides
- [ ] Adjustable "words per page" and font‑size‑aware pagination
- [ ] Better PDF structure detection (table of contents / outline)
- [ ] Optional Marketplace release

Suggestions welcome — open an issue.

---

## Contributing

```bash
npm install
npm run watch      # incremental bundle
npm run typecheck  # tsc --noEmit
```

Press <kbd>F5</kbd> to launch the Extension Development Host. Project layout:

```
src/
  extension.ts              activation + command wiring
  library.ts               library index + book storage + reading position
  importer/
    index.ts               dispatch by file type
    pdf.ts                  PDF text extraction + section heuristics
    epub.ts                 EPUB unzip + OPF spine + XHTML → text
    types.ts
  reader/
    pagination.ts           split section text into pages
    disguise.ts             code / markdown / log renderers
    readerController.ts      session state + virtual document + navigation
  util/html.ts             XHTML → plain text
```

Please keep changes focused and run `npm run typecheck` before opening a PR.

---

## License

[MIT](./LICENSE) © 2026 saad-works
