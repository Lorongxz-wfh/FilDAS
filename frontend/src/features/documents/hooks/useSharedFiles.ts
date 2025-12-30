// src/features/documents/hooks/useSharedFiles.ts
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";
import type {
  Item,
  DocumentRow as BaseDocumentRow,
} from "../../../types/documents";

export type SortMode = "alpha" | "recent" | "ownerDept";
export type ViewMode = "grid" | "list";

export type DocumentRow = BaseDocumentRow & {
  folder_name?: string | null;
  department_name?: string | null;
  owner_name?: string | null;
  share_permission?: "viewer" | "editor" | string;
};

export type SharedFolder = {
  id: number;
  name: string;
  parent_id: number | null;
  department_id: number | null;
  department_name?: string | null;
  owner_id: number;
  owner_name?: string | null;
  permission: "viewer" | "editor";
};

type Params = { 
  userId: number;
  isAdmin: boolean;
};

export function useSharedFiles({ userId, isAdmin }: Params) {
  // navigation
  const [folderPath, setFolderPath] = useState<SharedFolder[]>([]);
  const currentFolder =
    folderPath.length > 0 ? folderPath[folderPath.length - 1] : null;


  const [folders, setFolders] = useState<SharedFolder[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [folderChildren, setFolderChildren] = useState<SharedFolder[]>([]);
  const [folderDocs, setFolderDocs] = useState<DocumentRow[]>([]);
  const [allSharedDocs, setAllSharedDocs] = useState<DocumentRow[]>([]);

  // Folder search results (root or under current folder)
  const [searchedFolders, setSearchedFolders] = useState<SharedFolder[] | null>(
    null
  );

  // Document search results (root or under current folder)
  const [searchedDocs, setSearchedDocs] = useState<DocumentRow[] | null>(null);



  // search
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // ui
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  // selection
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [detailsWidth, setDetailsWidth] = useState(320);

  // modals
  const [sharedUploadOpen, setSharedUploadOpen] = useState(false);
  const [sharedUploadMode, setSharedUploadMode] =
    useState<"files" | "folder">("files");
  const [sharedNewFolderOpen, setSharedNewFolderOpen] = useState(false);
  const [sharedCreatingFolder, setSharedCreatingFolder] = useState(false);
  const [sharedNewFolderName, setSharedNewFolderName] = useState("");
  const [sharedFolderError, setSharedFolderError] = useState<string | null>(
    null
  );
  const [sharedRenameOpen, setSharedRenameOpen] = useState(false);
  const [sharedRenameName, setSharedRenameName] = useState("");
  const [sharedRenaming, setSharedRenaming] = useState(false);
  const [sharedRenameError, setSharedRenameError] =
    useState<string | null>(null);
  const [sharedMoveCopyOpen, setSharedMoveCopyOpen] = useState(false);
  const [sharedPendingAction, setSharedPendingAction] = useState<
    "move" | "copy" | null
  >(null);
  const [sharedMoveCopyTargetFolderId, setSharedMoveCopyTargetFolderId] =
    useState<number | null>(null);

  // TODO: next steps will move loadTopLevelShared, loadSharedFolderContents,
  // search useEffect, preview useEffect, and helpers into this hook.

    // ---------- data loading helpers ----------

  const loadTopLevelShared = async () => {
    setLoading(true);
    setError(null);

    try {
      const [docsRes, foldersRes] = await Promise.all([
        api.get("/documents/shared"),
        api.get("/folders/shared"),
      ]);

      const foldersRaw = (foldersRes.data ?? []) as any[];
      const docsData = (docsRes.data ?? []) as any[];

      const foldersData: SharedFolder[] = foldersRaw.map((f) => ({
        id: f.id,
        name: f.name,
        parent_id: f.parentid ?? null,
        department_id: f.departmentid ?? null,
        department_name: f.departmentname ?? null,
        owner_id: f.ownerid ?? null,
        owner_name: f.ownername ?? null,
        permission: f.permission,
      }));

      const mappedAllDocs: DocumentRow[] = docsData.map((d) => ({
        id: d.id,
        title: d.title,
        original_filename: d.originalfilename,
        mime_type: d.mimetype,
        size_bytes: d.sizebytes,
        uploaded_at: d.uploadedat,
        last_opened_at: d.lastopenedat ?? null,
        folder_id: d.folderid ?? null,
        department_id: d.departmentid,
        folder_name: d.foldername ?? null,
        department_name: d.departmentname ?? null,
        owner_id: d.ownerid ?? null,
        owner_name: d.ownername ?? null,
        share_permission: d.sharepermission,
      }));

      setAllSharedDocs(mappedAllDocs);
      setDocuments(mappedAllDocs.filter((d) => !d.folder_id));
      setFolders(foldersData);
      setFolderChildren([]);
      setFolderDocs([]);
      setFolderPath([]);
      setSelectedItem(null);
      setPreviewUrl(null);
    } catch (e) {
      console.error(e);
      setError("Failed to load shared files.");
    } finally {
      setLoading(false);
    }
  };

  const loadSharedFolderContents = async (folder: SharedFolder) => {
    setLoading(true);
    setError(null);

    try {
      const [subFoldersRes, docsRes] = await Promise.all([
        api.get("/folders/shared", {
          params: { parent_id: folder.id },
        }),
        api.get("/documents/shared", {
          params: { folder_id: folder.id },
        }),
      ]);

      const subFoldersRaw = (subFoldersRes.data?.data ??
        subFoldersRes.data ??
        []) as any[];

      console.log("API subFoldersRaw for", folder.name, subFoldersRaw);

      const docsData = (docsRes.data?.data ?? docsRes.data ?? []) as any[];

      const subFolders: SharedFolder[] = subFoldersRaw.map((f) => ({
        id: f.id,
        name: f.name,
        parent_id: f.parentid ?? null,
        department_id: f.departmentid ?? null,
        department_name: f.departmentname ?? null,
        owner_id: f.ownerid ?? null,
        owner_name: f.ownername ?? null,
        permission: f.permission,
      }));

      const docs: DocumentRow[] = docsData.map((d) => ({
        id: d.id,
        title: d.title,
        original_filename: d.originalfilename,
        mime_type: d.mimetype,
        size_bytes: d.sizebytes,
        uploaded_at: d.uploadedat,
        last_opened_at: d.lastopenedat ?? null,
        folder_id: d.folderid ?? null,
        department_id: d.departmentid,
        folder_name: d.foldername ?? null,
        department_name: d.departmentname ?? null,
        owner_id: d.ownerid ?? null,
        owner_name: d.ownername ?? null,
        share_permission: d.sharepermission,
      }));

      setFolderChildren(subFolders);
      setFolderDocs(docs);
    } catch (e) {
      console.error(e);
      setError("Failed to load folder contents.");
      setFolderChildren([]);
      setFolderDocs([]);
    } finally {
      setLoading(false);
    }
  };

    const searchSharedFolders = async (query: string) => {
    const q = query.trim();
    if (!q) {
      setSearchedFolders(null);
      return;
    }

    try {
      // If inside a folder, search deep under that folder.
      const params: any = { q };
      if (currentFolder) {
        params.under_folder_id = currentFolder.id;
      }

      const res = await api.get("/folders/shared/search", { params });
      const raw = (res.data ?? []) as any[];

      const results: SharedFolder[] = raw.map((f) => ({
        id: f.id,
        name: f.name,
        parent_id: f.parentid ?? null,
        department_id: f.departmentid ?? null,
        department_name: f.departmentname ?? null,
        owner_id: f.ownerid ?? null,
        owner_name: f.ownername ?? null,
        permission: f.permission,
      }));

      setSearchedFolders(results);
    } catch (e) {
      console.error("Failed to search shared folders", e);
      // On error, fall back to no search results to avoid breaking UI.
      setSearchedFolders([]);
    }
  };

    const searchSharedDocuments = async (query: string) => {
    const q = query.trim();
    if (!q) {
      setSearchedDocs(null);
      return;
    }

    try {
      const params: any = { q };

      // At root: global shared docs search (you already use allSharedDocs).
      // Inside a folder: deep search under that folder.
      if (currentFolder) {
        params.under_folder_id = currentFolder.id;
      }

      const res = await api.get("/documents/shared/search", { params });
      const raw = (res.data ?? []) as any[];

      const results: DocumentRow[] = raw.map((d) => ({
        id: d.id,
        title: d.title,
        original_filename: d.originalfilename,
        mime_type: d.mimetype,
        size_bytes: d.sizebytes,
        uploaded_at: d.uploadedat,
        last_opened_at: d.lastopenedat ?? null,
        folder_id: d.folderid ?? null,
        department_id: d.departmentid,
        folder_name: d.foldername ?? null,
        department_name: d.departmentname ?? null,
        owner_id: d.ownerid ?? null,
        owner_name: d.ownername ?? null,
        share_permission: d.sharepermission,
      }));

      setSearchedDocs(results);
    } catch (e) {
      console.error("Failed to search shared documents", e);
      setSearchedDocs([]);
    }
  };



  // ---------- effects ----------

  useEffect(() => {
    loadTopLevelShared();
  }, []);

  // debounce search
  useEffect(() => {
    const handle = setTimeout(() => {
      const trimmed = searchQuery.trim();
      setDebouncedSearch(trimmed);

      if (trimmed.length === 0) {
        // Clear search results when query is cleared.
        setSearchedFolders(null);
        setSearchedDocs(null);
      } else {
        // Trigger API-based folder search (root or under current folder).
        searchSharedFolders(trimmed);
        // Trigger document search (root/global or under current folder).
        searchSharedDocuments(trimmed);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [searchQuery, currentFolder]);



  // preview (using /documents/{id}/preview)
  useEffect(() => {
    const loadPreview = async () => {
      if (!detailsOpen || !selectedItem || selectedItem.kind !== "file") {
        setPreviewUrl(null);
        setPreviewLoading(false);
        return;
      }

      const doc = selectedItem.data as DocumentRow;
      const mime = doc.mime_type;
      if (
        !mime.startsWith("image/") &&
        mime !== "application/pdf" &&
        !mime.includes("word") &&
        !mime.includes("presentation")
      ) {
        setPreviewUrl(null);
        setPreviewLoading(false);
        return;
      }

      setPreviewLoading(true);
      try {
        const res = await api.get(`/documents/${doc.id}/preview`);
        const url = res.data.stream_url ?? res.data.streamurl ?? null;
        setPreviewUrl(url);
      } catch (e) {
        console.error("Failed to load preview URL", e);
        setPreviewUrl(null);
      } finally {
        setPreviewLoading(false);
      }

    };

    loadPreview();
  }, [detailsOpen, selectedItem]);

    // ---------- derived data ----------

  const visibleFolders = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const hasSearch = q.length > 0;

    let source: SharedFolder[];

    if (hasSearch && searchedFolders !== null) {
      // When searching, use API results (root or under current folder).
      source = searchedFolders;
    } else if (!currentFolder) {
      // No search at root: only top-level shared roots.
      source = folders.filter((f) => f.parent_id === null);
    } else {
      // No search inside folder: show its direct children.
      source = folderChildren;
    }

    const list = [...source];
    list.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
    return list;
  }, [folders, folderChildren, currentFolder, debouncedSearch, searchedFolders]);


  const filteredSortedDocs = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const hasSearch = q.length > 0;

    let source: DocumentRow[];

    if (hasSearch && searchedDocs !== null) {
      // When searching, use API results (root or under current folder).
      source = searchedDocs;
    } else if (!currentFolder) {
      // No search at root: show top-level docs (no folder) as before.
      source = documents;
    } else {
      // No search inside folder: use direct children files.
      source = folderDocs;
    }


    let list = [...source];

    if (hasSearch) {
      list = list.filter((d) => {
        const name = (d.title || d.original_filename || "").toLowerCase();
        const dept = (d.department_name || "").toLowerCase();
        const owner = (d.owner_name || "").toLowerCase();
        const folder = (d.folder_name || "").toLowerCase();
        return (
          name.includes(q) ||
          dept.includes(q) ||
          owner.includes(q) ||
          folder.includes(q)
        );
      });
    }

    list.sort((a, b) => {
      if (sortMode === "alpha") {
        const na = (a.title || a.original_filename || "").toLowerCase();
        const nb = (b.title || b.original_filename || "").toLowerCase();
        return na.localeCompare(nb);
      }

      if (sortMode === "ownerDept") {
        const da = (a.department_name || "").toLowerCase();
        const db = (b.department_name || "").toLowerCase();
        if (da !== db) return da.localeCompare(db);
        const oa = (a.owner_name || "").toLowerCase();
        const ob = (b.owner_name || "").toLowerCase();
        if (oa !== ob) return oa.localeCompare(ob);
        const na = (a.title || a.original_filename || "").toLowerCase();
        const nb = (b.title || b.original_filename || "").toLowerCase();
        return na.localeCompare(nb);
      }

      // recent
      const ta = new Date(a.uploaded_at).getTime();
      const tb = new Date(b.uploaded_at).getTime();
      return tb - ta;
    });

    return list;
  }, [
    documents,
    folderDocs,
    currentFolder,
    debouncedSearch,
    sortMode,
    searchedDocs,
  ]);




  return {
    // state
    folderPath,
    setFolderPath,
    currentFolder,
    folders,
    setFolders,
    documents,
    setDocuments,
    folderChildren,
    setFolderChildren,
    folderDocs,
    setFolderDocs,
    allSharedDocs,
    setAllSharedDocs,
    searchQuery,
    setSearchQuery,
    debouncedSearch,
    setDebouncedSearch,
    loading,
    setLoading,
    error,
    setError,
    viewMode,
    setViewMode,
    sortMode,
    setSortMode,
    selectedItem,
    setSelectedItem,
    detailsOpen,
    setDetailsOpen,
    previewUrl,
    setPreviewUrl,
    previewLoading,
    setPreviewLoading,
    detailsWidth,
    setDetailsWidth,
    sharedUploadOpen,
    setSharedUploadOpen,
    sharedUploadMode,
    setSharedUploadMode,
    sharedNewFolderOpen,
    setSharedNewFolderOpen,
    sharedCreatingFolder,
    setSharedCreatingFolder,
    sharedNewFolderName,
    setSharedNewFolderName,
    sharedFolderError,
    setSharedFolderError,
    sharedRenameOpen,
    setSharedRenameOpen,
    sharedRenameName,
    setSharedRenameName,
    sharedRenaming,
    setSharedRenaming,
    sharedRenameError,
    setSharedRenameError,
    sharedMoveCopyOpen,
    setSharedMoveCopyOpen,
    sharedPendingAction,
    setSharedPendingAction,
    sharedMoveCopyTargetFolderId,
    setSharedMoveCopyTargetFolderId,
    loadTopLevelShared,
    loadSharedFolderContents,
    visibleFolders,
    filteredSortedDocs,
  };
}
