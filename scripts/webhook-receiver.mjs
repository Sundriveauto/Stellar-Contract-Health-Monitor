#!/usr/bin/env node
/**
 * Minimal webhook receiver for local testing. Verifies signatures when WEBHOOK_SECRET is set.
 *   WEBHOOK_SECRET=whsec_... node scripts/webhook-receiver.mjs [port]
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? process.env.PORT ?? 4100);
const secret = process.env.WEBHOOK_SECRET;

createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const ts = req.headers['x-schm-timestamp'];
    const sig = req.headers['x-schm-signature'];
    let verified = 'not checked (no WEBHOOK_SECRET)';
    if (secret) {
      const expected = `sha256=${createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')}`;
      const ok =
        typeof sig === 'string' &&
        sig.length === expected.length &&
        timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
      verified = ok ? 'valid' : 'INVALID';
      if (!ok) {
        res.statusCode = 401;
        res.end('bad signature');
        console.log(`[${new Date().toISOString()}] rejected delivery: bad signature`);
        return;
      }
    }
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = body;
    }
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} signature=${verified}`);
    console.log(JSON.stringify(parsed, null, 2));
    res.statusCode = 200;
    res.end('ok');
  });
}).listen(port, () => console.log(`Webhook receiver listening on http://localhost:${port}`));
