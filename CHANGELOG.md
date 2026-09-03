# Changelog

All notable changes to **Plain Sight Reader** are documented here.
The format is loosely based on [Keep a Changelog](https://keepachangelog.com/).

## [0.1.2]

### Docs
- Added an animated demo to the README and the Marketplace listing.
- README now leads with Marketplace install instructions and badges.

## [0.1.1]

### Changed
- Reworked the `code` disguise: pages are split into small paragraph groups, each
  rendered as a documentation comment above a synthetic declaration (function,
  struct, guard clause, property, or constant). Output now reads as a
  well‑documented source file instead of a comment wall followed by an empty stub.
- Code disguise supports 8 languages: `typescript`, `javascript`, `csharp`,
  `java`, `go`, `rust`, `ruby`, `python`. Unknown values fall back to
  `typescript`, and the tab extension / syntax highlighting follow the resolved
  language.

### Fixed
- Import progress notification stayed on screen until the "Open now" prompt was
  dismissed; it now clears as soon as parsing finishes.
- EPUB: XML prolog (`<?xml … ?>`) leaked into extracted text.
- EPUB: section heading was duplicated as both the section title and the first
  line of body text.

### Packaging
- `.vscodeignore` now excludes `*.pdf`, `*.epub`, `*.vsix`, and `out/` so local
  test books are never bundled into the extension.

## [0.1.0]

### Added
- Initial release.
- Import `.pdf` and `.epub` e‑books into a local library.
- Read as a virtual, read‑only editor tab with `code`, `markdown`, and `log`
  disguise modes.
- Keyboard navigation for pages and sections; jump‑to‑section quick pick.
- Per‑book reading position, saved and restored automatically.
- Panic command to close the reader tab immediately.
- Settings for disguise mode, code language, page size, wrap column, status‑bar
  indicator, and a post‑panic command hook.
