import { usageError } from "../core/errors";
import { createTheme } from "../core/theme";
import { helpDocument, listCommands, renderHelp } from "../registry/help";
import { route } from "../registry/parse";
import { accessAt, allows, visibleTree } from "../registry/access";
import type { CommandContext, CommandSpec, GroupSpec, Node } from "../registry/types";
import { resolveViewer, type ResolvedViewer } from "./viewer";

export function helpTheme(context: Pick<CommandContext, "modes">) {
  // Help is styled only for a detected color terminal, never when forced.
  const { stdout } = context.modes;
  return createTheme(stdout.detectedColor && stdout.color && stdout.isTTY, stdout.rich);
}

// A line under help that explains why it lists what it lists.
function viewerNote(context: CommandContext, viewer: ResolvedViewer, available: boolean) {
  const login = `\`${context.commandName} login\``;
  if (!viewer.signedIn) {
    return available
      ? `Sign in with ${login} to see the commands your account can use.`
      : `Sign in with ${login} to use this.`;
  }
  if (viewer.unchecked === "password_reset_required") {
    return `Change your password at ${viewer.host}/change-password to see the commands your account can use.`;
  }
  if (viewer.unchecked === "offline") {
    return `Couldn't reach ${viewer.host} to check your access, so this lists every command for signed-in accounts.`;
  }
  return available ? null : "Your account can't use this.";
}

export async function printHelp(context: CommandContext, node: Node, path: string[]) {
  const viewer = await resolveViewer(context);
  const visible = visibleTree(context.root, viewer);
  const available = path.length === 0 || allows(accessAt(context.root, path), viewer);
  // The reader's own view of the node they asked about, when they can use it.
  let shown: Node = path.length === 0 ? visible : node;
  if (path.length > 0 && available && node.kind === "group") {
    let found: Node = visible;
    for (const segment of path) {
      const next: Node | undefined = found.kind === "group" ? found.children.find((child) => child.name === segment) : undefined;
      if (!next) break;
      found = next;
    }
    if (found.name === node.name) shown = found;
  }
  if (context.globals.json) {
    context.out.print(
      JSON.stringify(
        {
          command: helpDocument(shown, path, context.commandName),
          viewer: { signedIn: viewer.signedIn, checked: viewer.checked, available },
        },
        null,
        context.modes.stdout.isTTY ? 2 : undefined,
      ),
    );
    return;
  }
  const text = renderHelp(shown, path, visible, {
    commandName: context.commandName,
    theme: helpTheme(context),
    width: context.modes.stdout.width,
  }).trimEnd();
  // Signed in and checked, the root says nothing extra; anywhere else the
  // reader learns why something is missing.
  const note = path.length === 0 && viewer.signedIn && viewer.checked ? null : viewerNote(context, viewer, available);
  context.out.print(note ? `${text}\n\n${note}` : text);
}

function table(context: CommandContext, rows: Array<[string, string]>, headers: [string, string]) {
  context.out.table(headers, rows);
}

const showHelp: CommandSpec = {
  kind: "command",
  name: "help",
  summary: "Show help for a command",
  json: true,
  arguments: [{ name: "command", required: false, variadic: true, description: "Command path, such as cli alias set" }],
  options: [{ name: "all", type: "boolean", description: "List every command" }],
  examples: [
    { description: "Show help for a command", argv: ["help", "cli", "alias", "set"] },
    { description: "Read every command's help as JSON", argv: ["help", "--all", "--json"] },
  ],
  async run(context) {
    const { commandName } = context;
    if (context.options.all === true) {
      const commands = listCommands(visibleTree(context.root, await resolveViewer(context)));
      if (context.globals.json) {
        context.out.document({
          commands: commands.map(({ node, path }) => helpDocument(node, path, commandName)),
        });
        return;
      }
      table(
        context,
        commands.map(({ node, path }) => [[commandName, ...path].join(" "), node.summary]),
        ["Command", "Summary"],
      );
      return;
    }
    const routed = route(context.root, context.args);
    if (routed.unknownSegment !== null) {
      throw usageError(
        "unknown_command",
        `Unknown command ${routed.unknownSegment} for ${[commandName, ...routed.path].join(" ")}.`,
        { next: [{ benefit: "See the commands", argv: [...routed.path, "--help"] }] },
      );
    }
    await printHelp(context, routed.node, routed.path);
  },
};

function score(query: string[], path: string[], summary: string) {
  const words = summary.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let total = 0;
  for (const term of query) {
    if (path.includes(term)) total += 5;
    else if (path.some((segment) => segment.startsWith(term))) total += 3;
    if (words.includes(term)) total += 2;
    else if (words.some((word) => word.startsWith(term))) total += 1;
  }
  return total;
}

const searchHelp: CommandSpec = {
  kind: "command",
  name: "search",
  summary: "Find commands by what they do",
  json: true,
  arguments: [{ name: "query", required: true, variadic: true, description: "Words to look for" }],
  examples: [{ description: "Find the command that renames the CLI", argv: ["help", "search", "alias"] }],
  notes: ["Search never records the query. It lists only commands your account can use."],
  async run(context) {
    const query = context.args.join(" ").toLowerCase().split(/\s+/).filter(Boolean);
    const matches = listCommands(visibleTree(context.root, await resolveViewer(context)))
      .map(({ node, path }) => ({ path, summary: node.summary, score: score(query, path, node.summary) }))
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score || a.path.join(" ").localeCompare(b.path.join(" ")))
      .slice(0, 10);

    const label = (path: string[]) => [context.commandName, ...path].join(" ");
    if (context.globals.json) {
      context.out.document({
        commands: matches.map((match) => ({ path: match.path.join(" "), summary: match.summary })),
      });
      return;
    }
    if (matches.length === 0) {
      context.out.text(`No commands match "${context.args.join(" ")}".`);
      return;
    }
    table(context, matches.map((match) => [label(match.path), match.summary]), ["Command", "Summary"]);
  },
};

export const helpGroup: GroupSpec = {
  access: "public",
  kind: "group",
  name: "help",
  summary: "Show help for a command",
  section: "Setup",
  children: [searchHelp],
  defaultCommand: showHelp,
};
