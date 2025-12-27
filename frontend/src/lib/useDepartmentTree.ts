import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Department, FolderRow, DocumentRow } from "../types/documents";

export function useDepartmentTree(userDepartmentId: number | null) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [currentDepartment, setCurrentDepartment] = useState<Department | null>(null);
  const [currentFolder, setCurrentFolder] = useState<FolderRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDepartmentContents = async (dept: Department) => {
    setLoading(true);
    setError(null);
    setCurrentDepartment(dept);
    setCurrentFolder(null);

    try {
      const [folderRes, docRes] = await Promise.all([
        api.get("/folders", {
          params: { department_id: dept.id },
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

  const getFolderChildren = (parentId: number | null) =>
    folders.filter((f) => f.parent_id === parentId);

  useEffect(() => {
    const init = async () => {
      if (!userDepartmentId) return;
      setLoading(true);
      setError(null);
      try {
        const deptRes = await api.get("/departments");
        const deptItems: Department[] = deptRes.data.data ?? deptRes.data;
        setDepartments(deptItems);

        const dept =
          deptItems.find((d) => d.id === userDepartmentId) || null;

        if (dept) {
          await loadDepartmentContents(dept);
        }
      } catch (e) {
        console.error(e);
        setError("Failed to load departments.");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [userDepartmentId]);

  return {
    departments,
    folders,
    documents,
    currentDepartment,
    currentFolder,
    loading,
    error,
    loadDepartmentContents,
    getFolderChildren,
  };
}
