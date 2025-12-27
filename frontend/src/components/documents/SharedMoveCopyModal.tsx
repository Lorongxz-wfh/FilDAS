import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import type { FolderRow as DeptFolderRow } from "../../types/documents";
import Modal from "../Modal";
import { api } from "../../lib/api"; // Make sure this path is correct

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

type TreeScope = "department" | "shared";

type TreeNode = {
  id: number;
  name: string;
  parent_id: number | null;
  department_id: number | null;
  department_name?: string | null;
  owner_id: number;
  owner_name?: string | null;
  permission: "viewer" | "editor";
  scope: TreeScope;
  children: TreeNode[];
  hasLoadedChildren: boolean; // NEW: Track if we've fetched API data for this node
};

type RootGroup = {
  id: string;
  label: string;
  departmentId: number | null;
  isOwnDepartment: boolean;
  nodes: TreeNode[];
};

type Props = {
  open: boolean;
  mode: "move" | "copy";
  userDepartmentId: number | null;
  departmentFolders: DeptFolderRow[];
  departmentLoading?: boolean;
  sharedFolders: SharedFolder[]; // Initial seed data (roots)
  onClose: () => void;
  onConfirm: (targetFolderId: number | null) => void;
};

export function SharedMoveCopyModal({
  open,
  mode,
  userDepartmentId,
  departmentFolders,
  departmentLoading: deptLoading,
  sharedFolders,
  onClose,
  onConfirm,
}: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [loadingNodes, setLoadingNodes] = useState<Record<number, boolean>>({}); // Track API loading per node
  const [selectedDestinationId, setSelectedDestinationId] = useState<
    number | null
  >(null);

  const [roots, setRoots] = useState<RootGroup[]>([]);

  // Helper to convert raw data to TreeNode
  const makeNode = (f: any, scope: TreeScope): TreeNode => ({
    id: f.id,
    name: f.name,
    parent_id: f.parent_id ?? null,
    department_id: f.department_id ?? null,
    department_name: f.department_name ?? null,
    owner_id: f.owner_id ?? 0,
    owner_name: f.owner_name ?? null,
    permission: f.permission ?? "editor",
    scope,
    children: [],
    // For departments, we have all data upfront. For shared, we assume not loaded initially.
    hasLoadedChildren: scope === "department",
  });

  // Build initial tree roots
  useEffect(() => {
    if (!open) return;

    const groups: RootGroup[] = [];

    // 1. Department Root
    if (userDepartmentId != null) {
      const deptRoots = departmentFolders.filter(
        (f) => f.department_id === userDepartmentId && f.parent_id === null
      );
      if (deptRoots.length > 0) {
        groups.push({
          id: `dept-${userDepartmentId}`,
          label: "My department",
          departmentId: userDepartmentId,
          isOwnDepartment: true,
          nodes: deptRoots.map((f) => makeNode(f, "department")),
        });
      }
    }

    // 2. Shared Roots (Top-level items shared with me)
    // We filter sharedFolders passed from props to only show top-level ones
    const editableRoots = sharedFolders.filter(
      (f) => f.parent_id === null && f.permission === "editor"
    );

    if (editableRoots.length > 0) {
      groups.push({
        id: "shared-editable",
        label: "Shared locations",
        departmentId: null,
        isOwnDepartment: false,
        nodes: editableRoots.map((f) => makeNode(f, "shared")),
      });
    }

    setRoots(groups);
    setExpanded({});
    setSelectedDestinationId(null);
  }, [open, departmentFolders, sharedFolders, userDepartmentId]);

  const title = mode === "move" ? "Move to..." : "Copy to...";

  // recursive search to update the tree state
  const updateNodeInTree = (
    nodes: TreeNode[],
    targetId: number,
    updateFn: (node: TreeNode) => TreeNode
  ): TreeNode[] => {
    return nodes.map((node) => {
      if (node.id === targetId) {
        return updateFn(node);
      }
      if (node.children.length > 0) {
        return {
          ...node,
          children: updateNodeInTree(node.children, targetId, updateFn),
        };
      }
      return node;
    });
  };

  const handleToggleExpand = async (node: TreeNode) => {
    // 1. If we are collapsing, just update state
    if (expanded[node.id]) {
      setExpanded((prev) => ({ ...prev, [node.id]: false }));
      return;
    }

    // 2. If expanding...
    // If Department scope, data is already in props, just find children
    if (node.scope === "department") {
      // Logic for department (pre-loaded)
      const children = departmentFolders
        .filter((f) => f.parent_id === node.id)
        .map((f) => makeNode(f, "department"));

      // Update tree with children
      setRoots((prev) =>
        prev.map((g) => ({
          ...g,
          nodes: updateNodeInTree(g.nodes, node.id, (n) => ({
            ...n,
            children,
            hasLoadedChildren: true,
          })),
        }))
      );
      setExpanded((prev) => ({ ...prev, [node.id]: true }));
      return;
    }

    // 3. If Shared scope, we might need to fetch from API
    if (node.scope === "shared") {
      // If we already loaded children before, just expand
      if (node.hasLoadedChildren) {
        setExpanded((prev) => ({ ...prev, [node.id]: true }));
        return;
      }

      // FETCH FROM API
      setLoadingNodes((prev) => ({ ...prev, [node.id]: true }));
      try {
        const res = await api.get("/folders/shared", {
          params: { parent_id: node.id },
        });

        const rawData = res.data.data ?? res.data ?? [];
        // Filter only ones we can edit (optional, depending on business rule)
        const childFolders = rawData
          .filter((f: any) => f.permission === "editor")
          .map((f: any) => makeNode(f, "shared"));

        // Insert into tree
        setRoots((prev) =>
          prev.map((g) => ({
            ...g,
            nodes: updateNodeInTree(g.nodes, node.id, (n) => ({
              ...n,
              children: childFolders,
              hasLoadedChildren: true, // Mark as loaded so we don't fetch again
            })),
          }))
        );
        setExpanded((prev) => ({ ...prev, [node.id]: true }));
      } catch (err) {
        console.error("Failed to load shared subfolders", err);
      } finally {
        setLoadingNodes((prev) => ({ ...prev, [node.id]: false }));
      }
    }
  };

  const handleConfirmClick = () => {
    onConfirm(selectedDestinationId);
  };

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expanded[node.id] ?? false;
    const isSelected = selectedDestinationId === node.id;
    const isLoading = loadingNodes[node.id] ?? false;

    // Logic to decide if we show the chevron
    // Department: check if children exist in prop array
    // Shared: If loaded, check children length. If NOT loaded, assume true (to allow fetch)
    let hasChildren = false;
    if (node.scope === "department") {
      hasChildren = departmentFolders.some((f) => f.parent_id === node.id);
    } else {
      if (!node.hasLoadedChildren)
        hasChildren = true; // Assume yes to show chevron
      else hasChildren = node.children.length > 0;
    }

    return (
      <div key={node.id}>
        <div
          className={[
            "flex w-full items-center px-2 py-1.5 text-left text-xs hover:bg-slate-800",
            isSelected ? "bg-slate-800" : "",
          ].join(" ")}
        >
          <div style={{ width: depth * 12 }} />

          {/* Chevron / Loading Spinner */}
          <span
            className={[
              "mr-1 flex h-4 w-4 items-center justify-center rounded cursor-pointer",
              hasChildren || isLoading
                ? "hover:bg-slate-700 text-slate-100"
                : "opacity-0 cursor-default",
            ].join(" ")}
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren && !isLoading) handleToggleExpand(node);
            }}
          >
            {isLoading ? (
              <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
            ) : hasChildren ? (
              isExpanded ? (
                "▾"
              ) : (
                "▸"
              )
            ) : (
              ""
            )}
          </span>

          {/* Folder Name (Click to select) */}
          <button
            type="button"
            className="truncate text-slate-100 flex-1 text-left"
            onClick={() => setSelectedDestinationId(node.id)}
            onDoubleClick={handleConfirmClick}
          >
            {node.name}
          </button>
        </div>

        {isExpanded && node.children.length > 0 && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="flex h-80 flex-col space-y-3 text-sm">
        <p className="text-xs text-slate-300">
          Choose a destination folder (your department or another shared
          location where you are an editor).
        </p>

        <div className="flex-1 overflow-auto rounded border border-slate-800 bg-slate-900/60">
          {deptLoading && roots.length === 0 ? (
            <div className="flex h-full items-center justify-center px-3 py-6 text-xs text-slate-300">
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border border-slate-500 border-t-transparent" />
              Loading destinations...
            </div>
          ) : roots.length === 0 ? (
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
                  {group.isOwnDepartment && deptLoading && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-slate-300">
                      <span className="h-3 w-3 animate-spin rounded-full border border-slate-500 border-t-transparent" />
                      Loading...
                    </span>
                  )}
                </div>
                {group.nodes.map((node) => renderNode(node))}
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button size="xs" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="xs"
            variant="primary"
            onClick={handleConfirmClick}
            disabled={selectedDestinationId == null}
          >
            {mode === "move" ? "Move here" : "Copy here"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
