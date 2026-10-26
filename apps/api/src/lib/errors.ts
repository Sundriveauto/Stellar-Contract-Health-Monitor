import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@stellar-health/db';
import { RpcError } from '@stellar-health/stellar-client';

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, 'NOT_FOUND', `${what} not found`);

export function errorHandler(err: FastifyError | Error, req: FastifyRequest, reply: FastifyReply) {
  if (err instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.issues
          .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
          .join('; '),
        details: err.issues,
      },
    });
  }
  if (err instanceof HttpError) {
    return reply
      .status(err.statusCode)
      .send({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof RpcError) {
    req.log.warn({ err }, 'RPC error');
    return reply.status(502).send({
      error: {
        code: 'RPC_ERROR',
        message: `Stellar RPC error: ${err.message}`,
        details: { kind: err.kind },
      },
    });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025')
      return reply
        .status(404)
        .send({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
    if (err.code === 'P2002')
      return reply
        .status(409)
        .send({ error: { code: 'CONFLICT', message: 'Resource already exists' } });
    if (err.code === 'P2003')
      return reply.status(400).send({
        error: { code: 'INVALID_REFERENCE', message: 'Referenced resource does not exist' },
      });
  }
  const fe = err as FastifyError;
  if (fe.statusCode && fe.statusCode < 500) {
    return reply
      .status(fe.statusCode)
      .send({ error: { code: fe.code ?? 'BAD_REQUEST', message: fe.message } });
  }
  req.log.error({ err }, 'Unhandled error');
  return reply.status(500).send({ error: { code: 'INTERNAL', message: 'Internal server error' } });
}
