import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Flag, FlagConfig } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { badRequest, conflict, notFound, parse } from '../lib/errors';
import { requireScope } from '../middleware/auth';

// TRD §11.2. Lowercase, alphanumeric, hyphens; must start and end alphanumeric.
const FLAG_KEY = /^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$/;

const createFlagBody = z.object({
  key: z
    .string()
    .regex(
      FLAG_KEY,
      'Flag key must be 3-120 lowercase letters, digits, or hyphens, starting and ending alphanumeric.',
    ),
  name: z.string().min(1, 'Name is required.').max(200),
  description: z.string().max(5000).optional(),
  flagType: z.enum(['BOOLEAN', 'MULTIVARIATE']).optional(),
});

const rolloutBody = z.object({
  percentage: z
    .number({ invalid_type_error: 'Rollout percentage must be a number.' })
    .int('Rollout percentage must be a whole number.')
    .min(0, 'Rollout percentage must be between 0 and 100.')
    .max(100, 'Rollout percentage must be between 0 and 100.'),
});

const listQuery = z.object({ search: z.string().trim().min(1).max(200).optional() });

const lockBody = z.object({
  reason: z.string().trim().min(1, 'A lock reason is required.').max(500),
});

type ConfigPatch = Partial<
  Pick<FlagConfig, 'enabled' | 'rolloutPercentage' | 'locked' | 'lockReason' | 'lockedBy' | 'lockedAt'>
>;

/**
 * The actions rollback can undo. Lock and unlock are deliberate admin decisions,
 * not rollout changes - an undo must never silently re-lock a flag that someone
 * chose to unlock.
 */
const UNDOABLE = ['flag.enabled', 'flag.disabled', 'flag.rollout', 'flag.rollback'];

/** What an audit entry records. Only the fields a rollback could ever need to restore. */
const snapshot = (
  c: Pick<FlagConfig, 'enabled' | 'rolloutPercentage' | 'locked' | 'lockReason'>,
) => ({
  enabled: c.enabled,
  rolloutPercentage: c.rolloutPercentage,
  locked: c.locked,
  lockReason: c.lockReason,
});

const auditMetadata = (req: FastifyRequest) => ({
  keyPrefix: req.auth.keyPrefix,
  ip: req.ip,
  userAgent: req.headers['user-agent'] ?? null,
  requestId: req.id,
});

function serialize(flag: Flag & { flagConfigs: FlagConfig[] }, envSlug: string) {
  const config = flag.flagConfigs[0];
  return {
    key: flag.key,
    name: flag.name,
    description: flag.description,
    flagType: flag.flagType,
    environment: envSlug,
    enabled: config?.enabled ?? false,
    rolloutPercentage: config?.rolloutPercentage ?? 0,
    targetingRules: config?.targetingRules ?? null,
    locked: config?.locked ?? false,
    lockReason: config?.lockReason ?? null,
    createdAt: flag.createdAt,
    updatedAt: config?.updatedAt ?? flag.updatedAt,
  };
}

async function findFlagOrThrow(orgId: string, envId: string, key: string) {
  const flag = await prisma.flag.findFirst({
    where: { orgId, key, archivedAt: null },
    include: { flagConfigs: { where: { envId } } },
  });
  if (!flag) throw notFound(`Flag "${key}" does not exist.`);
  return flag;
}

/**
 * Every flag state change funnels through here: one lock check, one transaction,
 * one audit row. Week 3's rollback and lock/unlock reuse it rather than
 * re-implementing the pattern - a mutation that bypasses this helper is a mutation
 * with no audit trail, and TRD §12.2 rates a missing audit write as Critical.
 */
