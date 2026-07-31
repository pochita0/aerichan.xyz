import type { BookmarkItem } from '../types';

export const BOOKMARKS_STORAGE_KEY = 'aeri-dashboard:bookmarks';
export const LEGACY_BOOKMARKS_STORAGE_KEY = 'bookmarks';

const hasUsableBookmarkShape = (item: unknown): item is BookmarkItem => {
  if (!item || typeof item !== 'object') return false;
  const candidate = item as Partial<BookmarkItem>;
  if (typeof candidate.name !== 'string' || candidate.name.trim() === '') return false;
  if (candidate.type === 'folder') return true;
  return typeof candidate.url === 'string' && candidate.url.trim() !== '';
};

export const parseBookmarkStorageValue = (value: string | null): BookmarkItem[] | null => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    if (!parsed.every(hasUsableBookmarkShape)) return null;
    return parsed as BookmarkItem[];
  } catch {
    return null;
  }
};

export const getInitialBookmarks = (): BookmarkItem[] => {
  const currentRaw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
  const current = parseBookmarkStorageValue(currentRaw);
  if (current) return current;

  const legacyRaw = localStorage.getItem(LEGACY_BOOKMARKS_STORAGE_KEY);
  const legacy = parseBookmarkStorageValue(legacyRaw);
  if (legacy) {
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(legacy));
    localStorage.setItem(`${LEGACY_BOOKMARKS_STORAGE_KEY}-migrated-backup-${Date.now()}`, legacyRaw || '[]');
    return legacy;
  }

  if (legacyRaw && legacyRaw !== '[]') {
    localStorage.setItem(`${LEGACY_BOOKMARKS_STORAGE_KEY}-rejected-backup-${Date.now()}`, legacyRaw);
  }

  return [];
};

export const normalizeBookmarkStorageValue = (value: string | null | undefined) => {
  const parsed = parseBookmarkStorageValue(value ?? null);
  return parsed ? JSON.stringify(parsed) : null;
};
