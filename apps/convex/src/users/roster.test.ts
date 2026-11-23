/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { insertUser } from "../../test/fixtures";

vi.mock("../../lib/currentUser", async (original) =>
  (await import("../../test/auth")).currentUserFromIdentity(await original()),
);

const modules = import.meta.glob("/src/**/*.*s");
const schoolYear = 2026;
const page = { cursor: null, numItems: 20 };

test("staff roster agrees with student Flex credits and preserves the basic directory response", async () => {
  const t = convexTest(schema, modules);
  const { staff, student, teacher, otherStudent } = await t.run(async (ctx) => {
    const staff = await insertUser(ctx, { uniqueId: "STAFF", roles: ["SUPPORT_STAFF"] });
    const student = await insertUser(ctx, {
      uniqueId: "TEST1", firstName: "Ada", lastName: "Brown", gradeLevel: 11, major: "ENGINEERING", roles: ["STUDENT"],
    });
    const otherStudent = await insertUser(ctx, {
      uniqueId: "TEST2", firstName: "Sam", lastName: "Clark", gradeLevel: 11, major: "HEALTH_SCIENCE", roles: ["STUDENT"],
    });
    const teacher = await insertUser(ctx, { uniqueId: "TEACHER", roles: ["TEACHER"] });
    const workshopId = await ctx.db.insert("flexWorkshops", {
      title: "Sample", targetGrades: [], targetMajorPathways: [], targetMinorPathways: [], createdAt: 1, updatedAt: 1,
    });
    for (const [date, status] of [
      [Date.UTC(2026, 9, 2, 12), "PRESENT"],
      [Date.UTC(2027, 1, 5, 12), "PRESENT"],
      [Date.UTC(2027, 1, 12, 12), "ABSENT"],
      [Date.UTC(2027, 1, 19, 12), "EXCUSED"],
      [Date.UTC(2027, 1, 26, 12), "TARDY"],
      [Date.UTC(2026, 4, 15, 12), "PRESENT"],
    ] as const) {
      const flexFridayId = await ctx.db.insert("flexFridays", {
        date, type: "ALL_STUDENT", isSchoolDay: true, createdAt: 1,
      });
      await ctx.db.insert("flexAttendances", {
        workshopId, flexFridayId, studentId: student, status, markedById: staff, markedAt: 1, updatedAt: 1,
      });
    }
    return { staff, student, teacher, otherStudent };
  });
  const viewer = t.withIdentity({ subject: staff });
  const pupil = t.withIdentity({ subject: student });
  const options = { paginationOpts: page, roster: { schoolYear, filters: {} } };
  const roster = await viewer.query(api.users.admin.list, options);
  const credits = await pupil.query(api.flexFriday.credits.getMyCredits, { schoolYearStart: schoolYear });
  expect(credits?.earned).toBe(2);
  expect(roster.page.find((user) => user._id === student)?.roster?.flex).toEqual({
    earned: credits?.earned,
    remaining: credits?.remaining,
    fall: credits?.semesters[0]?.earned,
    spring: credits?.semesters[1]?.earned,
    absences: 1, excused: 1, tardies: 1, lastCreditAt: Date.UTC(2027, 1, 5, 12),
  });
  expect(roster.page.find((user) => user._id === teacher)?.roster?.flex).toBeNull();
  expect(roster.page.find((user) => user._id === otherStudent)?.roster?.flex?.earned).toBe(0);
  expect((await viewer.query(api.users.admin.list, { userId: student, paginationOpts: page })).page[0]?.roster).toBeUndefined();
  expect((await viewer.query(api.users.admin.list, { userId: student, ...options })).page[0]?.roster?.flex?.earned).toBe(2);
  expect((await pupil.query(api.users.admin.list, options)).page).toEqual([]);
  expect((await t.query(api.users.admin.list, options)).page).toEqual([]);

  const first = await viewer.query(api.users.admin.list, {
    roleGroup: "students",
    roster: { schoolYear, filters: { grade: ["10", "11"] }, search: "status:active" },
    paginationOpts: { cursor: null, numItems: 1 },
  });
  expect(first.page.map((user) => user._id)).toEqual([student]);
  expect(first.isDone).toBe(false);
  const next = await viewer.query(api.users.admin.list, {
    roleGroup: "students",
    roster: { schoolYear, filters: { grade: ["10", "11"] }, search: "status:active" },
    paginationOpts: { cursor: first.continueCursor, numItems: 1 },
  });
  expect(next.page.map((user) => user._id)).toEqual([otherStudent]);

  const filtered = await viewer.query(api.users.admin.list, {
    ...options,
    roster: { schoolYear, filters: { flex: ["in-progress"] }, search: 'grade:11 -major:"Health Science"' },
  });
  expect(filtered.page.map((user) => user._id)).toEqual([student]);
});
