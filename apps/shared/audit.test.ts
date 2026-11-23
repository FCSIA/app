import { describe, expect, test } from "vitest";
import { AUDIT_ACTIONS, auditActionKind } from "./audit";

describe("auditActionKind", () => {
  test("every recorded action has a kind", () => {
    const missing = Object.keys(AUDIT_ACTIONS).filter((action) => !auditActionKind(action));
    expect(missing).toEqual([]);
  });

  test("explicit kinds win over the label's verb", () => {
    expect(auditActionKind("user.roles_assigned")).toBe("access");
    expect(auditActionKind("KEYWORD_REMOVED")).toBe("rule");
    expect(auditActionKind("CLUB_DELETED")).toBe("delete");
  });

  test("retired actions have no kind", () => {
    expect(auditActionKind("RETIRED_ACTION")).toBeUndefined();
  });
});
