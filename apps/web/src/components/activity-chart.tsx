'use client';

/** Small dependency-free bar chart of event counts per time bucket. */
export function ActivityChart({
  points,
  bucket,
  hours,
}: {
  points: { t: string; count: number }[];
  bucket: 'hour' | 'day';
  hours: number;
}) {
  const stepMs = bucket === 'hour' ? 3600_000 : 86400_000;
  const now = Date.now();
  const start = Math.floor((now - hours * 3600_000) / stepMs) * stepMs;
  const buckets: { t: number; count: number }[] = [];
  const byTime = new Map(points.map((p) => [new Date(p.t).getTime(), p.count]));
  for (let t = start; t <= now; t += stepMs) buckets.push({ t, count: byTime.get(t) ?? 0 });
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((s, b) => s + b.count, 0);
  const w = 100 / buckets.length;

  return (
    <figure>
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="h-28 w-full"
        role="img"
        aria-label={`${total} events in the last ${hours} hours`}
      >
        {buckets.map((b, i) => {
          const h = (b.count / max) * 38;
          return (
            <rect
              key={b.t}
              x={i * w + w * 0.1}
              y={40 - h}
              width={w * 0.8}
              height={Math.max(h, b.count > 0 ? 0.8 : 0.2)}
              rx={0.4}
              className={b.count > 0 ? 'fill-indigo-500' : 'fill-slate-200 dark:fill-slate-800'}
            >
              <title>{`${new Date(b.t).toLocaleString()}: ${b.count} events`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>
          {new Date(start).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        <span>
          {total.toLocaleString()} events · peak {max.toLocaleString()}/{bucket}
        </span>
        <span>now</span>
      </figcaption>
    </figure>
  );
}
