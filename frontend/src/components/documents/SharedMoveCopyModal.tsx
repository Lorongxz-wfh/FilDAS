import { useMemo, useState } from "react";
import { Button } from "../ui/Button";
import Modal from "../Modal";
import type { FolderRow as DeptFolderRow } from "../../types/documents";

// Re‑use the shared folder shape from SharedFilesPage
type SharedFolder = {
  id: number;
  name: string;
  parent_id: number | null;
  department_id: number | null;
  department_name?: string | null;
  owner_id: number;
  owner_name?: string | null;
  permission: "viewer" | "editor";
};

type Props = {
  open: boolean;
  mode: "move" | "copy";
  userDepartmentId: number | null;
  departmentFolders: DeptFolderRow[];
  sharedFolders: SharedFolder[];
  onClose: () => void;
  onConfirm: (targetFolderId: number | null) => void;
};

type TreeNode = SharedFolder & { children: TreeNode[] };

type RootGroup = {
  id: string; // for React keys
  label: string;
  departmentId: number | null;
  isOwnDepartment: boolean;
  nodes: TreeNode[];
};

export function SharedMoveCopyModal({
  open,
  mode,
  userDepartmentId,
  departmentFolders,
  sharedFolders,
  onClose,
  onConfirm,
}: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [selectedDestinationId, setSelectedDestinationId] = useState<
    number | null
  >(null);

  // Build trees:
  // - one for own department (if userDepartmentId)
  // - one for each top‑level shared editable root (parent_id === null && permission === "editor")
  const roots = useMemo<RootGroup[]>(() => {
    const groups: RootGroup[] = [];

    const buildTree = (
      source: SharedFolder[] | DeptFolderRow[]
    ): TreeNode[] => {
      const byId = new Map<number, TreeNode>();
      source.forEach((f: any) =>
        byId.set(f.id, { ...(f as any), children: [] })
      );

      const rootNodes: TreeNode[] = [];
      byId.forEach((node) => {
        if (node.parent_id && byId.has(node.parent_id)) {
          byId.get(node.parent_id)!.children.push(node);
        } else {
          rootNodes.push(node);
        }
      });

      const sortTree = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => a.name.localeCompare(b.name));
        nodes.forEach((n) => sortTree(n.children));
      };
      sortTree(rootNodes);

      return rootNodes;
    };

    // 1) Own department group
    if (userDepartmentId != null) {
      const deptFoldersOnly = departmentFolders.filter(
        (f) => f.department_id === userDepartmentId
      );
      if (deptFoldersOnly.length > 0) {
        groups.push({
          id: `dept-${userDepartmentId}`,
          label: "My department",
          departmentId: userDepartmentId,
          isOwnDepartment: true,
          nodes: buildTree(deptFoldersOnly as any),
        });
      }
    }

    // 2) Shared editable roots from sharedFolders
    const editableRoots = sharedFolders.filter(
      (f) => f.parent_id === null && f.permission === "editor"
    );

    editableRoots.forEach((rootFolder) => {
      const sameDeptShared = sharedFolders.filter(
        (f) => f.department_id === rootFolder.department_id
      );

      groups.push({
        id: `shared-${rootFolder.id}`,
        label:
          rootFolder.name +
          (rootFolder.department_name
            ? ` (${rootFolder.department_name})`
            : ""),
        departmentId: rootFolder.department_id,
        isOwnDepartment: false,
        nodes: buildTree(sameDeptShared as any),
      });
    });

    const seen = new Set<string>();
    const unique = groups.filter((g) => {
      if (seen.has(g.id)) return false;
      seen.add(g.id);
      return true;
    });

    return unique;
  }, [departmentFolders, sharedFolders, userDepartmentId]);

  const title = mode === "move" ? "Move to..." : "Copy to...";

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleConfirmClick = () => {
    onConfirm(selectedDestinationId);
  };

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expanded[node.id] ?? true;
    const hasChildren = node.children.length > 0;
    const isSelected = selectedDestinationId === node.id;

    return (
      <div key={node.id}>
        <button
          type="button"
          className={[
            "flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-slate-800",
            isSelected ? "bg-slate-800" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setSelectedDestinationId(node.id)}
          onDoubleClick={handleConfirmClick}
        >
          <div className="flex items-center gap-1">
            <span
              className="inline-flex w-4 justify-center text-slate-400"
              onClick={(e) => {
                e.stopPropagation();
                if (hasChildren) toggleExpanded(node.id);
              }}
            >
              {hasChildren ? (isExpanded ? "▾" : "▸") : ""}
            </span>
            <span
              style={{ paddingLeft: depth * 12 }}
              className="text-slate-100"
            >
              {node.name}
            </span>
          </div>
        </button>
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="text-xs text-slate-300">
          Choose a destination folder (your department or another shared
          location where you are an editor).
        </p>

        <div className="max-h-72 overflow-auto rounded border border-slate-800 bg-slate-900/60">
          {roots.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">
              No destinations available.
            </p>
          ) : (
            roots.map((group) => (
              <div
                key={group.id}
                className="border-b border-slate-800 last:border-b-0"
              >
                <div className="bg-slate-800/60 px-3 py-1 text-[11px] font-semibold uppercase text-slate-400">
                  {group.isOwnDepartment ? "My department" : "Shared location"}:{" "}
                  {group.label}
                </div>
                {group.nodes.map((node) => renderNode(node))}
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button size="xs" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="xs"
            variant="primary"
            onClick={handleConfirmClick}
            disabled={selectedDestinationId === undefined}
          >
            {mode === "move" ? "Move here" : "Copy here"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
