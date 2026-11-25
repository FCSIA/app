import { Migrations } from '@convex-dev/migrations';
import { v } from 'convex/values';
import { internalMutation } from '../_generated/server';
import { components, internal } from '../_generated/api';
import type { DataModel } from '../_generated/dataModel';
import { typedAuditLookups, typedAuditPatch } from './_typed';
import { auditCategory } from '../../../shared/audit';
import { auditByActor, auditByCategory } from './_aggregates';

/** Widen-first, idempotent backfill; invoke only on an authorized deployment. */
export const backfill = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    // Rows are backfilled oldest first, so a partial run must not look complete
    // to `auditIndexReady`. An existing state row (ready or running) stays as is.
    if (!cursor && !(await ctx.db.query('auditIndexState').withIndex('by_key', (q) => q.eq('key', 'v1')).unique())) {
      await ctx.db.insert('auditIndexState', { key: 'v1', ready: false });
    }
    const result = await ctx.db.query('auditEvents').withIndex('by_createdAt')
      .paginate({ cursor: cursor ?? null, numItems: 100 });
    for (const row of result.page) {
      const category = auditCategory(row.entityType, row.action);
      if (row.category !== category) await ctx.db.patch(row._id, { category });
      // The legacy CLUB_JOINED writer retained the actor in meta. Other
      // omitted actors cannot be recovered and remain explicitly unknown.
      const candidate = row.action === 'CLUB_JOINED' && !row.actorId && row.meta && typeof row.meta.userId === 'string'
        ? ctx.db.normalizeId('users', row.meta.userId) : null;
      const actorId = candidate && await ctx.db.get(candidate) ? candidate : row.actorId;
      if (actorId !== row.actorId) await ctx.db.patch(row._id, { actorId });
      const doc = { ...row, category, actorId };
      await auditByCategory.insertIfDoesNotExist(ctx, doc);
      await auditByActor.insertIfDoesNotExist(ctx, doc);
    }
    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.audit.migrations.backfill, { cursor: result.continueCursor });
    } else {
      const state = await ctx.db.query('auditIndexState').withIndex('by_key', (q) => q.eq('key', 'v1')).unique();
      if (state) await ctx.db.patch(state._id, { ready: true });
      else await ctx.db.insert('auditIndexState', { key: 'v1', ready: true });
    }
    return null;
  },
});

const migrations = new Migrations<DataModel>(components.migrations);

/**
 * Brings every stored row to the typed shape staged in schema.ts: one
 * canonical record type, the system marker and impersonating admin out of
 * `meta`, and the details older writers left out (whose schedule, which
 * role by name). Idempotent; rows already typed are skipped. The actor and
 * the derived category never change here, so the audit aggregates stay as
 * they are.
 *
 *   convex run audit/migrations:typeAuditEvents '{"dryRun":true}'
 *   convex run audit/migrations:typeAuditEvents
 */
export const typeAuditEvents = migrations.define({
  table: 'auditEvents',
  batchSize: 100,
  migrateOne: async (ctx, row) => {
    const patch = typedAuditPatch(row, await typedAuditLookups(ctx, row));
    // The aggregates key rows by the category derived from action and record
    // type (not the stored field); a canonical spelling must not move a row.
    if (patch?.entityType && auditCategory(patch.entityType, row.action) !== auditCategory(row.entityType, row.action))
      throw new Error(`Audit row ${row._id} would move between categories; update the aggregates first.`);
    return patch ?? undefined;
  },
});
