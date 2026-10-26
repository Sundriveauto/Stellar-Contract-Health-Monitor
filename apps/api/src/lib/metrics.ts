import client from 'prom-client';

export function createMetrics() {
  const registry = new client.Registry();
  registry.setDefaultLabels({ service: 'api' });
  client.collectDefaultMetrics({ register: registry });

  const httpDuration = new client.Histogram({
    name: 'schm_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });
  return { registry, httpDuration };
}
export type ApiMetrics = ReturnType<typeof createMetrics>;
