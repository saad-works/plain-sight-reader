export type DisguiseMode = 'code' | 'markdown' | 'log';

export interface DisguiseOptions {
  mode: DisguiseMode;
  codeLanguage: string;
  wrapColumn: number;
  chapterTitle: string;
  bookTitle: string;
  pageIndex: number;
  pageCount: number;
}

export interface Rendered {
  content: string;
  languageId: string;
}

const LINE_COMMENT: Record<string, string> = {
  typescript: '//', javascript: '//', java: '//', c: '//', cpp: '//', csharp: '//',
  go: '//', rust: '//', kotlin: '//', swift: '//', scala: '//', php: '//', dart: '//',
  python: '#', ruby: '#', shellscript: '#', perl: '#', r: '#', yaml: '#', toml: '#',
};

export function render(text: string, opts: DisguiseOptions): Rendered {
  switch (opts.mode) {
    case 'markdown':
      return renderMarkdown(text, opts);
    case 'log':
      return renderLog(text);
    case 'code':
    default:
      return renderCode(text, opts);
  }
}

/** Resolve the requested code language to one the code disguise actually supports. */
export function resolveCodeLang(codeLanguage: string): string {
  return CODE_LANGS[codeLanguage] ? codeLanguage : 'typescript';
}

/** Language id VS Code should use for a given disguise mode. */
export function languageForMode(mode: DisguiseMode, codeLanguage: string): string {
  if (mode === 'markdown') return 'markdown';
  if (mode === 'log') return 'log';
  return resolveCodeLang(codeLanguage);
}

/** File extension for the reader tab name. */
export function extForMode(mode: DisguiseMode, codeLanguage: string): string {
  if (mode === 'markdown') return '.md';
  if (mode === 'log') return '.log';
  const map: Record<string, string> = {
    typescript: '.ts', javascript: '.js', java: '.java', csharp: '.cs',
    go: '.go', rust: '.rs', python: '.py', ruby: '.rb',
  };
  return map[resolveCodeLang(codeLanguage)] ?? '.ts';
}

function toParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter((p) => p.length > 0);
}

