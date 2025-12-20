// src/pages/DocumentManagerPage.tsx
import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";

type LayoutContext = {
  user: {
    id: number;
    name: string;
    email: string;
    department_id: number | null;
    role?: { id: number; name: string } | null;
  };
  isAdmin: boolean;
};

import type {
  DocumentRow,
  FolderRow,
  DocumentPreview,
  Department,
  ViewMode,
  SortMode,
  Item,
} from "../types/documents";
import { DocumentGrid } from "../components/documents/DocumentGrid";
import { DocumentList } from "../components/documents/DocumentList";
import { DetailsPanel } from "../components/documents/DetailsPanel";
import { DocumentUploadModal } from "../components/documents/DocumentUploadModal";
import { NewFolderModal } from "../components/documents/NewFolderModal";
import { RenameModal } from "../components/documents/RenameModal";

const Loader = () => (
  <div className="flex h-full items-center justify-center py-10">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
  </div>
);

function applySort(items: Item[], sortMode: SortMode): Item[] {
  const alphaSort = (a: Item, b: Item) => {
    const nameA =
      a.kind === "file"
        ? (a.data as DocumentRow).title ||
          (a.data as DocumentRow).original_filename
        : (a.data as any).name;
    const nameB =
      b.kind === "file"
        ? (b.data as DocumentRow).title ||
          (b.data as DocumentRow).original_filename
        : (b.data as any).name;
    return nameA.localeCompare(nameB);
  };

  if (sortMode === "alpha") return [...items].sort(alphaSort);

  if (sortMode === "uploaded_at") {
    const foldersOnly = items.filter((i) => i.kind === "folder");
    const filesOnly = items
      .filter((i) => i.kind === "file")
      .sort(
        (a, b) =>
          new Date((b.data as DocumentRow).uploaded_at).getTime() -
          new Date((a.data as DocumentRow).uploaded_at).getTime()
      );
    return [...foldersOnly, ...filesOnly];
  }

  if (sortMode === "recent") {
    return [...items].sort((a, b) => {
      const getOpened = (item: Item) => {
        if (item.kind === "file") {
          return (item.data as DocumentRow).last_opened_at;
        }
        if (item.kind === "folder") {
          return (item.data as FolderRow).last_opened_at;
        }
        return (item.data as Department).last_opened_at;
      };
      const aTime = getOpened(a)
        ? new Date(getOpened(a) as string).getTime()
        : 0;
      const bTime = getOpened(b)
        ? new Date(getOpened(b) as string).getTime()
        : 0;
      return bTime - aTime;
    });
  }

  if (sortMode === "size") {
    const foldersOnly = items.filter((i) => i.kind === "folder");
    const filesOnly = items
      .filter((i) => i.kind === "file")
      .sort(
        (a, b) =>
          (b.data as DocumentRow).size_bytes -
          (a.data as DocumentRow).size_bytes
      );
    return [...foldersOnly, ...filesOnly];
  }

  return items;
}

function computeVisibleItems(params: {
  currentDepartment: Department | null;
  currentFolder: FolderRow | null;
  departments: Department[];
  folders: FolderRow[];
  documents: DocumentRow[];
  sortMode: SortMode;
  searchQuery: string;
  isAdmin: boolean;
}): Item[] {
  const {
    currentDepartment,
    currentFolder,
    departments,
    folders,
    documents,
    sortMode,
    searchQuery,
    isAdmin,
  } = params;

  if (!currentDepartment) {
    if (!isAdmin) {
      return [];
    }

    let list = departments.map<Item>((d) => ({
      kind: "department",
      data: d,
    }));
    if (sortMode === "alpha") {
      list = list.sort((a, b) =>
        (a.data as Department).name.localeCompare((b.data as Department).name)
      );
    }
    return list;
  }

  const directFolders = folders.filter(
    (f) =>
      f.department_id === currentDepartment.id &&
      f.parent_id === (currentFolder ? currentFolder.id : null)
  );
  const directFiles = documents.filter(
    (d) =>
      d.department_id === currentDepartment.id &&
      (currentFolder ? d.folder_id === currentFolder.id : !d.folder_id)
  );

  let items: Item[] = [
    ...directFolders.map<Item>((f) => ({ kind: "folder", data: f })),
    ...directFiles.map<Item>((d) => ({ kind: "file", data: d })),
  ];

  const q = searchQuery.trim().toLowerCase();
  if (!q) return applySort(items, sortMode);

  const allDeptFolders = folders.filter(
    (f) => f.department_id === currentDepartment.id
  );
  const allDeptFiles = documents.filter(
    (d) => d.department_id === currentDepartment.id
  );

  let globalItems: Item[] = [
    ...allDeptFolders.map<Item>((f) => ({ kind: "folder", data: f })),
    ...allDeptFiles.map<Item>((d) => ({ kind: "file", data: d })),
  ];

  globalItems = globalItems.filter((item) => {
    if (item.kind === "file") {
      const d = item.data as DocumentRow;
      const name = (d.title || d.original_filename || "").toLowerCase();
      return name.includes(q);
    }
    const name = (item.data as any).name.toLowerCase();
    return name.includes(q);
  });

  return applySort(globalItems, sortMode);
}

