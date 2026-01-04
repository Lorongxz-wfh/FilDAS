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

  const Loader = () => (
    <div className="flex h-full items-center justify-center py-10">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
    </div>
  );

  export default function DocumentManagerPage() {
    const { user, isAdmin, isSuperAdmin } = useOutletContext<LayoutContext>();
    const location = useLocation() as { state?: { departmentId?: number } };
    const initialDepartmentId = location.state?.departmentId ?? null;

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
    });

    const [viewMode, setViewMode] = useState<ViewMode>("grid");
    const [sortMode, setSortMode] = useState<SortMode>("alpha");

    console.log("doc manager folders sample", folders.slice(0, 10));

    // When true, auto-polling is paused to avoid overlapping with mutations.
    const [isBusy, setIsBusy] = useState(false);

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

    const [uploadOpen, setUploadOpen] = useState(false);
    const [newFolderOpen, setNewFolderOpen] = useState(false);

    const [uploadMode, setUploadMode] = useState<"files" | "folder">("files");

    const [creatingFolder, setCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [folderError, setFolderError] = useState<string | null>(null);

    const { detailsWidth, setDetailsWidth, handleDetailsResizeStart } =
      useResizableDetails(320);

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

    const handleDownload = async (item: Item) => {
      if (item.kind !== "file") return;
      const doc = item.data as DocumentRow;
      try {
        const res = await api.get(`/documents/${doc.id}/download`, {
          responseType: "blob",
        });
        const blob = new Blob([res.data], {
          type: doc.mime_type || "application/octet-stream",
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.original_filename || doc.title || "download";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (e) {
        console.error(e);
        notify("Failed to download file.", "error");
      }
    };

    const handleDownloadFolder = async (item: Item) => {
      if (item.kind !== "folder") return;
      const folder = item.data as FolderRow;

      try {
        const res = await api.get(`/folders/${folder.id}/download`, {
          responseType: "blob",
        });
        const blob = new Blob([res.data], { type: "application/zip" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${folder.name}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (e) {
        console.error(e);
        notify("Failed to download folder.", "error");
      }
    };

    // Archive selected file/folder (soft archive, not delete)
    const handleArchiveSelected = async () => {
      if (!selectedItem) return;

      const label =
        selectedItem.kind === "file"
          ? "this file"
          : selectedItem.kind === "folder"
          ? "this folder (and its contents)"
          : "this item";

      if (
        !window.confirm(
          `Archive ${label}? It will be hidden from normal views but kept in the Archive.`
        )
      ) {
        return;
      }

      setIsBusy(true);
      try {
        if (selectedItem.kind === "file") {
          const doc = selectedItem.data as DocumentRow;
          await api.post(`/documents/${doc.id}/archive`);
        } else if (selectedItem.kind === "folder") {
          const folder = selectedItem.data as FolderRow;
          await api.post(`/folders/${folder.id}/archive`);
        } else {
          // departments are not archivable here; ignore
          return;
        }

        // Reload current context so the archived item disappears
        if (currentFolder) {
          await loadFolderContents(currentFolder);
        } else if (currentDepartment) {
          await loadDepartmentContents(currentDepartment);
        }

        setSelectedItem(null);
        setDetailsOpen(false);
        notify("Item archived.", "success");
      } catch (e: any) {
        console.error(e);
        const msg =
          e?.response?.data?.error ||
          e?.response?.data?.message ||
          "Failed to archive item.";
        notify(msg, "error");
      } finally {
        setIsBusy(false);
      }
    };

    const moveSelected = async (targetFolderId: number | null) => {
      if (!selectedItem || !currentDepartment) return;

      setIsBusy(true);
      try {
        if (selectedItem.kind === "folder") {
          const folder = selectedItem.data as FolderRow;
          await api.post(`/folders/${folder.id}/move`, {
            target_folder_id: targetFolderId,
          });
        } else if (selectedItem.kind === "file") {
          const doc = selectedItem.data as DocumentRow;
          await api.post(`/documents/${doc.id}/move`, {
            target_folder_id: targetFolderId,
          });
        }

        if (currentFolder) {
          await loadFolderContents(currentFolder);
        } else {
          await loadDepartmentContents(currentDepartment);
        }

        notify("Moved successfully.", "success");
      } catch (e) {
        console.error(e);
        notify("Failed to move item.", "error");
      } finally {
        setIsBusy(false);
      }
    };

    const copySelected = async (targetFolderId: number | null) => {
      if (!selectedItem || !currentDepartment) return;

      setIsBusy(true);
      try {
        if (selectedItem.kind === "folder") {
          const folder = selectedItem.data as FolderRow;
          await api.post(`/folders/${folder.id}/copy`, {
            target_folder_id: targetFolderId,
          });
        } else if (selectedItem.kind === "file") {
          const doc = selectedItem.data as DocumentRow;
          await api.post(`/documents/${doc.id}/copy`, {
            target_folder_id: targetFolderId,
          });
        }

        if (currentFolder) {
          await loadFolderContents(currentFolder);
        } else {
          await loadDepartmentContents(currentDepartment);
        }

        notify("Copied successfully.", "success");
      } catch (e) {
        console.error(e);
        notify("Failed to copy item.", "error");
      } finally {
        setIsBusy(false);
      }
    };

    const handleMoveCopyConfirm = async (targetFolderId: number | null) => {
      setMoveCopyTargetFolderId(targetFolderId);
      if (pendingAction === "move") {
        await moveSelected(targetFolderId);
      } else if (pendingAction === "copy") {
        await copySelected(targetFolderId);
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
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="mr-2 text-slate-500">{toolbarLabel}</span>
            {selectedIsFileOrFolder && (
              <>
                <Button
                  size="xs"
                  onClick={() =>
                    selectedItem!.kind === "file"
                      ? handleDownload(selectedItem!)
                      : handleDownloadFolder(selectedItem!)
                  }
                >
                  Download
                </Button>

                <Button
                  size="xs"
                  onClick={() => {
                    setRenameError(null);
                    setRenameName(getItemName(selectedItem!));
                    setRenameOpen(true);
                  }}
                >
                  Rename
                </Button>

                <Button
                  size="xs"
                  onClick={() => {
                    setPendingAction("copy");
                    setMoveCopyOpen(true);
                  }}
                >
                  Copy
                </Button>

                <Button
                  size="xs"
                  onClick={() => {
                    setPendingAction("move");
                    setMoveCopyOpen(true);
                  }}
                >
                  Move
                </Button>

                <Button size="xs" onClick={handleArchiveSelected}>
                  Archive
                </Button>
              </>
            )}
          </div>
        </div>

        {/* view + sort + search + details */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-slate-700 bg-slate-900">
              <Button
                size="xs"
                variant={viewMode === "grid" ? "primary" : "ghost"}
                className="rounded-none"
                onClick={() => setViewMode("grid")}
              >
                Grid
              </Button>
              <Button
                size="xs"
                variant={viewMode === "list" ? "primary" : "ghost"}
                className="rounded-none"
                onClick={() => setViewMode("list")}
              >
                List
              </Button>
            </div>

            <select
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
            >
              <option value="alpha">Alphabetical</option>
              <option value="recent">Recently opened</option>
              <option value="uploaded_at">Uploaded date</option>
              <option value="size">File size</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search name..."
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button
              size="xs"
              variant="secondary"
              onClick={() => setDetailsOpen((v) => !v)}
            >
              Details
            </Button>
          </div>
        </div>

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
                    handleArchiveSelected();
                  }}
                />
              ) : (
                <DocumentList
                  items={visibleItems}
                  isSelected={isSelected}
                  formatSize={formatSize}
                  onClickItem={handleItemClick}
                  onDoubleClickItem={handleItemDoubleClick}
                  onDownload={handleDownload}
                  onRename={(item) => {
                    setSelectedItem(item);
                    setRenameError(null);
                    setRenameName(getItemName(item));
                    setRenameOpen(true);
                  }}
                  onDelete={(item) => {
                    setSelectedItem(item);
                    handleArchiveSelected();
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
