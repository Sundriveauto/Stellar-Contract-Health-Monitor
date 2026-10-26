import {
  decideLevelTransition,
  describeInactivity,
  evaluateInactivity,
  isCoolingDown,
} from '@stellar-health/alert-engine';
import { inactivityConfigSchema } from '@stellar-health/shared-types';
import { openAlertFor, resolveLevelAlert, triggerAlert } from './alerts';
import type { WorkerDeps } from './deps';

/** Evaluates INACTIVITY rules across all active contracts. */
export async function checkInactivity(deps: WorkerDeps) {
  const { prisma } = deps;
  const rules = await prisma.alertRule.findMany({ where: { enabled: true, type: 'INACTIVITY' } });
  if (rules.length === 0) return { evaluated: 0 };
  const now = deps.now();
  let evaluated = 0;

  for (const rule of rules) {
    const config = inactivityConfigSchema.safeParse(rule.config);
    if (!config.success) {
      deps.logger.warn({ ruleId: rule.id }, 'invalid inactivity rule config');
      continue;
    }
    const contracts = await prisma.contract.findMany({
      where: { status: 'ACTIVE', ...(rule.contractRefId ? { id: rule.contractRefId } : {}) },
    });
    for (const contract of contracts) {
      evaluated++;
      try {
        // Only judge inactivity once ingestion is actually running for this contract.
        if (!contract.lastPolledAt || contract.consecutiveFailures > 0) continue;
        const monitoringSince = new Date(
          Math.max(contract.createdAt.getTime(), rule.createdAt.getTime()),
        );
        const result = evaluateInactivity({
          config: config.data,
          lastEventAt: contract.lastEventAt,
          monitoringSince,
          now,
        });
        const { state, openAlertId } = await openAlertFor(deps, rule.id, contract.id);
        const transition = decideLevelTransition({
          conditionActive: result.inactive,
          hasOpenAlert: openAlertId !== null,
          coolingDown: isCoolingDown(state?.lastTriggeredAt ?? null, rule.cooldownSeconds, now),
        });
        if (transition === 'trigger') {
          await triggerAlert(deps, {
            rule,
            contract,
            severity: rule.severity,
            level: true,
            description: describeInactivity({
              ruleName: rule.name,
              contract,
              idleSeconds: result.idleSeconds,
              windowSeconds: config.data.windowSeconds,
              lastEventAt: contract.lastEventAt,
            }),
          });
        } else if (transition === 'resolve' && openAlertId) {
          await resolveLevelAlert(deps, { rule, contractRefId: contract.id, alertId: openAlertId });
        }
      } catch (err) {
        deps.logger.error(
          { err, ruleId: rule.id, contractRefId: contract.id },
          'failed to evaluate inactivity rule',
        );
      }
    }
  }
  return { evaluated };
}
