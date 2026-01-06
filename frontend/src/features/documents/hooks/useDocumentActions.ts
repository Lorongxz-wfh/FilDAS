// src/features/documents/hooks/useDocumentActions.ts
import { useState } from "react";
import { api } from "../../../lib/api";
import { notify } from "../../../lib/notify";
import type {
  DocumentRow,
  FolderRow,
  Department,
  Item,
} from "../../../types/documents";

type UseDocumentActionsArgs = {
  currentDepartment: Department | null;
  currentFolder: FolderRow | null;
  setDepartments: (updater: (prev: Department[]) => Department[]) => void;
  setFolders: (updater: (prev: FolderRow[]) => FolderRow[]) => void;
  setDocuments: (updater: (prev: DocumentRow[]) => DocumentRow[]) => void;
  loadDepartmentContents: (dept: Department) => Promise<void>;
  loadFolderContents: (folder: FolderRow) => Promise<void>;
};

export function useDocumentActions({
  currentDepartment,
  currentFolder,
  setDepartments,
  setFolders,
  setDocuments,
  loadDepartmentContents,
  loadFolderContents,
}: UseDocumentActionsArgs) {
  const [isBusy, setIsBusy] = useState(false);

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

  const handleTrashSelected = async (
    selectedItem: Item | null,
    onCleared: () => void
  ) => {
    if (!selectedItem) return;

    const label =
      selectedItem.kind === "file"
        ? "this file"
        : selectedItem.kind === "folder"
        ? "this folder (and its contents)"
        : "this item";

    if (
      !window.confirm(
        `Trash ${label}? It will be hidden from normal views but kept in the Trash.`
      )
    ) {
      return;
    }

    setIsBusy(true);
    try {
      if (selectedItem.kind === "file") {
        const doc = selectedItem.data as DocumentRow;
        await api.post(`/documents/${doc.id}/trash`);
      } else if (selectedItem.kind === "folder") {
        const folder = selectedItem.data as FolderRow;
        await api.post(`/folders/${folder.id}/trash`);
      } else {
        return;
      }

      if (currentFolder) {
        await loadFolderContents(currentFolder);
      } else if (currentDepartment) {
        await loadDepartmentContents(currentDepartment);
      }

      onCleared();
      notify("Item trashd.", "success");
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        "Failed to trash item.";
      notify(msg, "error");
    } finally {
      setIsBusy(false);
    }
  };

  const moveSelected = async (selectedItem: Item | null, targetFolderId: number | null) => {
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

  const copySelected = async (selectedItem: Item | null, targetFolderId: number | null) => {
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

  const replaceFile = async (docId: number, file: File) => {
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await api.post<DocumentRow>(
        `/documents/${docId}/replace-file`,
        form,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      const updated = res.data;

      // Update documents list with the new metadata
      setDocuments((prev) =>
        prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d))
      );

      notify("File replaced and new version created.", "success");
      return updated;
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        "Failed to replace file.";
      notify(msg, "error");
      throw e;
    }
  };

  

  return {
    isBusy,
    setIsBusy,
    handleDownload,
    handleDownloadFolder,
    handleTrashSelected,
    moveSelected,
    copySelected,
    replaceFile, // NEW
  };
}
