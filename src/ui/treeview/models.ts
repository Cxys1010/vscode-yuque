/** TreeView node types */
import type { Workspace, DocSummary } from "../../api/shared/workspace";

export type TreeNode =
  | { kind: "yuque-root"; connected: boolean }
  | { kind: "repo"; data: Workspace }
  | { kind: "doc"; data: DocSummary; namespace: string }
  | { kind: "loading"; label: string }
  | { kind: "error"; label: string; message: string };

export function getTreeItemContext(node: TreeNode): string {
  return node.kind;
}
