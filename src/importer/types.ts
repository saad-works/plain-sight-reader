export type BookFormat = 'pdf' | 'epub';

export interface Chapter {
  title: string;
  text: string;
}

/** Full book content, persisted as JSON in global storage. */
export interface Book {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  chapters: Chapter[];
}

export interface ReadingPosition {
  chapterIndex: number;
  pageIndex: number;
}

/** Lightweight record kept in globalState for the library list. */
export interface BookMeta {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  importedAt: number;
  chapterTitles: string[];
  position: ReadingPosition;
}
