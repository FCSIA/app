import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeBackend } from "../fakeBackend";
import { run } from "../testing";

let config: string;

beforeEach(() => {
  config = mkdtempSync(join(tmpdir(), "fcsia-help-access-"));
});

afterEach(() => rmSync(config, { recursive: true, force: true }));

async function signedIn(profile: Record<string, unknown>) {
  const backend = fakeBackend({ profile });
  const secrets = new Map<string, string>();
  const invoke = (argv: string[]) =>
    run(argv, { fetch: backend.handle, secrets, env: { FCSIA_CONFIG_DIR: config } });
  expect((await invoke(["login"])).code).toBe(0);
  return invoke;
}

function listed(stdout: string) {
  return (JSON.parse(stdout).commands as Array<{ path: string }>).map((command) => command.path);
}

const student = {
  _id: "user1",
  uniqueId: "203000500",
  firstName: "Casey",
  lastName: "Brooks",
  preferredName: null,
  roles: ["STUDENT"],
  mustResetPassword: false,
};

describe("help lists what the reader can use", () => {
  test("signed out, only setup and account commands, with a way to sign in", async () => {
    const result = await run(["--help"], { env: { FCSIA_CONFIG_DIR: config } });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("login");
    expect(result.stdout).not.toMatch(/\btoday\b/);
    expect(result.stdout).not.toMatch(/\baudit\b/);
    expect(result.stdout).toContain("Sign in with `fcsia login`");
  });

  test("a student sees their commands but no staff ones", async () => {
    const invoke = await signedIn(student);
    const all = listed((await invoke(["help", "--all", "--json"])).stdout);
    expect(all).toContain("today");
    expect(all).toContain("cli config edit");
    expect(all.some((path) => path.startsWith("audit"))).toBe(false);
    expect(all.some((path) => path.startsWith("users"))).toBe(false);
    expect(all.some((path) => path.startsWith("feedback"))).toBe(false);
  });

  test("support staff see users and audit, but not admin-only user changes", async () => {
    const invoke = await signedIn({ ...student, roles: ["SUPPORT_STAFF"] });
    const all = listed((await invoke(["help", "--all", "--json"])).stdout);
    expect(all).toContain("audit list");
    expect(all).toContain("users list");
    expect(all).not.toContain("users delete");
    expect(all).not.toContain("users activate");
  });

  test("feedback access follows the flag, not a role", async () => {
    const invoke = await signedIn({ ...student, canReviewFeedback: true });
    const all = listed((await invoke(["help", "--all", "--json"])).stdout);
    expect(all.some((path) => path.startsWith("feedback"))).toBe(true);
  });

  test("help for a command the account can't use says so", async () => {
    const invoke = await signedIn(student);
    const result = await invoke(["audit", "--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Your account can't use this.");
  });
});

describe("cli config", () => {
  test("edit opens the settings file, creating it first", async () => {
    const result = await run(["cli", "config", "edit"], {
      env: { FCSIA_CONFIG_DIR: config },
      stdoutTTY: true,
      stderrTTY: true,
      stdinTTY: true,
    });
    expect(result.code).toBe(0);
    expect(result.edited).toEqual([join(config, "config.json")]);
  });

  test("edit needs a terminal and names the file instead", async () => {
    const result = await run(["cli", "config", "edit"], { env: { FCSIA_CONFIG_DIR: config } });
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain(join(config, "config.json"));
  });

  test("path prints where the settings live", async () => {
    const result = await run(["cli", "config", "path"], { env: { FCSIA_CONFIG_DIR: config } });
    expect(result.stdout.trim()).toBe(join(config, "config.json"));
  });
});