async function mutateConfig(
  req: FastifyRequest,
  key: string,
  action: string,
  next: (current: FlagConfig) => ConfigPatch,
  options: { allowLocked?: boolean } = {},
) {
  const { orgId, envId, envSlug, actorId } = req.auth;

  const flag = await findFlagOrThrow(orgId, envId, key);
  const current = flag.flagConfigs[0];
  if (!current) {
    throw notFound(`Flag "${key}" has no configuration in the "${envSlug}" environment.`);
  }

  // Fast path, purely for the error message: this is the only place that knows
  // the lock reason. The real enforcement is the WHERE clause below.
  if (current.locked && !options.allowLocked) {
    throw conflict(
      `Flag "${key}" is locked: ${current.lockReason ?? 'no reason recorded'}. An admin must unlock it first.`,
    );
  }

  const patch = next(current);

  const config = await prisma.$transaction(async (tx) => {
    // `locked: false` in the WHERE makes the check and the write one atomic
    // statement, so a lock landing between the read above and this update cannot
    // slip through. Unlock is the one mutation allowed to target a locked row.
    const { count } = await tx.flagConfig.updateMany({
      where: { id: current.id, ...(options.allowLocked ? {} : { locked: false }) },
      data: patch,
    });

    if (count === 0) {
      // Throwing inside an interactive transaction rolls it back, so no audit row
      // is left behind describing a change that never happened.
      throw conflict(`Flag "${key}" was locked by someone else before this change landed.`);
    }

    await tx.auditLog.create({
      data: {
        orgId,
        envId,
        flagId: flag.id,
        actorId,
        actorType: 'api_key',
        action,
        beforeState: snapshot(current),
        afterState: snapshot({ ...current, ...patch }),
        metadata: auditMetadata(req),
      },
    });

    return tx.flagConfig.findUniqueOrThrow({ where: { id: current.id } });
  });

  return serialize({ ...flag, flagConfigs: [config] }, envSlug);
}

