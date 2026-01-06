// src/pages/DocumentManagerPage.tsx
import { useEffect, useState } from "react";
import { useLocation, useOutletContext } from "react-router-dom";

import { api } from "../../../lib/api";
import { Button } from "../../../components/ui/Button";

import { useDocumentPreview } from "../hooks/useDocumentPreview";
import { useDocumentNavigation } from "../hooks/useDocumentNavigation";
import { usePolling } from "../hooks/usePolling";
import { applySort, computeVisibleItems } from "../../../lib/documentsSorting";
import { formatSize } from "../lib/formatSize";
import { useResizableDetails } from "../hooks/useResizableDetails";
import { useItemRenameDelete } from "../hooks/useItemRenameDelete";
import { useDocumentActions } from "../hooks/useDocumentActions";
import { notify } from "../../../lib/notify";

type LayoutContext = {
  user: {
    id: number;
    name: string;
    email: string;
    department_id: number | null;
    role?: { id: number; name: string } | null;
  };
  // “admin-ish” (Super Admin or Admin)
  isAdmin: boolean;
  // truly global role
  isSuperAdmin: boolean;
};

import type {
  DocumentRow,
  FolderRow,
  DocumentPreview,
  Department,
  ViewMode,
  SortMode,
  Item,
} from "../../../types/documents";

import { DocumentGrid } from "../../../components/documents/DocumentGrid";
import { DocumentList } from "../../../components/documents/DocumentList";
import { DetailsPanel } from "../../../components/documents/DetailsPanel";
import { DocumentUploadModal } from "../../../components/documents/DocumentUploadModal";
import { NewFolderModal } from "../../../components/documents/NewFolderModal";
import { RenameModal } from "../../../components/documents/RenameModal";
import { MoveCopyModal } from "../../../components/documents/MoveCopyModal";
import { SelectionActionsToolbar } from "../../../components/documents/SelectionActionsToolbar";
import { ViewSortSearchBar } from "../../../components/documents/ViewSortSearchBar";

const Loader = () => (
  <div className="flex h-full items-center justify-center py-10">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
  </div>
);

