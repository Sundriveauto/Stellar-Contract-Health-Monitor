/**
 * Positional topic matching:
 *  - each filter entry matches the topic at the same index
 *  - "*" matches exactly one topic of any value
 *  - "**" as the final entry matches zero or more remaining topics
 *  - a filter shorter than the topic list is a prefix match ("transfer" matches all transfers)
 * An empty filter matches every event.
 */
export function matchTopics(filter: readonly string[], topics: readonly string[]): boolean {
  for (let i = 0; i < filter.length; i++) {
    const f = filter[i]!;
    if (f === '**') return true;
    const t = topics[i];
    if (t === undefined) return false;
    if (f === '*') continue;
    if (f !== t) return false;
  }
  return true;
}
