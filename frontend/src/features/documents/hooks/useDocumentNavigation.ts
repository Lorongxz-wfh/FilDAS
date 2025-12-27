// src/features/documents/hooks/useDocumentNavigation.ts
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import type {
  Department,
  FolderRow,
  DocumentRow,
  Item,
  SortMode,
} from "../../../types/documents";

type Params = {
  isSuperAdmin: boolean;
  userDepartmentId: number | null;
};

export function useDocumentNavigation({ isSuperAdmin, userDepartmentId }: Params) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);

  const [currentDepartment, setCurrentDepartment] = useState<Department | null>(null);
  const [currentFolder, setCurrentFolder] = useState<FolderRow | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // debounced search
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 250);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const loadDepartmentContents = async (dept: Department) => {
    localStorage.setItem("fildas.currentDepartmentId", String(dept.id));
    localStorage.removeItem("fildas.currentFolderId");

    setLoading(true);
    setError(null);
    setCurrentDepartment(dept);
    setCurrentFolder(null);

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

  // INITIAL LOAD
  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      setError(null);
      try {
        const deptRes = await api.get("/departments");
        const deptItems: Department[] = deptRes.data.data ?? deptRes.data;
        setDepartments(deptItems);

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

        const storedDeptId = localStorage.getItem(
          "fildas.currentDepartmentId"
        );
        const storedFolderId = localStorage.getItem("fildas.currentFolderId");

        // Staff & Admin: force to their own department
        if (!isSuperAdmin) {
          const userDeptId = userDepartmentId;
          if (!userDeptId) {
            setCurrentDepartment(null);
            setCurrentFolder(null);
            return;
          }

          const dept = deptItems.find((d) => d.id === userDeptId) || null;
          if (!dept) {
            setCurrentDepartment(null);
            setCurrentFolder(null);
            return;
          }

          await loadDepartmentContents(dept);
          return;
        }

        // Super Admin: restore previous context
        if (!storedDeptId) {
          setCurrentDepartment(null);
          setCurrentFolder(null);
          return;
        }

        const deptId = Number(storedDeptId);
        const dept = deptItems.find((d) => d.id === deptId);
        if (!dept) {
          localStorage.removeItem("fildas.currentDepartmentId");
          localStorage.removeItem("fildas.currentFolderId");
          setCurrentDepartment(null);
          setCurrentFolder(null);
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
  }, [isSuperAdmin, userDepartmentId]);

  const handleGoBack = () => {
    if (currentFolder) {
      const parent =
        currentFolder.parent_id != null
          ? folders.find((f) => f.id === currentFolder.parent_id) || null
          : null;
      if (parent) {
        setCurrentFolder(parent);
        setSearchQuery("");
        setDebouncedSearch("");
        localStorage.setItem("fildas.currentFolderId", String(parent.id));
        loadFolderContents(parent);
      } else {
        setCurrentFolder(null);
        setSearchQuery("");
        setDebouncedSearch("");
        localStorage.removeItem("fildas.currentFolderId");
        if (currentDepartment) {
          loadDepartmentContents(currentDepartment);
        }
      }
    } else if (currentDepartment) {
      if (!isSuperAdmin) return;
      setCurrentDepartment(null);
      setCurrentFolder(null);
      setSearchQuery("");
      setDebouncedSearch("");
      localStorage.removeItem("fildas.currentDepartmentId");
      localStorage.removeItem("fildas.currentFolderId");
    }
  };

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

  return {
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
  };
}
