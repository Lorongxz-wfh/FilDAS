// src/features/documents/hooks/useSharedRenameDelete.ts
import { useState } from "react";
import { api } from "../../../lib/api";
import type { Item } from "../../../types/documents";
import type {
  DocumentRow,
  SharedFolder,
} from "./useSharedFiles";
import { notify } from "../../../lib/notify";

type Params = {
  setAllSharedDocs: React.Dispatch<React.SetStateAction<DocumentRow[]>>;
  setDocuments: React.Dispatch<React.SetStateAction<DocumentRow[]>>;
  setFolderDocs: React.Dispatch<React.SetStateAction<DocumentRow[]>>;
  setFolders: React.Dispatch<React.SetStateAction<SharedFolder[]>>;
  setFolderChildren: React.Dispatch<React.SetStateAction<SharedFolder[]>>;

  // For auto‑reload on permission change (403)
  currentFolder: SharedFolder | null;
  loadTopLevelShared: () => Promise<void>;
  loadSharedFolderContents: (folder: SharedFolder) => Promise<void>;
};


export function useSharedRenameDelete(params: Params) {
  const {
    setAllSharedDocs,
    setDocuments,
    setFolderDocs,
    setFolders,
    setFolderChildren,
    currentFolder,
    loadTopLevelShared,
    loadSharedFolderContents,
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
    
      notify("Renamed successfully.", "success");
      setSharedRenameOpen(false);


      setSharedRenameOpen(false);
    } catch (err: any) {
      console.error(err);

      const status = err?.response?.status;
      const message =
        err?.response?.data?.message || "Failed to rename item.";

      if (status === 403) {
        setSharedRenameError("You no longer have permission to rename this item.");
        notify(
          "Your access to this shared item changed. Reloading…",
          "error"
        );

        // Deselect the stale item and close details.
        setSelectedItem(null);
        setDetailsOpen(false);

        // Auto‑reload the shared view so buttons/permissions update.
        if (currentFolder) {
          await loadSharedFolderContents(currentFolder);
        } else {
          await loadTopLevelShared();
        }
      } else {

        setSharedRenameError(message);
        notify(message, "error");
      }
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
      setSelectedItem(null);
      setDetailsOpen(false);
      notify("Item deleted.", "success");

    } catch (err: any) {
      console.error(err);

      const status = err?.response?.status;
      const message =
        err?.response?.data?.message || "Failed to delete item.";

      if (status === 403) {
        notify(
          "Your access to this shared item changed. Reloading…",
          "error"
        );

        // Deselect the stale item and close details.
        setSelectedItem(null);
        setDetailsOpen(false);

        if (currentFolder) {
          await loadSharedFolderContents(currentFolder);
        } else {
          await loadTopLevelShared();
        }
      } else {

        notify(message, "error");
      }
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
