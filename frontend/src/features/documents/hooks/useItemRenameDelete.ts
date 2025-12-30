// src/features/documents/hooks/useItemRenameDelete.ts
import { useState } from "react";
import { api } from "../../../lib/api";
import type {
  Department,
  DocumentRow,
  FolderRow,
  Item,
} from "../../../types/documents";
import { notify } from "../../../lib/notify";


type Params = {
  currentDepartment: Department | null;
  currentFolder: FolderRow | null;
  setCurrentDepartment: (d: Department | null) => void;
  setCurrentFolder: (f: FolderRow | null) => void;
  setDepartments: React.Dispatch<React.SetStateAction<Department[]>>;
  setFolders: React.Dispatch<React.SetStateAction<FolderRow[]>>;
  setDocuments: React.Dispatch<React.SetStateAction<DocumentRow[]>>;
};

export function useItemRenameDelete(params: Params) {
  const {
    currentDepartment,
    currentFolder,
    setCurrentDepartment,
    setCurrentFolder,
    setDepartments,
    setFolders,
    setDocuments,
  } = params;

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

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

      notify("Renamed successfully.", "success");
      setRenameOpen(false);
    } catch (err: any) {
      console.error(err);

      const status = err?.response?.status;
      const message =
        err?.response?.data?.message || "Failed to rename item.";

      if (status === 403) {
        setRenameError("You no longer have permission to rename this item.");
        notify(
          "Your access to this item changed. Please refresh the page or reopen the folder.",
          "error"
        );
      } else {
        setRenameError(message);
        notify(message, "error");
      }
    } finally {
      setRenaming(false);
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
      notify("Item deleted.", "success");
    } catch (err: any) {
      console.error(err);

      const status = err?.response?.status;
      const message =
        err?.response?.data?.message || "Failed to delete item on server.";

      if (status === 403) {
        notify(
          "Your access to this item changed. Please refresh the page or reopen the folder.",
          "error"
        );
      } else {
        notify(message, "error");
      }
    }


  };

  return {
    // selection / details managed here
    selectedItem,
    setSelectedItem,
    detailsOpen,
    setDetailsOpen,

    // rename modal state
    renameOpen,
    setRenameOpen,
    renameName,
    setRenameName,
    renaming,
    renameError,
    setRenameError,

    // helpers
    getItemName,
    handleRenameSubmit,
    handleDeleteSelected,
  };
}
