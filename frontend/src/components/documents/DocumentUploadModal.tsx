// src/components/documents/DocumentUploadModal.tsx
import { useState } from "react";
import Modal from "../Modal";
import { api } from "../../lib/api";
import { notify } from "../../lib/notify";

type Props = {
  open: boolean;
  mode: "files" | "folder"; // NEW: distinguish file vs folder upload
  currentDepartmentId: number | null;
  currentFolderId: number | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
};

type FileWithProgress = {
  file: File;
  title: string;
  relativePath: string; // folder path like "Subfolder1/Subfolder2"
  status: "pending" | "uploading" | "done" | "error";
  progress: number; // 0–100
  error?: string;
};

export function DocumentUploadModal({
  open,
  mode,
  currentDepartmentId,
  currentFolderId,
  onClose,
  onSuccess,
}: Props) {
  const [files, setFiles] = useState<FileWithProgress[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const items = Array.from(e.dataTransfer.items || []);
    const files: File[] = [];
    let hasDirectory = false;

    for (const item of items) {
      if (item.kind !== "file") continue;
      const entry = (item as any).webkitGetAsEntry?.();
      if (entry && entry.isDirectory) {
        hasDirectory = true;
      }
      const file = item.getAsFile();
      if (file) {
        files.push(file);
      }
    }

    // Enforce mode
    if (mode === "files" && hasDirectory) {
      notify(
        "This area only accepts files. Use “Upload folder” for folders.",
        "info"
      );
      return;
    }

    if (mode === "folder" && !hasDirectory) {
      notify(
        "This area expects a folder with at least one file. Use “Upload files” for single files, or create empty folders via the New folder button.",
        "info"
      );
      return;
    }

    if (files.length === 0) {
      notify(
        "No files found in this folder. Empty folders cannot be uploaded. Please add a file or create the folder manually in the app.",
        "info"
      );
      return;
    }

    addFiles(files);
  };

  const handleBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const selectedFiles = Array.from(e.target.files);

    // Any webkitRelativePath means user picked a folder (via webkitdirectory)
    const hasRelativePath = selectedFiles.some(
      (f) => !!(f as any).webkitRelativePath
    );

    // Files mode: block folder picks
    if (mode === "folder") {
      if (selectedFiles.length === 0) {
        notify(
          "No files found in this folder. Empty folders cannot be uploaded. Please add a file or create the folder manually in the app.",
          "info"
        );
        return;
      }
    }

    // Folder mode: require at least one file
    if (mode === "folder") {
      if (selectedFiles.length === 0) {
        alert(
          "No files found in this folder. Empty folders cannot be uploaded. " +
            "Please add a file or create the folder manually in the app."
        );
        return;
      }
      // Note: if there is 1 file directly in the folder, this is still valid.
    }

    addFiles(selectedFiles);
  };

  const addFiles = (newFiles: File[]) => {
    const items: FileWithProgress[] = newFiles.map((f) => {
      // Extract relative path from webkitRelativePath (only set when using webkitdirectory)
      const fullPath = (f as any).webkitRelativePath || f.name;
      const parts = fullPath.split("/");
      // Keep ALL folder segments (exclude only the filename)
      const relativePath = parts.length > 1 ? parts.slice(0, -1).join("/") : "";

      return {
        file: f,
        title: f.name,
        relativePath,
        status: "pending",
        progress: 0,
      };
    });
    setFiles((prev) => [...prev, ...items]);
  };

  const handleRemove = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadAll = async () => {
    if (!currentFolderId && !currentDepartmentId) {
      notify("No folder or department selected.", "error");
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const item = files[i];
      if (item.status === "done") continue;

      setFiles((prev) => {
        const copy = [...prev];
        copy[i].status = "uploading";
        return copy;
      });

      try {
        const form = new FormData();
        form.append("title", item.title || item.file.name);
        form.append("description", "");

        if (currentFolderId) {
          form.append("folder_id", String(currentFolderId));
        } else if (currentDepartmentId) {
          form.append("department_id", String(currentDepartmentId));
        }

        form.append("file", item.file);

        if (item.relativePath) {
          form.append("relative_path", item.relativePath);
        }

        await api.post("/documents", form, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (evt) => {
            if (!evt.total) return;
            const pct = Math.round((evt.loaded / evt.total) * 100);
            setFiles((prev) => {
              const copy = [...prev];
              if (copy[i]) copy[i].progress = pct;
              return copy;
            });
          },
        });

        setFiles((prev) => {
          const copy = [...prev];
          if (copy[i]) {
            copy[i].status = "done";
            copy[i].progress = 100;
          }
          return copy;
        });
      } catch (e: any) {
        console.error(e);
        const msg =
          e?.response?.data?.error ||
          e?.response?.data?.message ||
          "Upload failed";

        setFiles((prev) => {
          const copy = [...prev];
          copy[i].status = "error";
          copy[i].error = msg;
          return copy;
        });
      }
    }

    await onSuccess();
  };

  const handleClose = () => {
    setFiles([]);
    onClose();
  };

  const allDone = files.length > 0 && files.every((f) => f.status === "done");
  const uploading = files.some((f) => f.status === "uploading");

  return (
    <Modal
      open={open}
      title={mode === "folder" ? "Upload folder" : "Upload files"}
      onClose={handleClose}
    >
      <div className="space-y-3 text-sm">
        {/* Drop zone */}
        <div
          className={`relative rounded-lg border-2 border-dashed p-6 text-center transition ${
            isDragging
              ? "border-sky-500 bg-sky-950/20"
              : "border-slate-700 bg-slate-900/40"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <p className="mb-2 text-xs text-slate-300">
            {mode === "folder"
              ? "Drag & drop a folder here, or"
              : "Drag & drop files here, or"}
          </p>
          <label className="cursor-pointer rounded-md bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-500">
            {mode === "folder" ? "Browse folder" : "Browse files"}
            <input
              type="file"
              multiple={mode === "files"}
              {...(mode === "folder" &&
                ({ webkitdirectory: "", directory: "" } as any))}
              className="hidden"
              onChange={handleBrowse}
            />
          </label>
        </div>

        {/* File list with folder structure indicator */}
        {files.length > 0 && (
          <div className="max-h-60 space-y-2 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/40 p-2">
            {files.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900/60 p-2"
              >
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-xs text-slate-200">
                    {item.relativePath ? `${item.relativePath}/` : ""}
                    <span className="font-medium">{item.title}</span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {(item.file.size / 1024).toFixed(1)} KB
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1 min-w-[120px]">
                  {item.status === "uploading" && (
                    <>
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-sky-500 transition-[width]"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-300">
                        {item.progress}%
                      </span>
                    </>
                  )}

                  {item.status === "pending" && (
                    <span className="text-[11px] text-slate-400">Pending</span>
                  )}

                  {item.status === "done" && (
                    <span className="text-[11px] text-emerald-400">✓ Done</span>
                  )}

                  {item.status === "error" && (
                    <span
                      className="text-[11px] text-red-400"
                      title={item.error}
                    >
                      ✕ Failed
                    </span>
                  )}

                  {item.status === "pending" && (
                    <button
                      type="button"
                      className="text-[11px] text-slate-400 hover:text-red-400"
                      onClick={() => handleRemove(idx)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            className="rounded-md border border-slate-700 px-3 py-2 text-xs text-white hover:bg-slate-800"
            onClick={handleClose}
            disabled={uploading}
          >
            {allDone ? "Close" : "Cancel"}
          </button>
          <button
            type="button"
            className="rounded-md bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-60"
            disabled={files.length === 0 || uploading || allDone}
            onClick={handleUploadAll}
          >
            {uploading ? "Uploading…" : `Upload ${files.length} file(s)`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
