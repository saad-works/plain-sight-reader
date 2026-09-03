import { parse, HTMLElement, TextNode, Node } from 'node-html-parser';

const BLOCK_TAGS = new Set([
  'p', 'div', 'section', 'article', 'header', 'footer', 'main', 'aside',
  'blockquote', 'pre', 'figure', 'figcaption', 'ul', 'ol', 'li', 'dl', 'dd', 'dt',
  'table', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr',
]);

/** Strip XML prolog, DOCTYPE, and processing instructions that parsers may surface as text. */
function stripProlog(html: string): string {
  return html
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '');
}

/** Convert an XHTML/HTML document (an EPUB spine item) into readable plain text. */
export function htmlToText(html: string): string {
  const root = parse(stripProlog(html), { comment: false });
  root.querySelectorAll('script, style, head').forEach((el) => el.remove());

  const parts: string[] = [];
  walk(root, parts);
  return normalize(parts.join(''));
}

function walk(node: Node, out: string[]): void {
  for (const child of node.childNodes) {
    if (child instanceof TextNode) {
      const text = child.text;
      if (text) out.push(text.replace(/\s+/g, ' '));
    } else if (child instanceof HTMLElement) {
      const tag = (child.rawTagName || '').toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'head') continue;
      if (tag === 'br' || tag === 'hr') {
        out.push('\n');
        continue;
      }
      const isBlock = BLOCK_TAGS.has(tag);
      if (isBlock) out.push('\n');
      walk(child, out);
      if (isBlock) out.push('\n');
    }
  }
}

function normalize(s: string): string {
  return s
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Best-effort chapter title from a spine item. */
export function firstHeading(html: string): string | undefined {
  const root = parse(stripProlog(html), { comment: false });
  const heading = root.querySelector('h1, h2, h3, h4');
  const headingText = heading?.text?.trim().replace(/\s+/g, ' ');
  if (headingText) return headingText.slice(0, 80);

  const title = root.querySelector('title')?.text?.trim().replace(/\s+/g, ' ');
  return title ? title.slice(0, 80) : undefined;
}