export default function DocumentManagerPage() {
  const { user, isAdmin, isSuperAdmin } = useOutletContext<LayoutContext>();

  const location = useLocation() as {
    pathname: string;
    search: string;
    state?: { departmentId?: number };
  };

  const searchParams = new URLSearchParams(location.search ?? "");

  const initialDocIdParam = searchParams.get("docId");
  const initialDocId = initialDocIdParam ? Number(initialDocIdParam) : null;

  const initialDepartmentId = location.state?.departmentId ?? null;

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortMode, setSortMode] = useState<SortMode>("alpha");
  const [schoolYearFilter, setSchoolYearFilter] = useState<string>(""); // "" = all years

  const {
    departments,
    folders,
    documents,
    setDepartments,
    setFolders,
    setDocuments,
    currentDepartment,
    currentFolder,
    setCurrentDepartment,
    setCurrentFolder,
    loading,
    error,
    setError,
    searchQuery,
    setSearchQuery,
    debouncedSearch,
    handleGoBack,
    folderAncestors,
    loadDepartmentContents,
    loadFolderContents,
  } = useDocumentNavigation({
    isSuperAdmin,
    userDepartmentId: user.department_id,
    initialDepartmentId,
    schoolYearFilter,
  });

  useEffect(() => {
    if (!initialDocId) return;
    if (!documents || documents.length === 0) return;

    const doc = documents.find((d) => d.id === initialDocId);
    if (!doc) return;

    setSelectedItem({ kind: "file", data: doc });
    setDetailsOpen(true);
  }, [initialDocId, documents]);

  // console.log("doc manager folders sample", folders.slice(0, 10));

  const [uploadOpen, setUploadOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);

  const [uploadMode, setUploadMode] = useState<"files" | "folder">("files");

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderError, setFolderError] = useState<string | null>(null);

  const { detailsWidth, setDetailsWidth, handleDetailsResizeStart } =
    useResizableDetails(320);

  const {
    isBusy,
    setIsBusy,
    handleDownload,
    handleDownloadFolder,
    handleTrashSelected,
    moveSelected,
    copySelected,
    replaceFile,
  } = useDocumentActions({
    currentDepartment,
    currentFolder,
    setDepartments,
    setFolders,
    setDocuments,
    loadDepartmentContents,
    loadFolderContents,
  });

  const {
    selectedItem,
    setSelectedItem,
    detailsOpen,
    setDetailsOpen,
    renameOpen,
    setRenameOpen,
    renameName,
    setRenameName,
    renaming,
    renameError,
    setRenameError,
    getItemName,
    handleRenameSubmit,
    handleDeleteSelected,
  } = useItemRenameDelete({
    currentDepartment,
    currentFolder,
    setCurrentDepartment,
    setCurrentFolder,
    setDepartments,
    setFolders,
    setDocuments,
    onBusyChange: setIsBusy,
  });

  const { previewUrl, previewLoading } = useDocumentPreview({
    detailsOpen,
    selectedItem,
  });

  // move/copy state
  const [moveCopyTargetFolderId, setMoveCopyTargetFolderId] = useState<
    number | null
  >(null);

  const [pendingAction, setPendingAction] = useState<"move" | "copy" | null>(
    null
  );
  const [moveCopyOpen, setMoveCopyOpen] = useState(false);

  // ---------- data loading helpers ----------

  const handleMoveCopyConfirm = async (targetFolderId: number | null) => {
    setMoveCopyTargetFolderId(targetFolderId);
    if (!selectedItem) {
      setMoveCopyOpen(false);
      setPendingAction(null);
      setMoveCopyTargetFolderId(null);
      return;
    }

    if (pendingAction === "move") {
      await moveSelected(selectedItem, targetFolderId);
    } else if (pendingAction === "copy") {
      await copySelected(selectedItem, targetFolderId);
    }

    setMoveCopyOpen(false);
    setPendingAction(null);
    setMoveCopyTargetFolderId(null);
  };

  const visibleItems: Item[] = computeVisibleItems({
    currentDepartment,
    currentFolder,
    departments,
    folders,
    documents,
    sortMode,
    searchQuery: debouncedSearch,
    isSuperAdmin,
  });

  const isSelected = (item: Item) => {
    if (!selectedItem) return false;
    if (item.kind !== selectedItem.kind) return false;
    return (item.data as any).id === (selectedItem.data as any).id;
  };

  const handleItemClick = (item: Item) => setSelectedItem(item);

  const handleItemDoubleClick = (item: Item) => {
    const now = new Date().toISOString();

    if (item.kind === "department") {
      const dept = { ...(item.data as Department), last_opened_at: now };
      setDepartments((prev) => prev.map((d) => (d.id === dept.id ? dept : d)));
      setSelectedItem(null);
      setSearchQuery(""); // clear search
      loadDepartmentContents(dept);
    } else if (item.kind === "folder") {
      const folder = { ...(item.data as FolderRow), last_opened_at: now };
      setFolders((prev) => prev.map((f) => (f.id === folder.id ? folder : f)));
      setSelectedItem(null);
      setSearchQuery(""); // clear search
      loadFolderContents(folder);
    } else {
      const doc = { ...(item.data as DocumentRow), last_opened_at: now };
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? doc : d)));
      setSelectedItem({ kind: "file", data: doc });
      setDetailsOpen(true);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !currentDepartment) {
      setFolderError("Enter a name and select a department.");
      return;
    }
    setCreatingFolder(true);
    setFolderError(null);
    setIsBusy(true);
    try {
      const payload: any = {
        name: newFolderName.trim(),
        department_id: currentDepartment.id,
        parent_id: currentFolder ? currentFolder.id : null,
      };
      const res = await api.post("/folders", payload);
      const created: FolderRow = res.data.folder ?? res.data;
      setFolders((prev) => [...prev, created]);
      setNewFolderName("");
      setNewFolderOpen(false);
      notify("Folder created.", "success");
    } catch (err) {
      console.error(err);
      setFolderError("Failed to create folder.");
      notify("Failed to create folder.", "error");
    } finally {
      setCreatingFolder(false);
      setIsBusy(false);
    }
  };

  const handleReloadCurrent = async () => {
    setSelectedItem(null);
    setDetailsOpen(false);
    setSearchQuery("");

    if (currentFolder) {
      await loadFolderContents(currentFolder);
    } else if (currentDepartment) {
      await loadDepartmentContents(currentDepartment);
    } else if (isSuperAdmin) {
      // For super admin at root, just reload departments list
      setIsBusy(true);
      try {
        const res = await api.get("/departments");
        const deptItems: Department[] = res.data.data ?? res.data;
        setDepartments(deptItems);
      } catch (e) {
        console.error(e);
        notify("Failed to reload departments.", "error");
      }
    }
  };

  const handleReplaceFile = async (docId: number, file: File) => {
    const updated = await replaceFile(docId, file);

    // If the replaced doc is currently selected, update selectedItem too
    setSelectedItem((prev) => {
      if (!prev || prev.kind !== "file") return prev;
      const prevDoc = prev.data as DocumentRow;
      if (prevDoc.id !== updated.id) return prev;
      return { kind: "file", data: { ...prevDoc, ...updated } };
    });

    return updated;
  };

  // Auto-refresh current view every 45 seconds when inside a department or folder.
  usePolling(
    () => {
      if (loading || isBusy) return;

      if (currentFolder) {
        loadFolderContents(currentFolder);
      } else if (currentDepartment) {
        loadDepartmentContents(currentDepartment);
      }
      // When at departments root, do not auto-poll to avoid extra load.
    },
    {
      intervalMs: 45_000,
      enabled: (!!currentDepartment || !!currentFolder) && !isBusy,
      pauseWhenHidden: true,
    }
  );

  const toolbarLabel =
    selectedItem == null
      ? "No item selected"
      : selectedItem.kind === "department"
      ? "Department selected"
      : selectedItem.kind === "folder"
      ? "Folder selected"
      : "File selected";

  // should actions show?
  const selectedIsFileOrFolder =
    selectedItem &&
    (selectedItem.kind === "file" || selectedItem.kind === "folder");

  // ---------- UI ----------

  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold text-white">
        Document manager
      </h1>

      {/* main toolbar */}
      <div className="mb-2.5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* LEFT: uploads only when inside a department (not departments list) */}
        <div className="flex h-8.5 items-center">
          <div className="flex flex-wrap gap-2">
            {currentDepartment && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setUploadMode("files");
                    setUploadOpen(true);
                  }}
                >
                  Upload file
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setUploadMode("folder");
                    setUploadOpen(true);
                  }}
                >
                  Upload folder
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setNewFolderOpen(true)}
                >
                  New folder
                </Button>
              </>
            )}
          </div>
        </div>

        {/* RIGHT: selection label + item actions */}
        <SelectionActionsToolbar
          selectedItem={selectedItem}
          toolbarLabel={toolbarLabel}
          selectedIsFileOrFolder={!!selectedIsFileOrFolder}
          onDownloadSelected={() => {
            if (!selectedItem) return;
            if (selectedItem.kind === "file") {
              handleDownload(selectedItem);
            } else if (selectedItem.kind === "folder") {
              handleDownloadFolder(selectedItem);
            }
          }}
          onRenameSelected={() => {
            if (!selectedItem) return;
            setRenameError(null);
            setRenameName(getItemName(selectedItem));
            setRenameOpen(true);
          }}
          onCopySelected={() => {
            if (!selectedItem) return;
            setPendingAction("copy");
            setMoveCopyOpen(true);
          }}
          onMoveSelected={() => {
            if (!selectedItem) return;
            setPendingAction("move");
            setMoveCopyOpen(true);
          }}
          onTrashSelected={() =>
            handleTrashSelected(selectedItem, () => {
              setSelectedItem(null);
              setDetailsOpen(false);
            })
          }
        />
      </div>

      {/* view + sort + search + details */}
      <ViewSortSearchBar
        viewMode={viewMode}
        sortMode={sortMode}
        searchQuery={searchQuery}
        onChangeViewMode={setViewMode}
        onChangeSortMode={setSortMode}
        onChangeSearchQuery={setSearchQuery}
        onToggleDetails={() => setDetailsOpen((v) => !v)}
      />

      {/* breadcrumbs + back */}
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-300">
        <Button size="xs" variant="secondary" onClick={handleReloadCurrent}>
          Reload
        </Button>

        <Button
          size="xs"
          variant="ghost"
          onClick={handleGoBack}
          disabled={!currentDepartment && !currentFolder}
        >
          ← Back
        </Button>

        <div className="flex items-center gap-1">
          <button
            className={
              isSuperAdmin
                ? "text-slate-300 hover:text-sky-400"
                : "text-slate-500 cursor-default"
            }
            onClick={() => {
              if (!isSuperAdmin) return;
              setCurrentDepartment(null);
              setCurrentFolder(null);
              setSelectedItem(null);
              setSearchQuery(""); // clear search when going to departments root
            }}
          >
            Departments
          </button>

          {currentDepartment && (
            <>
              <span className="text-slate-600">/</span>
              <button
                className="text-slate-300 hover:text-sky-400"
                onClick={() => {
                  setCurrentFolder(null);
                  setSelectedItem(null); // do not treat dept as selected
                  setSearchQuery(""); // clear search when going to dept root
                }}
              >
                {currentDepartment.name}
              </button>
            </>
          )}

          {folderAncestors.map((folder, idx) => (
            <span key={folder.id} className="flex items-center gap-1">
              <span className="text-slate-600">/</span>
              {idx < folderAncestors.length - 1 ? (
                <button
                  className="text-slate-300 hover:text-sky-400"
                  onClick={() => {
                    setCurrentFolder(folder);
                    setSelectedItem(null); // navigation, not selection
                    setSearchQuery(""); // clear search when jumping via breadcrumb
                  }}
                >
                  {folder.name}
                </button>
              ) : (
                <span className="text-slate-400">{folder.name}</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* main content area */}
      <div className="flex h-[calc(100vh-260px)] gap-3">
        <section className="flex-1 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm">
          {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
          {!currentDepartment && isSuperAdmin && (
            <p className="mb-2 text-xs text-slate-400">
              Double-click a department to open it. Single click selects.
            </p>
          )}

          <div
            className="h-full overflow-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedItem(null);
              }
            }}
          >
            {loading ? (
              <Loader />
            ) : visibleItems.length === 0 ? (
              <p className="text-xs text-slate-500">Nothing to display.</p>
            ) : viewMode === "grid" ? (
              <DocumentGrid
                items={visibleItems}
                isSelected={isSelected}
                formatSize={formatSize}
                onClickItem={handleItemClick}
                onDoubleClickItem={handleItemDoubleClick}
                isRoot={!currentDepartment && !currentFolder}
                onDownload={handleDownload}
                onDownloadFolder={handleDownloadFolder}
                onDetails={(item) => {
                  setSelectedItem(item);
                  setDetailsOpen(true);
                }}
                onCopy={(item) => {
                  setSelectedItem(item);
                  setPendingAction("copy");
                  setMoveCopyOpen(true);
                }}
                onMove={(item) => {
                  setSelectedItem(item);
                  setPendingAction("move");
                  setMoveCopyOpen(true);
                }}
                onRename={(item) => {
                  setSelectedItem(item);
                  setRenameError(null);
                  setRenameName(getItemName(item));
                  setRenameOpen(true);
                }}
                onDelete={(item) => {
                  setSelectedItem(item);
                  handleTrashSelected(item, () => {
                    setSelectedItem(null);
                    setDetailsOpen(false);
                  });
                }}
              />
            ) : (
              <DocumentList
                items={visibleItems}
                isSelected={isSelected}
                formatSize={formatSize}
                onClickItem={handleItemClick}
                onDoubleClickItem={handleItemDoubleClick}
                isRoot={!currentDepartment && !currentFolder}
                onDownload={handleDownload}
                onRename={(item) => {
                  setSelectedItem(item);
                  setRenameError(null);
                  setRenameName(getItemName(item));
                  setRenameOpen(true);
                }}
                onCopy={(item) => {
                  setSelectedItem(item);
                  setPendingAction("copy");
                  setMoveCopyOpen(true);
                }}
                onMove={(item) => {
                  setSelectedItem(item);
                  setPendingAction("move");
                  setMoveCopyOpen(true);
                }}
                onDetails={(item) => {
                  setSelectedItem(item);
                  setDetailsOpen(true);
                }}
                onDelete={(item) => {
                  setSelectedItem(item);
                  handleTrashSelected(item, () => {
                    setSelectedItem(null);
                    setDetailsOpen(false);
                  });
                }}
              />
            )}
          </div>
        </section>

        <DetailsPanel
          open={detailsOpen}
          selectedItem={selectedItem}
          previewUrl={previewUrl}
          previewLoading={previewLoading}
          formatSize={formatSize}
          onClose={() => setDetailsOpen(false)}
          width={detailsWidth}
          onResizeStart={handleDetailsResizeStart}
          currentUser={{
            id: user.id,
            role: user.role ?? null,
            department: user.department_id
              ? { id: user.department_id, is_qa: false }
              : null,
          }}
          onReplaceFile={handleReplaceFile}
          setFolders={setFolders}
        />
      </div>

      <DocumentUploadModal
        open={uploadOpen}
        mode={uploadMode}
        currentDepartmentId={currentDepartment?.id ?? null}
        currentFolderId={currentFolder?.id ?? null}
        onClose={() => setUploadOpen(false)}
        onSuccess={async () => {
          setIsBusy(true);
          try {
            if (currentFolder) {
              await loadFolderContents(currentFolder);
            } else if (currentDepartment) {
              await loadDepartmentContents(currentDepartment);
            }
            notify("Upload completed.", "success");
          } finally {
            setUploadOpen(false);
            setIsBusy(false);
          }
        }}
      />

      <NewFolderModal
        open={newFolderOpen}
        creating={creatingFolder}
        folderError={folderError}
        newFolderName={newFolderName}
        onClose={() => setNewFolderOpen(false)}
        onSubmit={handleCreateFolder}
        onChangeName={setNewFolderName}
      />

      <RenameModal
        open={renameOpen}
        renaming={renaming}
        renameError={renameError}
        renameName={renameName}
        onClose={() => setRenameOpen(false)}
        onSubmit={handleRenameSubmit}
        onChangeName={setRenameName}
      />

      <MoveCopyModal
        open={moveCopyOpen && !!pendingAction && !!selectedItem}
        mode={pendingAction || "move"}
        currentDepartment={currentDepartment}
        folders={folders}
        currentFolder={currentFolder}
        onClose={() => {
          setMoveCopyOpen(false);
          setPendingAction(null);
          setMoveCopyTargetFolderId(null);
        }}
        onConfirm={handleMoveCopyConfirm}
      />
    </>
  );
}
