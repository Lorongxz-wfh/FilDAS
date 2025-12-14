// src/pages/DocumentManagerPage.tsx
import { useEffect, useState } from "react";
import Modal from "../components/Modal";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { IconButton } from "../components/ui/IconButton";
import { Card } from "../components/ui/Card";
import { DropdownMenu } from "../components/ui/DropdownMenu";

type DocumentRow = {
  id: number;
  title: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
  folder_id?: number | null;
  department_id?: number | null;
};

type FolderRow = {
  id: number;
  name: string;
  parent_id: number | null;
  department_id: number | null;
};

type DocumentPreview = DocumentRow & {
  stream_url: string;
};

type Department = {
  id: number;
  name: string;
};

type ViewMode = "grid" | "list";

type SortMode = "alpha" | "recent" | "size" | "uploaded_at";

type Item =
  | { kind: "department"; data: Department }
  | { kind: "folder"; data: FolderRow }
  | { kind: "file"; data: DocumentRow };

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

  if (sortMode === "alpha") {
    return items.sort(alphaSort);
  }

  if (sortMode === "recent" || sortMode === "uploaded_at") {
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
}): Item[] {
  const {
    currentDepartment,
    currentFolder,
    departments,
    folders,
    documents,
    sortMode,
    searchQuery,
  } = params;

  if (!currentDepartment) {
    let list = departments.map<Item>((d) => ({ kind: "department", data: d }));
    if (sortMode === "alpha") {
      list = list.sort((a, b) =>
        (a.data as Department).name.localeCompare((b.data as Department).name)
      );
    }
    return list;
  }

  // 1) base items for CURRENT FOLDER (for normal browsing)
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

  // apply search on name
  const q = searchQuery.trim().toLowerCase();

  if (!q) {
    // no search: behave like before (only current folder)
    return applySort(items, sortMode);
  }

  // 2) with search: use ALL folders/files in this department
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
  const [departments, setDepartments] = useState<Department[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);

  const [currentDepartment, setCurrentDepartment] = useState<Department | null>(
    null
  );
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

  // ---------- data loading ----------

  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      setError(null);
      try {
        const deptRes = await api.get("/departments");
        const deptItems: Department[] = deptRes.data.data ?? deptRes.data;
        setDepartments(deptItems);

        const storedDeptId = localStorage.getItem("fildas.currentDepartmentId");
        const storedFolderId = localStorage.getItem("fildas.currentFolderId");

        // No stored department → Departments root
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

        // If no folder stored, just load department root
        if (!storedFolderId) {
          await loadDepartmentContents(dept);
          return;
        }

        // Folder id stored: fetch that folder and then load it
        const folderId = Number(storedFolderId);
        try {
          const folderRes = await api.get<FolderRow>(`/folders/${folderId}`);
          const folder = folderRes.data;

          // Ensure we are in the right department
          await loadDepartmentContents(dept);
          await loadFolderContents(folder);
        } catch (e) {
          console.error("Failed to restore folder, falling back to dept root", e);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



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
      setFolders((prev) => {
        // replace or merge by department, your choice; simplest:
        return [...prev.filter((f) => f.department_id !== dept.id), ...fs];
      });
      setDocuments((prev) => {
        return [
          ...prev.filter(
            (d) => d.department_id !== dept.id || d.folder_id !== null
          ),
          ...docs,
        ];
      });
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

  // ---------- helpers ----------

  const handleGoBack = () => {
    if (currentFolder) {
      const parent =
        folders.find((f) => f.id === currentFolder.parent_id) || null;
      setCurrentFolder(parent);
      setSelectedItem(
        parent
          ? { kind: "folder", data: parent }
          : currentDepartment
          ? { kind: "department", data: currentDepartment }
          : null
      );

      if (parent) {
        localStorage.setItem("fildas.currentFolderId", String(parent.id));
      } else {
        localStorage.removeItem("fildas.currentFolderId");
      }
    } else if (currentDepartment) {
      // Back to Departments root
      setCurrentDepartment(null);
      setSelectedItem(null);
      localStorage.removeItem("fildas.currentDepartmentId");
      localStorage.removeItem("fildas.currentFolderId");
    }
  };


  const handleDeleteSelected = async () => {
    if (!selectedItem) return;

    if (!window.confirm(`Move this ${selectedItem.kind} to trash?`)) {
      return;
    }

    try {
      if (selectedItem.kind === "file") {
        const doc = selectedItem.data as DocumentRow;
        await api.delete(`/documents/${doc.id}`);
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      } else if (selectedItem.kind === "folder") {
        const folder = selectedItem.data as FolderRow;
        await api.delete(`/folders/${folder.id}`);
        setFolders((prev) => prev.filter((f) => f.id !== folder.id));
        setDocuments((prev) => prev.filter((d) => d.folder_id !== folder.id));
        if (currentFolder && currentFolder.id === folder.id) {
          setCurrentFolder(null);
        }
      } else if (selectedItem.kind === "department") {
        const dept = selectedItem.data as Department;
        await api.delete(`/departments/${dept.id}`);
        setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
        setFolders((prev) => prev.filter((f) => f.department_id !== dept.id));
        setDocuments((prev) => prev.filter((d) => d.department_id !== dept.id));
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

  const handleItemClick = (item: Item) => {
    setSelectedItem(item);
  };

  const handleItemDoubleClick = (item: Item) => {
    if (item.kind === "department") {
      loadDepartmentContents(item.data);
    } else if (item.kind === "folder") {
      loadFolderContents(item.data);
    } else {
      setSelectedItem(item);
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

  // load preview URL when a file is selected and details panel is open
  useEffect(() => {
    const loadPreview = async () => {
      if (!detailsOpen || !selectedItem || selectedItem.kind !== "file") {
        setPreviewUrl(null);
        return;
      }

      const doc = selectedItem.data as DocumentRow;
      const mime = doc.mime_type || "";

      // Allow preview for images, PDFs, and Word docs (doc/docx)
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




  // ---------- actions: upload / new folder ----------

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

  // ---------- UI ----------

  const toolbarLabel =
    selectedItem == null
      ? "No item selected"
      : selectedItem.kind === "department"
      ? "Department selected"
      : selectedItem.kind === "folder"
      ? "Folder selected"
      : "File selected";

  return (
    <>
      <h1 className="text-2xl text-white font-semibold mb-2">
        Document Manager
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

        {/* contextual toolbar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 mr-2">{toolbarLabel}</span>
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
            className="text-slate-300 hover:text-sky-400"
            onClick={() => {
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
      <div
        className="flex h-[calc(100vh-260px)] gap-3"
        onClick={() => setSelectedItem(null)}
      >
        {/* items list */}
        <section className="flex-1 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm overflow-auto">
          {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

          {!currentDepartment && (
            <p className="mb-2 text-xs text-slate-400">
              Double-click a department to open it. Single click selects.
            </p>
          )}

          {loading ? (
            <Loader />
          ) : visibleItems.length === 0 ? (
            <p className="text-xs text-slate-500">Nothing to display.</p>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {visibleItems.map((item) => {
                const key = item.kind + "-" + (item.data as any).id;
                const selected = isSelected(item);
                const name =
                  item.kind === "file"
                    ? (item.data as DocumentRow).title ||
                      (item.data as DocumentRow).original_filename
                    : (item.data as any).name;

                return (
                  <Card
                    key={key}
                    selectable
                    selected={selected}
                    className="group cursor-pointer"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest(".dropdown-root")) {
                        return;
                      }
                      e.stopPropagation();
                      handleItemClick(item);
                    }}
                    onDoubleClick={(e) => {
                      if ((e.target as HTMLElement).closest(".dropdown-root")) {
                        return;
                      }
                      e.stopPropagation();
                      handleItemDoubleClick(item);
                    }}
                  >
                    <div className="relative flex h-full flex-col">
                      <DropdownMenu
                        trigger={
                          <div className="absolute right-1 top-1 hidden group-hover:flex dropdown-root">
                            <IconButton
                              size="xs"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              ⋮
                            </IconButton>
                          </div>
                        }
                      >
                        <DropdownMenu.Item
                          onClick={() => {
                            setSelectedItem(item);
                            setRenameError(null);
                            setRenameName(getItemName(item));
                            setRenameOpen(true);
                          }}
                        >
                          Rename
                        </DropdownMenu.Item>

                        <DropdownMenu.Item
                          onClick={() => {
                            // Move placeholder
                          }}
                        >
                          Move
                        </DropdownMenu.Item>

                        <DropdownMenu.Item
                          destructive
                          onClick={() => {
                            setSelectedItem(item);
                            handleDeleteSelected();
                          }}
                        >
                          Delete
                        </DropdownMenu.Item>
                      </DropdownMenu>

                      <div className="mb-6 text-[40px]">
                        {item.kind === "department"
                          ? "🏢"
                          : item.kind === "folder"
                          ? "📁"
                          : "📄"}
                      </div>

                      <p className="truncate text-slate-100">{name}</p>
                      <p className="text-[10px] text-slate-500">
                        {item.kind === "file"
                          ? formatSize((item.data as DocumentRow).size_bytes)
                          : item.kind === "folder"
                          ? "Folder"
                          : "Department"}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Size</th>
                  <th className="py-2 pr-4">Uploaded at</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {visibleItems.map((item) => {
                  const key = item.kind + "-" + (item.data as any).id;
                  const selected = isSelected(item);
                  const isFile = item.kind === "file";
                  const doc = item.data as DocumentRow;
                  const name = isFile
                    ? doc.title || doc.original_filename
                    : (item.data as any).name;

                  return (
                    <tr
                      key={key}
                      className={`cursor-pointer hover:bg-slate-800/60 ${
                        selected ? "bg-slate-800/80" : ""
                      }`}
                      onClick={(e) => {
                        if (
                          (e.target as HTMLElement).closest(".dropdown-root")
                        ) {
                          return;
                        }
                        e.stopPropagation();
                        handleItemClick(item);
                      }}
                      onDoubleClick={(e) => {
                        if (
                          (e.target as HTMLElement).closest(".dropdown-root")
                        ) {
                          return;
                        }
                        e.stopPropagation();
                        handleItemDoubleClick(item);
                      }}
                    >
                      <td className="py-2 pr-4 text-white">{name}</td>
                      <td className="py-2 pr-4 text-slate-400">
                        {item.kind === "department"
                          ? "Department"
                          : item.kind === "folder"
                          ? "Folder"
                          : doc.mime_type}
                      </td>
                      <td className="py-2 pr-4 text-slate-400">
                        {isFile ? formatSize(doc.size_bytes) : "—"}
                      </td>
                      <td className="py-2 pr-4 text-slate-400">
                        {isFile
                          ? new Date(doc.uploaded_at).toLocaleString()
                          : "—"}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <DropdownMenu
                          trigger={
                            <div className="dropdown-root inline-flex">
                              <IconButton
                                size="xs"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                ⋮
                              </IconButton>
                            </div>
                          }
                        >
                          <DropdownMenu.Item
                            onClick={() => {
                              setSelectedItem(item);
                              setRenameError(null);
                              setRenameName(getItemName(item));
                              setRenameOpen(true);
                            }}
                          >
                            Rename
                          </DropdownMenu.Item>

                          <DropdownMenu.Item
                            onClick={() => {
                              // Move placeholder
                            }}
                          >
                            Move
                          </DropdownMenu.Item>

                          <DropdownMenu.Item
                            destructive
                            onClick={() => {
                              setSelectedItem(item);
                              handleDeleteSelected();
                            }}
                          >
                            Delete
                          </DropdownMenu.Item>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* details side panel */}
        {detailsOpen && (
          <aside className="w-80 shrink-0 rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-xs">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase text-slate-400">
                Details
              </p>
              <IconButton
                size="xs"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setDetailsOpen(false);
                }}
              >
                ✕
              </IconButton>
            </div>

            {!selectedItem ? (
              <p className="text-slate-500 text-xs">
                Select a department, folder, or file to see details.
              </p>
            ) : selectedItem.kind === "file" ? (
              <>
                <p className="text-slate-100 text-sm mb-1">
                  {(selectedItem.data as DocumentRow).title ||
                    (selectedItem.data as DocumentRow).original_filename}
                </p>
                <p className="text-slate-400 mb-2">
                  {(selectedItem.data as DocumentRow).mime_type} •{" "}
                  {formatSize((selectedItem.data as DocumentRow).size_bytes)}
                </p>

                <div className="mb-3 h-40 rounded-md border border-slate-800 bg-slate-950/60 overflow-hidden">
                  {previewUrl ? (
                    <iframe
                      src={previewUrl}
                      className="h-full w-full"
                      title="Preview"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] text-slate-500">
                      No preview available
                    </div>
                  )}
                </div>

                <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
                  Activity
                </p>
                <p className="mb-3 text-slate-500">
                  Activity log placeholder (viewed, edited, shared...).
                </p>
                <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
                  Access
                </p>
                <p className="mb-2 text-slate-500">
                  Access controls and invite UI can go here.
                </p>
                <Button
                  size="xs"
                  variant="secondary"
                  className="px-2 py-1 text-[11px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  Invite people
                </Button>
              </>
            ) : (
              <>
                <p className="text-slate-100 text-sm mb-1">
                  {(selectedItem.data as any).name}
                </p>
                <p className="text-slate-400 mb-2">
                  {selectedItem.kind === "department" ? "Department" : "Folder"}
                </p>
                <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
                  Details
                </p>
                <p className="mb-3 text-slate-500">
                  Nested folder and file counts can be shown here later.
                </p>
                <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
                  Access
                </p>
                <p className="mb-2 text-slate-500">
                  Access rules for this container can go here.
                </p>
              </>
            )}
          </aside>
        )}
      </div>

      {/* Upload modal */}
      <Modal
        open={uploadOpen}
        title="Upload file"
        onClose={() => setUploadOpen(false)}
      >
        <form onSubmit={handleUpload} className="space-y-3 text-sm">
          {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
          <div className="space-y-1">
            <label className="block text-slate-300">Title (optional)</label>
            <input
              type="text"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none poborder-slate-700 focus:ring-2 focus:ring-sky-500"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-slate-300">File</label>
            <input
              type="file"
              className="w-full text-sm text-slate-200"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => setUploadOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="xs"
              variant="primary"
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* New folder modal */}
      <Modal
        open={newFolderOpen}
        title="New folder"
        onClose={() => {
          if (!creatingFolder) setNewFolderOpen(false);
        }}
      >
        <form onSubmit={handleCreateFolder} className="space-y-3 text-sm">
          {folderError && <p className="text-xs text-red-400">{folderError}</p>}
          <div className="space-y-1">
            <label className="block text-slate-300">Folder name</label>
            <input
              type="text"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={creatingFolder}
              onClick={() => setNewFolderOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="xs"
              variant="primary"
              disabled={creatingFolder}
            >
              {creatingFolder ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rename modal */}
      <Modal
        open={renameOpen}
        title="Rename"
        onClose={() => {
          if (!renaming) setRenameOpen(false);
        }}
      >
        <form onSubmit={handleRenameSubmit} className="space-y-3 text-sm">
          {renameError && <p className="text-xs text-red-400">{renameError}</p>}

          <div className="space-y-1">
            <label className="block text-slate-300">New name</label>
            <input
              type="text"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={renaming}
              onClick={() => setRenameOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="xs"
              variant="primary"
              disabled={renaming}
            >
              {renaming ? "Renaming…" : "Rename"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