export async function flagRoutes(app: FastifyInstance) {
  app.post('/flags', async (req, reply) => {
    const body = parse(createFlagBody, req.body);
    const { orgId, envId, envSlug, actorId } = req.auth;

    const existing = await prisma.flag.findUnique({
      where: { orgId_key: { orgId, key: body.key } },
    });
    if (existing) throw conflict(`Flag "${body.key}" already exists in this organization.`);

    const environments = await prisma.environment.findMany({
      where: { orgId },
      select: { id: true },
    });

    const flag = await prisma.$transaction(async (tx) => {
      const created = await tx.flag.create({
        data: {
          orgId,
          key: body.key,
          name: body.name,
          description: body.description,
          flagType: body.flagType ?? 'BOOLEAN',
          createdBy: actorId,
          // A flag with no config in an environment is invisible to that
          // environment's SDKs. Create all of them up front so no environment can
          // silently be missing one.
          flagConfigs: { create: environments.map((env) => ({ envId: env.id })) },
        },
        include: { flagConfigs: { where: { envId } } },
      });

      await tx.auditLog.create({
        data: {
          orgId,
          flagId: created.id,
          envId: null, // a flag is created across every environment at once
          actorId,
          actorType: 'api_key',
          action: 'flag.created',
          afterState: { key: created.key, name: created.name, flagType: created.flagType },
          metadata: auditMetadata(req),
        },
      });

      return created;
    });

    return reply.code(201).send(serialize(flag, envSlug));
  });

  app.get('/flags', async (req) => {
    const { search } = parse(listQuery, req.query ?? {});
    const { orgId, envId, envSlug } = req.auth;

    // ponytail: hard cap instead of pagination. Free tier allows 10 flags and no
    // real org is near 500 - add skip/take when someone actually hits the ceiling.
    const flags = await prisma.flag.findMany({
      where: {
        orgId,
        archivedAt: null,
        ...(search
          ? {
              OR: [
                { key: { contains: search, mode: 'insensitive' as const } },
                { name: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: { flagConfigs: { where: { envId } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return { environment: envSlug, flags: flags.map((f) => serialize(f, envSlug)) };
  });

  app.get('/flags/:key', async (req) => {
    const { key } = req.params as { key: string };
    const flag = await findFlagOrThrow(req.auth.orgId, req.auth.envId, key);
    return serialize(flag, req.auth.envSlug);
  });

  app.post('/flags/:key/enable', async (req) => {
    const { key } = req.params as { key: string };
    // Rollout percentage is deliberately preserved - re-enabling a flag that was
    // at 25% puts it back at 25%, not at 0%.
    return mutateConfig(req, key, 'flag.enabled', () => ({ enabled: true }));
  });

  app.post('/flags/:key/disable', async (req) => {
    const { key } = req.params as { key: string };
    // Disable is the kill switch, so it resets rollout too (TRD §4.3.2). The prior
    // percentage survives in the audit row, which is what rollback reads.
    return mutateConfig(req, key, 'flag.disabled', () => ({
      enabled: false,
      rolloutPercentage: 0,
    }));
  });

  app.post('/flags/:key/rollout', async (req) => {
    const { key } = req.params as { key: string };
    const { percentage } = parse(rolloutBody, req.body);

    return mutateConfig(req, key, 'flag.rollout', (current) => {
      if (!current.enabled) {
        throw badRequest(
          `Flag "${key}" is disabled. Enable it before setting a rollout percentage.`,
          'percentage',
        );
      }
      return { rolloutPercentage: percentage };
    });
  });

  app.post('/flags/:key/rollback', async (req) => {
    const { key } = req.params as { key: string };
    const { orgId, envId, envSlug } = req.auth;

    const flag = await findFlagOrThrow(orgId, envId, key);

    // Undo, not "restore a known-good state": this takes the most recent change
    // in this environment and puts back what was there before it. A second
    // rollback therefore undoes the first. One rule, no special cases.
    const previous = await prisma.auditLog.findFirst({
      where: { flagId: flag.id, envId, action: { in: UNDOABLE } },
      orderBy: { createdAt: 'desc' },
      select: { action: true, beforeState: true },
    });

    if (!previous?.beforeState) {
      throw conflict(
        `Flag "${key}" has not been changed in "${envSlug}" yet, so there is nothing to roll back.`,
      );
    }

    const before = previous.beforeState as { enabled: boolean; rolloutPercentage: number };

    return mutateConfig(req, key, 'flag.rollback', () => ({
      enabled: before.enabled,
      rolloutPercentage: before.rolloutPercentage,
    }));
  });

  app.post('/flags/:key/lock', { preHandler: requireScope('admin') }, async (req) => {
    const { key } = req.params as { key: string };
    const { reason } = parse(lockBody, req.body);

    return mutateConfig(
      req,
      key,
      'flag.locked',
      (current) => {
        if (current.locked) {
          throw conflict(
            `Flag "${key}" is already locked: ${current.lockReason ?? 'no reason recorded'}.`,
          );
        }
        return {
          locked: true,
          lockReason: reason,
          lockedBy: req.auth.actorId,
          lockedAt: new Date(),
        };
      },
      // Lock and unlock are the two operations that legitimately target lock
      // state, so they skip the generic guard and raise their own errors - an
      // admin locking an already-locked flag should be told it is already
      // locked, not that an admin must unlock it first.
      { allowLocked: true },
    );
  });

  app.post('/flags/:key/unlock', { preHandler: requireScope('admin') }, async (req) => {
    const { key } = req.params as { key: string };

    return mutateConfig(
      req,
      key,
      'flag.unlocked',
      (current) => {
        if (!current.locked) throw conflict(`Flag "${key}" is not locked.`);
        return { locked: false, lockReason: null, lockedBy: null, lockedAt: null };
      },
      // See the note on lock above.
      { allowLocked: true },
    );
  });

  app.delete('/flags/:key', { preHandler: requireScope('admin') }, async (req) => {
    const { key } = req.params as { key: string };
    const { orgId, actorId } = req.auth;

    const flag = await prisma.flag.findFirst({
      where: { orgId, key, archivedAt: null },
      include: { flagConfigs: { where: { locked: true }, include: { env: true } } },
    });
    if (!flag) throw notFound(`Flag "${key}" does not exist.`);

    // Archiving evaluates the flag to false everywhere, which is exactly what a
    // lock exists to prevent. A lock in any environment blocks it.
    const locked = flag.flagConfigs[0];
    if (locked) {
      throw conflict(
        `Flag "${key}" is locked in "${locked.env.slug}": ${locked.lockReason ?? 'no reason recorded'}. Unlock it before archiving.`,
      );
    }

    // Soft delete. Audit rows and configs stay; list and /evaluate already
    // filter on archivedAt so the flag disappears from both immediately.
    await prisma.$transaction([
      prisma.flag.update({ where: { id: flag.id }, data: { archivedAt: new Date() } }),
      prisma.auditLog.create({
        data: {
          orgId,
          flagId: flag.id,
          envId: null, // archive spans every environment, like create
          actorId,
          actorType: 'api_key',
          action: 'flag.archived',
          beforeState: { archived: false },
          afterState: { archived: true },
          metadata: auditMetadata(req),
        },
      }),
    ]);

    return { key: flag.key, archived: true };
  });

  app.get('/flags/:key/history', async (req) => {
    const { key } = req.params as { key: string };
    const flag = await findFlagOrThrow(req.auth.orgId, req.auth.envId, key);

    const entries = await prisma.auditLog.findMany({
      where: { flagId: flag.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        action: true,
        actorType: true,
        beforeState: true,
        afterState: true,
        metadata: true,
        createdAt: true,
        env: { select: { slug: true } },
        actor: { select: { name: true, email: true } },
      },
    });

    return {
      flag: flag.key,
      entries: entries.map((e) => ({
        action: e.action,
        environment: e.env?.slug ?? null,
        actor: { name: e.actor.name, email: e.actor.email, via: e.actorType },
        before: e.beforeState,
        after: e.afterState,
        metadata: e.metadata,
        at: e.createdAt,
      })),
    };
  });
}