export default function DocumentManagerPage() {
  const { user, isAdmin } = useOutletContext<LayoutContext>();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);

  const [currentDepartment, setCurrentDepartment] =
    useState<Department | null>(null);
  const [currentFolder, setCurrentFolder] = useState<FolderRow | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortMode, setSortMode] = useState<SortMode>("alpha");
  const [searchQuery, setSearchQuery] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderError, setFolderError] = useState<string | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // ---------- data loading helpers ----------

  const loadDepartmentContents = async (dept: Department) => {
    localStorage.setItem("fildas.currentDepartmentId", String(dept.id));
    localStorage.removeItem("fildas.currentFolderId");

    setLoading(true);
    setError(null);
    setCurrentDepartment(dept);
    setCurrentFolder(null);
    setSelectedItem({ kind: "department", data: dept });

    try {
      const [folderRes, docRes] = await Promise.all([
        api.get("/folders", {
          params: { department_id: dept.id, parent_id: null },
        }),
        api.get("/documents", {
          params: { department_id: dept.id, folder_id: null },
        }),
      ]);
      const fs: FolderRow[] = folderRes.data.data ?? folderRes.data;
      const docs: DocumentRow[] = docRes.data.data ?? docRes.data;

      setFolders((prev) => [
        ...prev.filter((f) => f.department_id !== dept.id),
        ...fs,
      ]);
      setDocuments((prev) => [
        ...prev.filter(
          (d) => d.department_id !== dept.id || d.folder_id !== null
        ),
        ...docs,
      ]);
    } catch (e) {
      console.error(e);
      setError("Failed to load department contents.");
    } finally {
      setLoading(false);
    }
  };

  const loadFolderContents = async (folder: FolderRow) => {
    localStorage.setItem(
      "fildas.currentDepartmentId",
      String(folder.department_id)
    );
    localStorage.setItem("fildas.currentFolderId", String(folder.id));

    setLoading(true);
    setError(null);
    setCurrentFolder(folder);
    setSelectedItem({ kind: "folder", data: folder });

    try {
      const [folderRes, docRes] = await Promise.all([
        api.get("/folders", {
          params: { department_id: folder.department_id, parent_id: folder.id },
        }),
        api.get("/documents", {
          params: { department_id: folder.department_id, folder_id: folder.id },
        }),
      ]);
      const childFolders: FolderRow[] = folderRes.data.data ?? folderRes.data;
      const docs: DocumentRow[] = docRes.data.data ?? docRes.data;

      setFolders((prev) => {
        const existingIds = new Set(prev.map((f) => f.id));
        const merged = [...prev];
        childFolders.forEach((f) => {
          if (!existingIds.has(f.id)) merged.push(f);
        });
        return merged;
      });

      setDocuments((prev) => {
        const others = prev.filter((d) => d.folder_id !== folder.id);
        return [...others, ...docs];
      });
    } catch (e) {
      console.error(e);
      setError("Failed to load folder.");
    } finally {
      setLoading(false);
    }
  };

  // ---------- INITIAL LOAD (uses sharedTarget + stored state) ----------

  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      setError(null);
      try {
        const deptRes = await api.get("/departments");
        const deptItems: Department[] = deptRes.data.data ?? deptRes.data;
        setDepartments(deptItems);

        // Check if coming from SharedFilesPage
        const storedSharedTarget = localStorage.getItem("fildas.sharedTarget");
        if (storedSharedTarget) {
          try {
            const target = JSON.parse(storedSharedTarget) as {
              type: "folder";
              folder_id: number;
              department_id: number | null;
            };

            if (target.type === "folder" && target.department_id) {
              const dept =
                deptItems.find((d) => d.id === target.department_id) || null;
              if (dept) {
                localStorage.removeItem("fildas.sharedTarget");
                await loadDepartmentContents(dept);

                try {
                  const folderRes = await api.get<FolderRow>(
                    `/folders/${target.folder_id}`
                  );
                  const folder = folderRes.data;
                  if (folder.department_id === dept.id) {
                    await loadFolderContents(folder);
                    return;
                  }
                } catch (e) {
                  console.error(
                    "Failed to load shared folder, fallback to dept root",
                    e
                  );
                }
              }
            }
          } catch (e) {
            console.error("Invalid fildas.sharedTarget", e);
            localStorage.removeItem("fildas.sharedTarget");
          }
        }

        const storedDeptId = localStorage.getItem("fildas.currentDepartmentId");
        const storedFolderId =
          localStorage.getItem("fildas.currentFolderId");

        // Staff: force to their department
        if (!isAdmin) {
          const userDeptId = user.department_id;
          if (!userDeptId) {
            setCurrentDepartment(null);
            setCurrentFolder(null);
            setSelectedItem(null);
            return;
          }

          const dept = deptItems.find((d) => d.id === userDeptId) || null;
          if (!dept) {
            setCurrentDepartment(null);
            setCurrentFolder(null);
            setSelectedItem(null);
            return;
          }

          await loadDepartmentContents(dept);
          return;
        }

        // Admin: restore previous context
        if (!storedDeptId) {
          setCurrentDepartment(null);
          setCurrentFolder(null);
          setSelectedItem(null);
          return;
        }

        const deptId = Number(storedDeptId);
        const dept = deptItems.find((d) => d.id === deptId);
        if (!dept) {
          localStorage.removeItem("fildas.currentDepartmentId");
          localStorage.removeItem("fildas.currentFolderId");
          setCurrentDepartment(null);
          setCurrentFolder(null);
          setSelectedItem(null);
          return;
        }

        if (!storedFolderId) {
          await loadDepartmentContents(dept);
          return;
        }

        const folderId = Number(storedFolderId);
        try {
          const folderRes = await api.get<FolderRow>(`/folders/${folderId}`);
          const folder = folderRes.data;
          if (folder.department_id !== dept.id) {
            await loadDepartmentContents(dept);
            return;
          }
          await loadDepartmentContents(dept);
          await loadFolderContents(folder);
        } catch (e) {
          console.error(
            "Failed to restore folder, falling back to dept root",
            e
          );
          localStorage.removeItem("fildas.currentFolderId");
          await loadDepartmentContents(dept);
        }
      } catch (e) {
        console.error(e);
        setError("Failed to load departments.");
      } finally {
        setLoading(false);
      }
    };

    loadInitial();
  }, [isAdmin, user.department_id]);

  // ---------- navigation / actions ----------

  const handleGoBack = () => {
    if (currentFolder) {
      // existing folder back logic (not shown in original)
    } else if (currentDepartment) {
      if (!isAdmin) {
        return;
      }
      setCurrentDepartment(null);
      setSelectedItem(null);
      localStorage.removeItem("fildas.currentDepartmentId");
      localStorage.removeItem("fildas.currentFolderId");
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedItem) return;

    if (!window.confirm(`Move this ${selectedItem.kind} to trash?`)) return;

    try {
      if (selectedItem.kind === "file") {
        const doc = selectedItem.data as DocumentRow;
        await api.delete(`/documents/${doc.id}`);
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      } else if (selectedItem.kind === "folder") {
        const folder = selectedItem.data as FolderRow;
        await api.delete(`/folders/${folder.id}`);
        setFolders((prev) => prev.filter((f) => f.id !== folder.id));
        setDocuments((prev) =>
          prev.filter((d) => d.folder_id !== folder.id)
        );
        if (currentFolder && currentFolder.id === folder.id) {
          setCurrentFolder(null);
        }
      } else if (selectedItem.kind === "department") {
        const dept = selectedItem.data as Department;
        await api.delete(`/departments/${dept.id}`);
        setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
        setFolders((prev) =>
          prev.filter((f) => f.department_id !== dept.id)
        );
        setDocuments((prev) =>
          prev.filter((d) => d.department_id !== dept.id)
        );
        if (currentDepartment && currentDepartment.id === dept.id) {
          setCurrentDepartment(null);
          setCurrentFolder(null);
        }
      }

      setSelectedItem(null);
      setDetailsOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to delete item on server.");
    }
  };

  const visibleItems: Item[] = computeVisibleItems({
    currentDepartment,
    currentFolder,
    departments,
    folders,
    documents,
    sortMode,
    searchQuery,
    isAdmin,
  });

  const folderAncestors: FolderRow[] = (() => {
    if (!currentFolder) return [];
    const chain: FolderRow[] = [];
    let cursor: FolderRow | null = currentFolder;
    while (cursor) {
      chain.unshift(cursor);
      cursor =
        cursor.parent_id != null
          ? folders.find((f) => f.id === cursor!.parent_id) || null
          : null;
    }
    return chain;
  })();

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
      loadDepartmentContents(dept);
    } else if (item.kind === "folder") {
      const folder = { ...(item.data as FolderRow), last_opened_at: now };
      setFolders((prev) => prev.map((f) => (f.id === folder.id ? folder : f)));
      loadFolderContents(folder);
    } else {
      const doc = { ...(item.data as DocumentRow), last_opened_at: now };
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? doc : d)));
      setSelectedItem({ kind: "file", data: doc });
      setDetailsOpen(true);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    let value = bytes;
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024;
      i++;
    }
    return `${value.toFixed(1)} ${units[i]}`;
  };

  const getPreviewUrlFromApi = async (docId: number) => {
    const res = await api.get<DocumentPreview>(`/documents/${docId}/preview`);
    return res.data.stream_url;
  };

  useEffect(() => {
    const loadPreview = async () => {
      if (!detailsOpen || !selectedItem || selectedItem.kind !== "file") {
        setPreviewUrl(null);
        return;
      }

      const doc = selectedItem.data as DocumentRow;
      const mime = doc.mime_type || "";

      if (
        !mime.startsWith("image/") &&
        mime !== "application/pdf" &&
        mime !==
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
        mime !== "application/msword"
      ) {
        setPreviewUrl(null);
        return;
      }

      try {
        const url = await getPreviewUrlFromApi(doc.id);
        setPreviewUrl(url);
      } catch (e) {
        console.error("Failed to load preview URL", e);
        setPreviewUrl(null);
      }
    };

    loadPreview();
  }, [detailsOpen, selectedItem]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !currentDepartment) {
      setUploadError("Choose a file and department.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const form = new FormData();
      form.append("title", uploadTitle || uploadFile.name);
      form.append("description", "");
      form.append("department_id", String(currentDepartment.id));
      if (currentFolder) {
        form.append("folder_id", String(currentFolder.id));
      }
      form.append("file", uploadFile);

      await api.post("/documents", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const docRes = await api.get("/documents", {
        params: {
          department_id: currentDepartment.id,
          folder_id: currentFolder ? currentFolder.id : undefined,
        },
      });
      const docs: DocumentRow[] = docRes.data.data ?? docRes.data;

      setDocuments((prev) => {
        const others = prev.filter(
          (d) =>
            d.department_id !== currentDepartment.id ||
            (currentFolder && d.folder_id !== currentFolder.id) ||
            (!currentFolder && d.folder_id != null)
        );
        return [...others, ...docs];
      });

      setUploadOpen(false);
      setUploadFile(null);
      setUploadTitle("");
    } catch (err) {
      console.error(err);
      setUploadError("Failed to upload.");
    } finally {
      setUploading(false);
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
    } catch (err) {
      console.error(err);
      setFolderError("Failed to create folder.");
    } finally {
      setCreatingFolder(false);
    }
  };

  const getItemName = (item: Item | null) => {
    if (!item) return "";
    if (item.kind === "file") {
      const d = item.data as DocumentRow;
      return d.title || d.original_filename;
    }
    return (item.data as any).name;
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    const newName = renameName.trim();
    if (!newName) {
      setRenameError("Name is required.");
      return;
    }

    setRenaming(true);
    setRenameError(null);

    try {
      if (selectedItem.kind === "file") {
        const doc = selectedItem.data as DocumentRow;
        const res = await api.patch(`/documents/${doc.id}`, {
          title: newName,
        });
        const updated: DocumentRow = res.data.document ?? res.data;
        setDocuments((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d))
        );
        setSelectedItem({ kind: "file", data: updated });
      } else if (selectedItem.kind === "folder") {
        const folder = selectedItem.data as FolderRow;
        const res = await api.patch(`/folders/${folder.id}`, {
          name: newName,
        });
        const updated: FolderRow = res.data.folder ?? res.data;
        setFolders((prev) =>
          prev.map((f) => (f.id === updated.id ? updated : f))
        );
        setSelectedItem({ kind: "folder", data: updated });
        if (currentFolder && currentFolder.id === updated.id) {
          setCurrentFolder(updated);
        }
      } else if (selectedItem.kind === "department") {
        const dept = selectedItem.data as Department;
        const res = await api.patch(`/departments/${dept.id}`, {
          name: newName,
        });
        const updated: Department = res.data.department ?? res.data;
        setDepartments((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d))
        );
        setSelectedItem({ kind: "department", data: updated });
        if (currentDepartment && currentDepartment.id === updated.id) {
          setCurrentDepartment(updated);
        }
      }

      setRenameOpen(false);
    } catch (err) {
      console.error(err);
      setRenameError("Failed to rename item.");
    } finally {
      setRenaming(false);
    }
  };

  const toolbarLabel =
    selectedItem == null
      ? "No item selected"
      : selectedItem.kind === "department"
      ? "Department selected"
      : selectedItem.kind === "folder"
      ? "Folder selected"
      : "File selected";

  // ---------- UI ----------

  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold text-white">
        Document manager
      </h1>

      {/* main toolbar */}
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setUploadOpen(true)}
          >
            Upload file
          </Button>
          <Button variant="secondary" size="sm">
            Upload folder
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setNewFolderOpen(true)}
          >
            New folder
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="mr-2 text-slate-500">{toolbarLabel}</span>
          {selectedItem && (
            <>
              <Button size="xs" onClick={handleDeleteSelected}>
                Delete
              </Button>
              <Button size="xs">Move</Button>
              <Button
                size="xs"
                onClick={() => {
                  setRenameError(null);
                  setRenameName(getItemName(selectedItem));
                  setRenameOpen(true);
                }}
              >
                Rename
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
              isAdmin
                ? "text-slate-300 hover:text-sky-400"
                : "text-slate-500 cursor-default"
            }
            onClick={() => {
              if (!isAdmin) return;
              setCurrentDepartment(null);
              setCurrentFolder(null);
              setSelectedItem(null);
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
                  setSelectedItem({
                    kind: "department",
                    data: currentDepartment,
                  });
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
                    setSelectedItem({ kind: "folder", data: folder });
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
          {!currentDepartment && isAdmin && (
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
                onRename={(item) => {
                  setSelectedItem(item);
                  setRenameError(null);
                  setRenameName(getItemName(item));
                  setRenameOpen(true);
                }}
                onDelete={(item) => {
                  setSelectedItem(item);
                  handleDeleteSelected();
                }}
              />
            ) : (
              <DocumentList
                items={visibleItems}
                isSelected={isSelected}
                formatSize={formatSize}
                onClickItem={handleItemClick}
                onDoubleClickItem={handleItemDoubleClick}
                onRename={(item) => {
                  setSelectedItem(item);
                  setRenameError(null);
                  setRenameName(getItemName(item));
                  setRenameOpen(true);
                }}
                onDelete={(item) => {
                  setSelectedItem(item);
                  handleDeleteSelected();
                }}
              />
            )}
          </div>
        </section>

        <DetailsPanel
          open={detailsOpen}
          selectedItem={selectedItem}
          previewUrl={previewUrl}
          formatSize={formatSize}
          onClose={() => setDetailsOpen(false)}
        />
      </div>

      <DocumentUploadModal
        open={uploadOpen}
        uploading={uploading}
        uploadError={uploadError}
        uploadTitle={uploadTitle}
        onClose={() => setUploadOpen(false)}
        onSubmit={handleUpload}
        onChangeTitle={setUploadTitle}
        onChangeFile={setUploadFile}
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
    </>
  );
}
