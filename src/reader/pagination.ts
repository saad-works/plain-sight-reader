const FALLBACK_SIZE = 1600;

/**
 * Split a chapter's text into pages of roughly `charsPerPage` characters,
 * breaking on paragraph boundaries where possible.
 */
export function paginate(text: string, charsPerPage: number): string[] {
  const size = charsPerPage >= 400 ? charsPerPage : FALLBACK_SIZE;
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const pages: string[] = [];
  let current = '';

  const flush = () => {
    if (current.trim().length > 0) pages.push(current.trim());
    current = '';
  };

  for (const paragraph of paragraphs) {
    let para = paragraph;

    // Hard-split paragraphs that are longer than a page on their own.
    while (para.length > size * 1.5) {
      flush();
      const cut = para.lastIndexOf(' ', size);
      const at = cut > size * 0.5 ? cut : size;
      pages.push(para.slice(0, at).trim());
      para = para.slice(at).trimStart();
    }

    if (current && current.length + para.length + 2 > size) {
      flush();
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }

  flush();
  return pages.length > 0 ? pages : [''];
}
