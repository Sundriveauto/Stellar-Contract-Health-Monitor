export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Helper for Prisma cursor pagination: fetch limit+1 rows, return the extra row's presence as the cursor. */
export function toPage<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  if (rows.length > limit) {
    const items = rows.slice(0, limit);
    return { items, nextCursor: items[items.length - 1]!.id };
  }
  return { items: rows, nextCursor: null };
}
