import { stream } from "convex-helpers/server/stream";
import type { PaginationOptions } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";
import {
  FLEX_CREDITS_REQUIRED_PER_YEAR,
  flexAttendancesInRange,
  semesterRanges,
} from "../flexFriday/_credits";
import { USER_FILTER_KEYS, USER_FILTERS, type UserFilters, type UserSearchTerm } from "../../../shared/admin-user-filters";
import { isStudent } from "../../../shared/roles";
import { schoolYearRange } from "../../../shared/school-time";
import { nameSearchValues } from "../../../shared/user-name";
import { toAdminUserProfile, type UserRoleGroup } from "./_lib";

export const rosterFilterValidator = v.object({
  grade: v.optional(v.array(v.string())),
  major: v.optional(v.array(v.string())),
  minor: v.optional(v.array(v.string())),
  role: v.optional(v.array(v.string())),
  status: v.optional(v.array(v.string())),
  flex: v.optional(v.array(v.string())),
  password: v.optional(v.array(v.string())),
});

export const rosterFlexValidator = v.object({
  earned: v.number(),
  remaining: v.number(),
  fall: v.number(),
  spring: v.number(),
  absences: v.number(),
  excused: v.number(),
  tardies: v.number(),
  lastCreditAt: v.union(v.number(), v.null()),
});

export const rosterDetailsValidator = v.object({
  createdAt: v.number(),
  updatedAt: v.number(),
  mustResetPassword: v.boolean(),
  canReviewFeedback: v.boolean(),
  flex: v.union(rosterFlexValidator, v.null()),
});

export function userRoster(ctx: QueryCtx, year: number) {
  const range = schoolYearRange(year);
  const [fall, spring] = semesterRanges(year);
  const totals = new Map<Id<"users">, ReturnType<typeof readFlex>>();
  const fridays = new Map<Id<"flexFridays">, Promise<Doc<"flexFridays"> | null>>();

  function loadFriday(id: Id<"flexFridays">) {
    const cached = fridays.get(id);
    if (cached) return cached;
    const friday = ctx.db.get(id);
    fridays.set(id, friday);
    return friday;
  }

  async function readFlex(user: Doc<"users">) {
    if (!isStudent(user)) return null;

    const rows = await flexAttendancesInRange(ctx, user._id, range, { loadFriday });
    let earned = 0;
    let fallCredits = 0;
    let springCredits = 0;
    let absences = 0;
    let excused = 0;
    let tardies = 0;
    let lastCreditAt: number | null = null;
    for (const { attendance, friday } of rows) {
      switch (attendance.status) {
        case "PRESENT":
          earned++;
          if (friday.date >= fall.start && friday.date <= fall.end) fallCredits++;
          if (friday.date >= spring.start && friday.date <= spring.end) springCredits++;
          lastCreditAt = Math.max(lastCreditAt ?? friday.date, friday.date);
          break;
        case "ABSENT":
          absences++;
          break;
        case "EXCUSED":
          excused++;
          break;
        case "TARDY":
          tardies++;
          break;
      }
    }
    return {
      earned,
      remaining: Math.max(FLEX_CREDITS_REQUIRED_PER_YEAR - earned, 0),
      fall: fallCredits,
      spring: springCredits,
      absences,
      excused,
      tardies,
      lastCreditAt,
    };
  }

  function flexFor(user: Doc<"users">) {
    const cached = totals.get(user._id);
    if (cached) return cached;
    const pending = readFlex(user);
    totals.set(user._id, pending);
    return pending;
  }

  return {
    async serialize(user: Doc<"users">) {
      return {
        ...toAdminUserProfile(user),
        roster: {
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          mustResetPassword: user.mustResetPassword,
          canReviewFeedback: user.canReviewFeedback ?? false,
          flex: await flexFor(user),
        },
      };
    },

    page(roleGroup: UserRoleGroup, filters: UserFilters, terms: UserSearchTerm[], pagination: PaginationOptions) {
      const users = stream(ctx.db, schema).query("users");
      const source =
        roleGroup === "students" ? users.withIndex("by_isStudent_and_lastName_and_firstName", (q) => q.eq("isStudent", true)) :
        roleGroup === "teachers" ? users.withIndex("by_isTeacherStaff_and_lastName_and_firstName", (q) => q.eq("isTeacherStaff", true)) :
        roleGroup === "student-admin" ? users.withIndex("by_isStudentAdmin_and_lastName_and_firstName", (q) => q.eq("isStudentAdmin", true)) :
        roleGroup === "other" ? users.withIndex("by_isOtherRole_and_lastName_and_firstName", (q) => q.eq("isOtherRole", true)) :
        users.withIndex("by_lastName_and_firstName");
      const selected = USER_FILTER_KEYS.flatMap((key) => {
        const values = filters[key];
        return values?.length ? [{ key, values: USER_FILTERS[key].options.map((option) => option.value).filter((value) => values.includes(value)) }] : [];
      });
      const needsFlex = !!filters.flex?.length || terms.some((term) => term.field === "flex");
      return source.filterWith(async (user) => {
        const values: Record<Exclude<UserSearchTerm["field"], "flex">, string[]> = {
          text: [user.searchText, user.email ?? ""],
          name: nameSearchValues(user),
          id: [user.uniqueId],
          email: [user.email ?? ""],
          grade: [String(user.gradeLevel ?? "")],
          major: [user.major ?? ""],
          minor: [user.minor ?? ""],
          role: user.roles,
          status: [user.isActive ? "active" : "inactive"],
          password: [user.mustResetPassword ? "reset" : "ready"],
        };
        const profileMatches = selected.every(({ key, values: allowed }) => key === "flex" || values[key].some((value) => allowed.includes(value)));
        if (!profileMatches) return false;

        const searchMatches = terms.every(({ field, value, exclude }) => {
          if (field === "flex") return true;
          const exact = field !== "text" && field !== "name" && field !== "id" && field !== "email";
          const found = values[field].some((candidate) => exact ? candidate === value : candidate.toLowerCase().includes(value.toLowerCase()));
          return exclude ? !found : found;
        });
        if (!searchMatches || !needsFlex) return searchMatches;

        const flex = await flexFor(user);
        const progress = !flex ? null : flex.remaining === 0 ? "complete" : flex.earned === 0 ? "none" : "in-progress";
        return (!filters.flex?.length || (progress !== null && filters.flex.includes(progress))) &&
          terms.every(({ field, value, exclude }) => field !== "flex" || (exclude ? value !== progress : value === progress));
      }).paginate({
        ...pagination,
        numItems: Math.max(1, Math.min(50, Math.floor(pagination.numItems || 1))),
        maximumRowsRead: Math.min(pagination.maximumRowsRead ?? (needsFlex ? 50 : 400), needsFlex ? 50 : 400),
      });
    },
  };
}
