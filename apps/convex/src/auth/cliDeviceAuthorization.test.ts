import { describe, expect, test, vi } from "vitest";
import type { GenericCtx } from "@convex-dev/better-auth";
import type { DataModel } from "../_generated/dataModel";
import {
  CLI_CLIENT_ID,
  cliDeviceVerificationUri,
  isCliClient,
  isCliDeviceRequest,
  createCliSignInPlugin,
  requestsPreboundUser,
} from "./cliDeviceAuthorization";
import { describeCliClient } from "../users/cliSessions";

vi.mock("better-auth/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("better-auth/api")>(),
  createAuthMiddleware: (handler: unknown) => handler,
  getSessionFromCtx: async () => null,
}));

describe("CLI device authorization", () => {
  test("accepts only the command-line client", () => {
    expect(isCliClient(CLI_CLIENT_ID)).toBe(true);
    expect(isCliClient("")).toBe(false);
    expect(isCliClient("fcsia-cli ")).toBe(false);
    expect(isCliClient("some-other-app")).toBe(false);
  });

  test("sends people to the web approval page on the site origin", () => {
    expect(cliDeviceVerificationUri("https://app.fcsia.com")).toBe(
      "https://app.fcsia.com/device",
    );
    expect(cliDeviceVerificationUri("http://localhost:3000/ignored/path")).toBe(
      "http://localhost:3000/device",
    );
  });

  test("refuses device codes pre-bound to a user", () => {
    expect(requestsPreboundUser({ client_id: CLI_CLIENT_ID, user_id: "user_1" })).toBe(true);
    expect(requestsPreboundUser({ client_id: CLI_CLIENT_ID, user_id: "" })).toBe(true);
    expect(requestsPreboundUser({ client_id: CLI_CLIENT_ID })).toBe(false);
    expect(requestsPreboundUser(null)).toBe(false);
    expect(requestsPreboundUser("user_id")).toBe(false);
  });

  test("allows only the client and permissions described by the approval page", () => {
    for (const scope of [undefined, null, ""]) expect(isCliDeviceRequest(CLI_CLIENT_ID, scope)).toBe(true);
    for (const scope of ["read", "admin", " ", [], {}]) expect(isCliDeviceRequest(CLI_CLIENT_ID, scope)).toBe(false);
    expect(isCliDeviceRequest("another-client", "")).toBe(false);
  });

  test("checks stored requests before lookup and direct approval, including old codes", async () => {
    const plugin = createCliSignInPlugin({} as GenericCtx<DataModel>);
    const hook = plugin.hooks!.before![1]!;
    for (const path of ["/device", "/device/approve"]) {
      expect(hook.matcher({ path } as never)).toBe(true);
      for (const record of [null, { clientId: "other" }, { clientId: CLI_CLIENT_ID, scope: "admin" }]) {
        const findOne = vi.fn().mockResolvedValue(record);
        await expect(hook.handler({
          path, query: { user_code: "ABCD-EFGH" }, body: { userCode: "ABCD-EFGH" },
          context: { adapter: { findOne } },
        } as never)).rejects.toMatchObject({ body: { error: "invalid_request" } });
        expect(findOne).toHaveBeenCalledWith({ model: "deviceCode", where: [{ field: "userCode", value: "ABCDEFGH" }] });
      }
      await expect(hook.handler({
        path, query: { user_code: "ABCDEFGH" }, body: { userCode: "ABCDEFGH" },
        context: { adapter: { findOne: vi.fn().mockResolvedValue({ clientId: CLI_CLIENT_ID, scope: null }) } },
      } as never)).resolves.toBeUndefined();
    }
  });

  test("rejects scoped requests at issuance before creating a code", async () => {
    const hook = createCliSignInPlugin({} as GenericCtx<DataModel>).hooks!.before![0]!;
    for (const body of [{ client_id: CLI_CLIENT_ID, scope: "admin" }, { client_id: "other" }, { client_id: CLI_CLIENT_ID, user_id: "victim" }]) {
      await expect(hook.handler({ body } as never)).rejects.toMatchObject({ body: { error: "invalid_request" } });
    }
    await expect(hook.handler({ body: { client_id: CLI_CLIENT_ID } } as never)).resolves.toBeUndefined();
  });
});

describe("CLI session descriptions", () => {
  test("names the version and platform the CLI reports", () => {
    expect(describeCliClient("fcsia/0.1.0 (darwin; arm64)")).toEqual({
      version: "0.1.0",
      platform: "macOS arm64",
      label: "Command-line client 0.1.0 on macOS",
    });
    expect(describeCliClient("fcsia/1.2.0-beta.1 (linux; x64) bun/1.3").platform).toBe("Linux x64");
  });

  test("never echoes an unrecognized user agent", () => {
    for (const agent of [undefined, null, "", "curl/8.0", "fcsia/<script> (darwin; arm64)"]) {
      expect(describeCliClient(agent)).toEqual({
        version: null,
        platform: null,
        label: "Command-line client",
      });
    }
  });
});

