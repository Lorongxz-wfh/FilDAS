// src/features/documents/hooks/useSharedRenameDelete.ts
import { useState } from "react";
import { api } from "../../../lib/api";
import type { Item } from "../../../types/documents";
import type {
  DocumentRow,
  SharedFolder,
} from "./useSharedFiles";

type Params = {
  setAllSharedDocs: React.Dispatch<React.SetStateAction<DocumentRow[]>>;
  setDocuments: React.Dispatch<React.SetStateAction<DocumentRow[]>>;
  setFolderDocs: React.Dispatch<React.SetStateAction<DocumentRow[]>>;
  setFolders: React.Dispatch<React.SetStateAction<SharedFolder[]>>;
  setFolderChildren: React.Dispatch<React.SetStateAction<SharedFolder[]>>;
};

export function useSharedRenameDelete(params: Params) {
  const {
    setAllSharedDocs,
    setDocuments,
    setFolderDocs,
    setFolders,
    setFolderChildren,
  } = params;

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [renameOpen, setSharedRenameOpen] = useState(false);
  const [renameName, setSharedRenameName] = useState("");
  const [renaming, setSharedRenaming] = useState(false);
  const [renameError, setSharedRenameError] = useState<string | null>(null);

  const getSharedItemName = (item: Item | null) => {
    if (!item) return "";
    if (item.kind === "file") {
      const d = item.data as DocumentRow;
      return d.title || d.original_filename || "";
    }
    return (item.data as SharedFolder).name;
  };

  const handleSharedRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const newName = renameName.trim();
    if (!newName) {
      setSharedRenameError("Name is required.");
      return;
    }

    setSharedRenaming(true);
    setSharedRenameError(null);

    try {
      if (selectedItem.kind === "file") {
        const doc = selectedItem.data as DocumentRow;

        await api.patch(`/documents/${doc.id}`, { title: newName });

        const updated = { ...doc, title: newName };
        setAllSharedDocs((prev) =>
          prev.map((d) => (d.id === doc.id ? updated : d))
        );
        setDocuments((prev) =>
          prev.map((d) => (d.id === doc.id ? updated : d))
        );
        setFolderDocs((prev) =>
          prev.map((d) => (d.id === doc.id ? updated : d))
        );
        setSelectedItem({ kind: "file", data: updated as any });
      } else {
        const folder = selectedItem.data as SharedFolder;

        await api.patch(`/folders/${folder.id}`, { name: newName });

        const updated = { ...folder, name: newName };
        setFolders((prev) =>
          prev.map((f) => (f.id === folder.id ? updated : f))
        );
        setFolderChildren((prev) =>
          prev.map((f) => (f.id === folder.id ? updated : f))
        );
        setSelectedItem({ kind: "folder", data: updated as any });
      }

      setSharedRenameOpen(false);
    } catch (err: any) {
      console.error(err);
      setSharedRenameError(
        err.response?.data?.message || "Failed to rename item."
      );
    } finally {
      setSharedRenaming(false);
    }
  };

  const handleSharedDeleteSelected = async () => {
    if (!selectedItem) return;
    if (!window.confirm(`Delete this ${selectedItem.kind}?`)) return;
    try {
      if (selectedItem.kind === "file") {
        const doc = selectedItem.data as DocumentRow;
        await api.delete(`/documents/${doc.id}`);
        setAllSharedDocs((prev) => prev.filter((d) => d.id !== doc.id));
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
        setFolderDocs((prev) => prev.filter((d) => d.id !== doc.id));
      } else {
        const folder = selectedItem.data as SharedFolder;
        await api.delete(`/folders/${folder.id}`);
        setFolders((prev) => prev.filter((f) => f.id !== folder.id));
        setFolderChildren((prev) => prev.filter((f) => f.id !== folder.id));
      }
      setSelectedItem(null);
      setDetailsOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to delete item.");
    }
  };

  return {
    // selection + details
    selectedItem,
    setSelectedItem,
    detailsOpen,
    setDetailsOpen,

    // rename modal state
    sharedRenameOpen: renameOpen,
    setSharedRenameOpen,
    sharedRenameName: renameName,
    setSharedRenameName,
    sharedRenaming: renaming,
    sharedRenameError: renameError,
    setSharedRenameError,

    // helpers
    getSharedItemName,
    handleSharedRenameSubmit,
    handleSharedDeleteSelected,
  };
}
