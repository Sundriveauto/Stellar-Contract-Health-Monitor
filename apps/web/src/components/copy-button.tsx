'use client';

import { useState } from 'react';

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="rounded px-1.5 py-0.5 text-xs text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100 dark:text-slate-400 dark:ring-slate-700 dark:hover:bg-slate-800"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      aria-label={`${label}: ${value}`}
    >
      {copied ? 'Copied' : label}
    </button>
  );
}
