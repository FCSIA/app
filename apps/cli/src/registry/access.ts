import type { Access, GroupSpec, Node } from "./types";

// What help knows about the reader: whether they're signed in to the
// selected site and, when the site answered, their roles and feedback access.
export interface Viewer {
  signedIn: boolean;
  // False when signed in but the site couldn't be asked (offline, slow).
  checked: boolean;
  roles: readonly string[];
  canReviewFeedback: boolean;
}

export const SIGNED_OUT: Viewer = { signedIn: false, checked: true, roles: [], canReviewFeedback: false };

export function allows(access: Access, viewer: Viewer) {
  if (access === "public") return true;
  if (!viewer.signedIn) return false;
  if (access === "signedIn" || !viewer.checked) return true;
  const byRole = access.roles?.some((role) => viewer.roles.includes(role)) ?? false;
  const byFeedback =
    access.feedbackReview === true && (viewer.canReviewFeedback || viewer.roles.includes("SUPER_ADMIN"));
  return byRole || byFeedback;
}

// The tree as this viewer may see it: nodes they can't use are dropped, and a
// group with nothing left goes with them. The root always stays.
export function visibleTree(root: GroupSpec, viewer: Viewer): GroupSpec {
  const prune = (node: Node, inherited: Access): Node | null => {
    const access = node.access ?? inherited;
    if (!allows(access, viewer)) return null;
    if (node.kind === "command") return node;
    const children = node.children
      .map((child) => prune(child, access))
      .filter((child): child is Node => child !== null);
    const defaultCommand =
      node.defaultCommand && allows(node.defaultCommand.access ?? access, viewer) ? node.defaultCommand : undefined;
    if (children.length === 0 && !defaultCommand) return null;
    return { ...node, children, defaultCommand };
  };
  const rootAccess = root.access ?? "signedIn";
  return {
    ...root,
    children: root.children
      .map((child) => prune(child, rootAccess))
      .filter((child): child is Node => child !== null),
  };
}

// The rule that applies at a path, after inheritance.
export function accessAt(root: GroupSpec, path: string[]): Access {
  let access: Access = root.access ?? "signedIn";
  let node: Node = root;
  for (const segment of path) {
    if (node.kind !== "group") break;
    const next: Node | undefined = node.children.find((child) => child.name === segment) ??
      (node.defaultCommand?.name === segment ? node.defaultCommand : undefined);
    if (!next) break;
    access = next.access ?? access;
    node = next;
  }
  return access;
}
