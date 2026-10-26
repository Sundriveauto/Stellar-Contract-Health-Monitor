const AVG_LEDGER_SECONDS = 5;

export function shortId(id: string | null | undefined, head = 6, tail = 4): string {
  if (!id) return '—';
  return id.length > head + tail + 1 ? `${id.slice(0, head)}…${id.slice(-tail)}` : id;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return h > 0 && d < 10 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export function timeAgo(date: string | Date | null | undefined, now: Date = new Date()): string {
  if (!date) return 'never';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Math.round((now.getTime() - d.getTime()) / 1000);
  if (diff < 0) return `in ${formatDuration(-diff)}`;
  if (diff < 5) return 'just now';
  return `${formatDuration(diff)} ago`;
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** "123,456 ledgers (~7d)" */
export function formatLedgers(ledgers: number | null | undefined): string {
  if (ledgers === null || ledgers === undefined) return '—';
  if (ledgers <= 0) return 'expired';
  return `${ledgers.toLocaleString()} ledgers (~${formatDuration(ledgers * AVG_LEDGER_SECONDS)})`;
}

export function ledgersToDuration(ledgers: number): string {
  return formatDuration(ledgers * AVG_LEDGER_SECONDS);
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString();
}
