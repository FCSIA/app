import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const FLEX_CREDITS_REQUIRED_PER_YEAR = 12;
export const FLEX_CREDITS_REQUIRED_PER_SEMESTER = 6;

/**
 * A student's Flex attendance rows whose Friday falls inside `range`, each with
 * its Friday. A credit is a PRESENT row, so `presentOnly` skips reading the
 * Friday of the others.
 */
export async function flexAttendancesInRange(
  ctx: QueryCtx | MutationCtx,
  studentId: Id<"users">,
  range: { start: number; end: number },
  options: {
    presentOnly?: boolean;
    limit?: number;
    loadFriday?: (id: Id<"flexFridays">) => Promise<Doc<"flexFridays"> | null>;
  } = {},
) {
  const query = ctx.db
    .query("flexAttendances")
    .withIndex("by_studentId_and_flexFridayId", (q) => q.eq("studentId", studentId));
  const rows = options.limit === undefined ? await query.collect() : await query.take(options.limit);
  const inRange = await Promise.all(
    rows.map(async (attendance) => {
      if (options.presentOnly && attendance.status !== "PRESENT") return null;
      const friday = await (options.loadFriday?.(attendance.flexFridayId) ?? ctx.db.get(attendance.flexFridayId));
      if (!friday || friday.date < range.start || friday.date > range.end) return null;
      return { attendance, friday };
    }),
  );
  return inRange.filter(
    (row): row is { attendance: Doc<"flexAttendances">; friday: Doc<"flexFridays"> } => row !== null,
  );
}

export function semesterRanges(startYear: number) {
  return [
    {
      key: "FALL" as const,
      label: `Fall ${startYear}`,
      start: new Date(startYear, 7, 1).getTime(),
      end: new Date(startYear, 11, 31, 23, 59, 59, 999).getTime(),
    },
    {
      key: "SPRING" as const,
      label: `Spring ${startYear + 1}`,
      start: new Date(startYear + 1, 0, 1).getTime(),
      end: new Date(startYear + 1, 4, 31, 23, 59, 59, 999).getTime(),
    },
  ] as const;
}
