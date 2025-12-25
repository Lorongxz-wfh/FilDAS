import { useMemo, useState } from "react";
import type { FolderRow, Department } from "../../types/documents";
import { Button } from "../ui/Button";
import Modal from "../Modal";

type Props = {
  open: boolean;
  mode: "move" | "copy";
  currentDepartment: Department | null;
  folders: FolderRow[];
  currentFolder: FolderRow | null;
  onClose: () => void;
  onConfirm: (targetFolderId: number | null) => void;
};

type TreeNode = FolderRow & { children: TreeNode[] };

export function MoveCopyModal({
  open,
  mode,
  currentDepartment,
  folders,
  currentFolder,
  onClose,
  onConfirm,
}: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  // build tree of folders in this department
  const roots = useMemo<TreeNode[]>(() => {
    if (!currentDepartment) return [];

    const deptFolders = folders.filter(
      (f) => f.department_id === currentDepartment.id
    );
    const byId = new Map<number, TreeNode>();
    deptFolders.forEach((f) => byId.set(f.id, { ...f, children: [] }));

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
  }, [folders, currentDepartment]);

  if (!currentDepartment) return null;

  const title = mode === "move" ? "Move to..." : "Copy to...";

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expanded[node.id] ?? true;
    const hasChildren = node.children.length > 0;
    const isCurrent = currentFolder && currentFolder.id === node.id;

    return (
      <div key={node.id}>
        <button
          type="button"
          className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-slate-800 ${
            isCurrent ? "bg-slate-800/60" : ""
          }`}
          onClick={() => onConfirm(node.id)}
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
          {isCurrent && (
            <span className="text-[10px] text-slate-500">(current)</span>
          )}
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
          Choose a destination folder in {currentDepartment.name}.
        </p>

        <div className="max-h-72 overflow-auto rounded border border-slate-800 bg-slate-900/60">
          {/* department root */}
          <button
            type="button"
            className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-slate-800 ${
              !currentFolder ? "bg-slate-800/60" : ""
            }`}
            onClick={() => onConfirm(null)}
          >
            <div className="flex items-center gap-1">
              <span className="inline-flex w-4" />
              <span className="text-slate-100">Department root</span>
            </div>
            {!currentFolder && (
              <span className="text-[10px] text-slate-500">(current)</span>
            )}
          </button>

          {/* folder tree */}
          {roots.map((node) => renderNode(node))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button size="xs" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
