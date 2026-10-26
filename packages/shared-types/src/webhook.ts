import type { AlertRuleType, AlertSeverity } from './enums';
import type { Network } from './networks';

/** Body POSTed to webhook destinations. Versioned so receivers can evolve safely. */
export interface WebhookPayload {
  version: 1;
  /** Unique per delivery attempt chain; use for idempotency on the receiver side. */
  deliveryId: string;
  type: 'alert.triggered' | 'alert.resolved' | 'test';
  sentAt: string;
  alert: {
    id: string;
    title: string;
    message: string;
    severity: AlertSeverity;
    status: string;
    triggeredAt: string;
    rule: { id: string; name: string; type: AlertRuleType } | null;
    contract: { id: string; contractId: string; network: Network; label: string | null } | null;
    context: Record<string, unknown>;
  };
}

export const WEBHOOK_SIGNATURE_HEADER = 'x-schm-signature';
export const WEBHOOK_TIMESTAMP_HEADER = 'x-schm-timestamp';
export const WEBHOOK_DELIVERY_HEADER = 'x-schm-delivery';
