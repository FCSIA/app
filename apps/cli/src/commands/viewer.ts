import { api } from "../../../convex/src/_generated/api";
import { loadCredential } from "../client/credentials";
import { resolveHost } from "../client/host";
import { connect } from "../client/session";
import { CliError } from "../core/errors";
import { SIGNED_OUT, type Viewer } from "../registry/access";
import type { CommandContext } from "../registry/types";

// Help waits this long for the site before listing every signed-in command.
const LOOKUP_MS = 4000;

export interface ResolvedViewer extends Viewer {
  host: string;
  // Why the site couldn't be asked, when it couldn't.
  unchecked?: "offline" | "password_reset_required";
}

const SIGNED_OUT_REASONS = new Set(["not_signed_in", "session_expired", "invalid_token"]);

// Who is reading help, from the saved sign-in and one `me` read. Never throws:
// help still works offline, showing what a signed-in account could use.
export async function resolveViewer(context: CommandContext): Promise<ResolvedViewer> {
  const { host } = resolveHost(context);
  const credential = await loadCredential(context, host).catch(() => null);
  if (!credential) return { ...SIGNED_OUT, host };
  const unchecked = (reason: ResolvedViewer["unchecked"]): ResolvedViewer => ({
    signedIn: true,
    checked: false,
    roles: [],
    canReviewFeedback: false,
    host,
    unchecked: reason,
  });
  // A real timer, not runtime.sleep: a short wait only bounds a slow site.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const lookup = (async () => {
    const connection = await connect(context);
    return connection.client.query(api.users.me.me, {});
  })();
  try {
    const me = await Promise.race([
      lookup,
      new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), LOOKUP_MS);
      }),
    ]);
    if (me === "timeout") return unchecked("offline");
    if (!me) return { ...SIGNED_OUT, host };
    return {
      signedIn: true,
      checked: true,
      roles: me.roles,
      canReviewFeedback: me.canReviewFeedback === true,
      host,
    };
  } catch (error) {
    if (error instanceof CliError && SIGNED_OUT_REASONS.has(error.reason)) return { ...SIGNED_OUT, host };
    if (/password reset required/i.test(error instanceof Error ? error.message : String(error))) {
      return unchecked("password_reset_required");
    }
    return unchecked("offline");
  } finally {
    clearTimeout(timer);
    lookup.catch(() => {});
  }
}