function wrapLine(line: string, width: number): string[] {
  const words = line.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let current = '';
  for (const word of words) {
    if (current && current.length + 1 + word.length > width) {
      out.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) out.push(current);
  return out.length > 0 ? out : [''];
}

function renderMarkdown(text: string, opts: DisguiseOptions): Rendered {
  const body = toParagraphs(text).join('\n\n');
  const content =
    `# ${opts.chapterTitle}\n\n` +
    `_${opts.bookTitle} — part ${opts.pageIndex + 1} of ${opts.pageCount}_\n\n` +
    `${body}\n`;
  return { content, languageId: 'markdown' };
}

function renderLog(text: string): Rendered {
  const levels = ['INFO', 'INFO', 'INFO', 'DEBUG', 'INFO', 'WARN', 'INFO', 'TRACE'];
  const base = Date.parse('2026-01-01T09:00:00.000Z');
  const sentences = text
    .replace(/\s*\n\s*/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const lines = sentences.map((sentence, i) => {
    const ts = new Date(base + i * 1373).toISOString().replace('T', ' ').replace('Z', '');
    const level = levels[i % levels.length].padEnd(5);
    return `${ts}  ${level}  reader.stream  ${sentence}`;
  });

  return { content: `${lines.join('\n')}\n`, languageId: 'log' };
}

// --- code disguise ----------------------------------------------------------
//
// The page's paragraphs are split into small groups; each group becomes a
// doc-comment attached to a synthetic declaration. That keeps the ratio of
// prose to code roughly even, so a page reads as a heavily-documented source
// file rather than a wall of comments with one empty stub.

const IDENT_VERBS = [
  'resolve', 'build', 'parse', 'apply', 'collect', 'normalize',
  'emit', 'visit', 'compose', 'evaluate', 'project', 'merge',
];
const IDENT_NOUNS = [
  'Segment', 'Token', 'Context', 'Entry', 'Node', 'Buffer',
  'Chunk', 'Frame', 'Scope', 'Handle', 'Cursor', 'Region',
];

interface NameParts {
  verb: string;
  Verb: string;
  Noun: string;
  noun: string;
  NOUN: string;
  n: number;
}

function names(i: number): NameParts {
  const verb = IDENT_VERBS[i % IDENT_VERBS.length];
  const Noun = IDENT_NOUNS[(i * 5 + 3) % IDENT_NOUNS.length];
  return {
    verb,
    Verb: verb[0].toUpperCase() + verb.slice(1),
    Noun,
    noun: Noun.toLowerCase(),
    NOUN: Noun.toUpperCase(),
    n: i,
  };
}

interface CodeLang {
  imports: string[];
  open: (typeName: string) => string[];
  close: string[];
  member: (i: number, doc: string[]) => string[];
}

function jsdoc(lines: string[], indent = ''): string[] {
  return [
    `${indent}/**`,
    ...lines.map((l) => `${indent} * ${l}`.replace(/\s+$/, '')),
    `${indent} */`,
  ];
}
function xmldoc(lines: string[], indent = ''): string[] {
  return [
    `${indent}/// <summary>`,
    ...lines.map((l) => `${indent}/// ${l}`.replace(/\s+$/, '')),
    `${indent}/// </summary>`,
  ];
}
function hashdoc(lines: string[], indent = ''): string[] {
  return lines.map((l) => `${indent}// ${l}`.replace(/\s+$/, ''));
}

const CODE_LANGS: Record<string, CodeLang> = {
  typescript: {
    imports: [
      'import { normalize } from "./normalize";',
      'import type { Frame, Node, Segment } from "./types";',
      '',
    ],
    open: () => [],
    close: [],
    member: (i, doc) => {
      const p = names(i);
      const blocks: string[][] = [
        [
          ...jsdoc(doc),
          `export function ${p.verb}${p.Noun}(input: ${p.Noun}, offset = ${p.n * 8}): ${p.Noun} {`,
          `  const ${p.noun} = input.slice(offset);`,
          `  return normalize(${p.noun});`,
          `}`,
        ],
        [
          ...jsdoc(doc),
          `export const ${p.verb}${p.Noun} = (source: readonly ${p.Noun}[]): ${p.Noun} | undefined =>`,
          `  source.find((item) => item.active);`,
        ],
        [
          ...jsdoc(doc),
          `export interface ${p.Noun}Options {`,
          `  readonly limit: number;`,
          `  readonly strict?: boolean;`,
          `}`,
        ],
        [
          ...jsdoc(doc),
          `function ${p.verb}${p.Noun}(frame: Frame): boolean {`,
          `  if (!frame || frame.size === 0) {`,
          `    return false;`,
          `  }`,
          `  return frame.head !== undefined;`,
          `}`,
        ],
      ];
      return blocks[i % blocks.length];
    },
  },

  javascript: {
    imports: ['const { normalize } = require("./normalize");', ''],
    open: () => [],
    close: [],
    member: (i, doc) => {
      const p = names(i);
      const blocks: string[][] = [
        [
          ...jsdoc(doc),
          `function ${p.verb}${p.Noun}(input, offset = ${p.n * 8}) {`,
          `  const ${p.noun} = input.slice(offset);`,
          `  return normalize(${p.noun});`,
          `}`,
          `module.exports.${p.verb}${p.Noun} = ${p.verb}${p.Noun};`,
        ],
        [
          ...jsdoc(doc),
          `function try${p.Verb}(frame) {`,
          `  if (!frame || frame.length === 0) {`,
          `    return false;`,
          `  }`,
          `  return frame[0] !== undefined;`,
          `}`,
        ],
      ];
      return blocks[i % blocks.length];
    },
  },

  csharp: {
    imports: ['using System;', 'using System.Collections.Generic;', ''],
    open: (t) => [`internal static class ${t}`, '{'],
    close: ['}'],
    member: (i, doc) => {
      const p = names(i);
      const I = '    ';
      const blocks: string[][] = [
        [
          ...xmldoc(doc, I),
          `${I}public static ${p.Noun} ${p.Verb}${p.Noun}(${p.Noun} source, int offset)`,
          `${I}{`,
          `${I}    var ${p.noun} = source.Slice(offset);`,
          `${I}    return ${p.noun}.Normalize();`,
          `${I}}`,
        ],
        [
          ...xmldoc(doc, I),
          `${I}public static IReadOnlyList<${p.Noun}> ${p.Noun}s { get; } = new List<${p.Noun}>();`,
        ],
        [
          ...xmldoc(doc, I),
          `${I}private static bool Try${p.Verb}(${p.Noun} frame, out ${p.Noun} result)`,
          `${I}{`,
          `${I}    if (frame.IsEmpty)`,
          `${I}    {`,
          `${I}        result = ${p.Noun}.None;`,
          `${I}        return false;`,
          `${I}    }`,
          `${I}    result = frame.Head;`,
          `${I}    return true;`,
          `${I}}`,
        ],
        [
          ...xmldoc(doc, I),
          `${I}private const int Default${p.Noun} = ${p.n * 16};`,
        ],
      ];
      return blocks[i % blocks.length];
    },
  },

  java: {
    imports: ['import java.util.List;', ''],
    open: (t) => [`final class ${t} {`],
    close: ['}'],
    member: (i, doc) => {
      const p = names(i);
      const I = '    ';
      const blocks: string[][] = [
        [
          ...jsdoc(doc, I),
          `${I}static ${p.Noun} ${p.verb}${p.Noun}(${p.Noun} source, int offset) {`,
          `${I}    var ${p.noun} = source.slice(offset);`,
          `${I}    return ${p.noun}.normalize();`,
          `${I}}`,
        ],
        [
          ...jsdoc(doc, I),
          `${I}private boolean try${p.Verb}(${p.Noun} frame) {`,
          `${I}    if (frame == null || frame.size() == 0) {`,
          `${I}        return false;`,
          `${I}    }`,
          `${I}    return frame.head() != null;`,
          `${I}}`,
        ],
        [
          ...jsdoc(doc, I),
          `${I}static final int DEFAULT_${p.NOUN} = ${p.n * 16};`,
        ],
      ];
      return blocks[i % blocks.length];
    },
  },

  go: {
    imports: ['package reader', '', 'import "strings"', ''],
    open: () => [],
    close: [],
    member: (i, doc) => {
      const p = names(i);
      const blocks: string[][] = [
        [
          ...hashdoc(doc),
          `func ${p.Verb}${p.Noun}(src []${p.Noun}, offset int) ${p.Noun} {`,
          `\tbuf := src[offset:]`,
          `\treturn normalize(strings.TrimSpace(buf.String()))`,
          `}`,
        ],
        [
          ...hashdoc(doc),
          `type ${p.Noun}Options struct {`,
          `\tLimit  int`,
          `\tStrict bool`,
          `}`,
        ],
        [
          ...hashdoc(doc),
          `func try${p.Verb}(f ${p.Noun}) (${p.Noun}, bool) {`,
          `\tif f.size == 0 {`,
          `\t\treturn ${p.Noun}{}, false`,
          `\t}`,
          `\treturn f.head, true`,
          `}`,
        ],
      ];
      return blocks[i % blocks.length];
    },
  },

  rust: {
    imports: ['use crate::normalize::normalize;', ''],
    open: () => [],
    close: [],
    member: (i, doc) => {
      const p = names(i);
      const rdoc = doc.map((l) => `/// ${l}`.replace(/\s+$/, ''));
      const blocks: string[][] = [
        [
          ...rdoc,
          `pub fn ${p.verb}_${p.noun}(src: &[${p.Noun}], offset: usize) -> ${p.Noun} {`,
          `    let buf = &src[offset..];`,
          `    normalize(buf)`,
          `}`,
        ],
        [
          ...rdoc,
          `pub struct ${p.Noun}Options {`,
          `    pub limit: usize,`,
          `    pub strict: bool,`,
          `}`,
        ],
        [
          ...rdoc,
          `fn try_${p.verb}(frame: &${p.Noun}) -> bool {`,
          `    if frame.is_empty() {`,
          `        return false;`,
          `    }`,
          `    frame.head().is_some()`,
          `}`,
        ],
      ];
      return blocks[i % blocks.length];
    },
  },

  ruby: {
    imports: ['require "normalize"', ''],
    open: (t) => [`module ${t}`],
    close: ['end'],
    member: (i, doc) => {
      const p = names(i);
      const I = '  ';
      const rdoc = doc.map((l) => `${I}# ${l}`.replace(/\s+$/, ''));
      const blocks: string[][] = [
        [
          ...rdoc,
          `${I}def ${p.verb}_${p.noun}(source, offset = ${p.n * 8})`,
          `${I}  buffer = source[offset..]`,
          `${I}  normalize(buffer)`,
          `${I}end`,
        ],
        [
          ...rdoc,
          `${I}def try_${p.verb}(frame)`,
          `${I}  return nil if frame.nil? || frame.empty?`,
          `${I}  frame.first`,
          `${I}end`,
        ],
      ];
      return blocks[i % blocks.length];
    },
  },

  python: {
    imports: ['from __future__ import annotations', '', ''],
    open: () => [],
    close: [],
    member: (i, doc) => {
      const p = names(i);
      const ds = ['    """', ...doc.map((l) => `    ${l}`.replace(/\s+$/, '')), '    """'];
      const blocks: string[][] = [
        [
          `def ${p.verb}_${p.noun}(source, offset=${p.n * 8}):`,
          ...ds,
          `    buffer = source[offset:]`,
          `    return _normalize(buffer)`,
        ],
        [
          `def try_${p.verb}(frame):`,
          ...ds,
          `    if not frame:`,
          `        return None`,
          `    return frame[0]`,
        ],
        [
          `class ${p.Noun}Options:`,
          ...ds,
          `    limit = 0`,
          `    strict = False`,
        ],
      ];
      return blocks[i % blocks.length];
    },
  },
};

function groupParagraphs(paras: string[]): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];
  let length = 0;

  for (const paragraph of paras) {
    if (current.length > 0 && (length >= 340 || current.length >= 2 || paragraph.length > 700)) {
      groups.push(current);
      current = [];
      length = 0;
    }
    current.push(paragraph);
    length += paragraph.length;
  }
  if (current.length > 0) groups.push(current);
  return groups.length > 0 ? groups : [['(this section has no extractable text)']];
}

function pascal(s: string): string {
  const out = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join('');
  return /^[A-Za-z]/.test(out) ? out : `Section${out}`;
}

function renderCode(text: string, opts: DisguiseOptions): Rendered {
  const langId = resolveCodeLang(opts.codeLanguage);
  const lang = CODE_LANGS[langId];
  const lineComment = LINE_COMMENT[langId] ?? '//';
  const width = Math.max(48, opts.wrapColumn - 4);
  const typeName = pascal(opts.chapterTitle || 'Section');

  const groups = groupParagraphs(toParagraphs(text));
  const openLines = lang.open(typeName);

  const out: string[] = [
    `${lineComment} ${typeName} — ${opts.bookTitle}`,
    `${lineComment} part ${opts.pageIndex + 1} of ${opts.pageCount}`,
    '',
    ...lang.imports,
    ...openLines,
  ];
  if (openLines.length > 0) out.push('');

  groups.forEach((group, i) => {
    const doc = group.flatMap((paragraph) => wrapLine(paragraph, width));
    out.push(...lang.member(i, doc), '');
  });

  while (out.length > 0 && out[out.length - 1] === '') out.pop();
  out.push(...lang.close);

  return { content: `${out.join('\n')}\n`, languageId: langId };
}
