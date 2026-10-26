import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@stellar-health/db';
import { generateWebhookSecret } from '@stellar-health/alert-engine';
import {
  createDestinationSchema,
  emailConfigSchema,
  updateDestinationSchema,
  webhookConfigSchema,
} from '@stellar-health/shared-types';
import { notFound } from '../lib/errors';
import { serializeDelivery, serializeDestination } from '../lib/serialize';
import type { AppDeps } from '../app';

export async function destinationRoutes(app: FastifyInstance, { prisma, jobs }: AppDeps) {
  app.get('/destinations', async () => {
    const rows = await prisma.notificationDestination.findMany({ orderBy: { createdAt: 'desc' } });
    const stats = await prisma.notificationDelivery.groupBy({
      by: ['destinationId', 'status'],
      _count: { _all: true },
      where: { createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } },
    });
    return {
      items: rows.map((d) => ({
        ...serializeDestination(d),
        last7Days: Object.fromEntries(
          stats.filter((s) => s.destinationId === d.id).map((s) => [s.status, s._count._all]),
        ),
      })),
    };
  });

  app.post('/destinations', async (req, reply) => {
    const body = createDestinationSchema.parse(req.body);
    const config =
      body.type === 'WEBHOOK'
        ? { ...body.config, secret: body.config.secret ?? generateWebhookSecret() }
        : body.config;
    const d = await prisma.notificationDestination.create({
      data: {
        name: body.name,
        type: body.type,
        enabled: body.enabled,
        config: config as Prisma.InputJsonValue,
      },
    });
    reply.status(201);
    // The secret is shown in full once, so the receiver can be configured.
    return serializeDestination(d, { revealSecret: true });
  });

  app.patch('/destinations/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = updateDestinationSchema.parse(req.body);
    const existing = await prisma.notificationDestination.findUnique({ where: { id } });
    if (!existing) throw notFound('Destination');
    let config: Prisma.InputJsonValue | undefined;
    if (body.config) {
      const current = existing.config as Record<string, unknown>;
      config =
        existing.type === 'WEBHOOK'
          ? (webhookConfigSchema.parse({
              ...current,
              ...body.config,
              secret: body.config.secret ?? current.secret,
            }) as Prisma.InputJsonValue)
          : (emailConfigSchema.parse(body.config) as Prisma.InputJsonValue);
    }
    const d = await prisma.notificationDestination.update({
      where: { id },
      data: { name: body.name, enabled: body.enabled, config },
    });
    return serializeDestination(d);
  });

  app.post('/destinations/:id/rotate-secret', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const existing = await prisma.notificationDestination.findUnique({ where: { id } });
    if (!existing || existing.type !== 'WEBHOOK') throw notFound('Webhook destination');
    const d = await prisma.notificationDestination.update({
      where: { id },
      data: { config: { ...(existing.config as object), secret: generateWebhookSecret() } },
    });
    return serializeDestination(d, { revealSecret: true });
  });

  app.delete('/destinations/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    await prisma.notificationDestination.delete({ where: { id } });
    reply.status(204);
  });

  app.post('/destinations/:id/test', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const d = await prisma.notificationDestination.findUnique({ where: { id } });
    if (!d) throw notFound('Destination');
    const delivery = await prisma.notificationDelivery.create({
      data: { destinationId: id, kind: 'test' },
      include: { destination: { select: { id: true, name: true, type: true } } },
    });
    await jobs.enqueueDelivery(delivery.id);
    reply.status(202);
    return serializeDelivery(delivery);
  });

  app.get('/destinations/:id/deliveries', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const rows = await prisma.notificationDelivery.findMany({
      where: { destinationId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { destination: { select: { id: true, name: true, type: true } } },
    });
    return { items: rows.map(serializeDelivery) };
  });
}
