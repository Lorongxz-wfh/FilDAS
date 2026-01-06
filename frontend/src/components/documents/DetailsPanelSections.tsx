// src/components/documents/DetailsPanelSections.tsx
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import Modal from "../Modal";
import type { DocumentRow, FolderRow, Item } from "../../types/documents";

export const statusBadgeClass = (status?: string | null) => {
  if (status === "approved") {
    return "inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400";
  }
  if (status === "rejected") {
    return "inline-flex rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-400";
  }
  return "inline-flex rounded-full bg-slate-500/20 px-2 py-0.5 text-[10px] font-medium text-slate-300";
};

export type FileDetailsProps = {
  doc: DocumentRow;
  previewUrl: string | null;
  previewLoading: boolean;
  formatSize: (bytes: number) => string;
  status?: string | null;
  onDescriptionSaved?: () => void | Promise<void>;
  canComment?: boolean;
  onReplaceFile?: (docId: number, file: File) => Promise<any> | any;
  onReloadCurrent?: () => void | Promise<void>;
};

export type FolderDetailsProps = {
  folder: FolderRow;
  onDescriptionSaved?: () => void | Promise<void>;
  onFolderUpdated?: (folder: FolderRow) => void;
};

export function prettyType(mime: string): string {
  if (!mime) return "Unknown type";
  if (mime === "application/pdf") return "PDF document";
  if (mime.startsWith("image/")) return "Image";
  if (
    mime ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "Word document";
  if (mime === "application/msword") return "Word document";
  if (
    mime ===
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  )
    return "PowerPoint";
  if (mime === "application/vnd.ms-powerpoint") return "PowerPoint";
  return mime;
}

type VersionDto = {
  id: number;
  version_number: number;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: { id: number; name: string } | null;
  created_at: string | null;
};

export function FileDetails({
  doc,
  previewUrl,
  previewLoading,
  formatSize,
  status,
  onDescriptionSaved,
  canComment = false,
  onReplaceFile,
  onReloadCurrent,
}: FileDetailsProps) {
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [description, setDescription] = useState(doc.description || "");
  const [savingDescription, setSavingDescription] = useState(false);

  const [qaHistory, setQaHistory] = useState<QaActivityEntry[]>([]);
  const [qaHistoryLoading, setQaHistoryLoading] = useState(false);

  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [replaceFile, setReplaceFileState] = useState<File | null>(null);
  const [replacing, setReplacing] = useState(false);

  const [versions, setVersions] = useState<VersionDto[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);

  const [schoolYear, setSchoolYear] = useState<string | null>(
    (doc as any).school_year || null
  );
  const [savingSchoolYear, setSavingSchoolYear] = useState(false);

  const [tags, setTags] = useState<string[]>(
    Array.isArray((doc as any).tags)
      ? (doc as any).tags.map((t: any) => t.name)
      : []
  );
  const [newTag, setNewTag] = useState("");
  const [savingTags, setSavingTags] = useState(false);

  const currentYear = new Date().getFullYear();
  const schoolYearOptions: string[] = [];
  for (let start = 2022; start <= currentYear + 2; start++) {
    const end = start + 1;
    schoolYearOptions.push(`${start}-${end}`);
  }

  useEffect(() => {
    setDescription(doc.description || "");
    setEditingDescription(false);

    const currentYear = new Date().getFullYear();
    const defaultSy = `${currentYear}-${currentYear + 1}`;

    setSchoolYear((doc as any).school_year || defaultSy);

    setTags(
      Array.isArray((doc as any).tags)
        ? (doc as any).tags.map((t: any) => t.name)
        : []
    );

    const loadQaHistory = async () => {
      setQaHistoryLoading(true);
      try {
        const res = await api.get<QaActivityEntry[]>(
          `/documents/${doc.id}/activity`
        );
        const qaActions = ["uploaded", "approved", "rejected"];
        const filtered = res.data.filter((entry) =>
          qaActions.includes(entry.action)
        );
        setQaHistory(filtered);
      } catch (e) {
        console.error(e);
        setQaHistory([]);
      } finally {
        setQaHistoryLoading(false);
      }
    };

    const loadVersions = async () => {
      setVersionsLoading(true);
      setVersionsError(null);
      try {
        const res = await api.get<VersionDto[]>(
          `/documents/${doc.id}/versions`
        );
        setVersions(res.data);
      } catch (e) {
        console.error(e);
        setVersions([]);
        setVersionsError("Failed to load versions.");
      } finally {
        setVersionsLoading(false);
      }
    };

    loadQaHistory();
    loadVersions();
  }, [doc.id, doc.description]);

  const handleSaveDescription = async () => {
    setSavingDescription(true);
    try {
      await api.patch(`/documents/${doc.id}`, { description });
      setEditingDescription(false);
      if (onDescriptionSaved) await onDescriptionSaved();
    } catch (e) {
      console.error(e);
      alert("Failed to save description");
    } finally {
      setSavingDescription(false);
    }
  };

  const handleReplaceSubmit = async () => {
    if (!onReplaceFile || !replaceFile) return;
    setReplacing(true);
    try {
      await onReplaceFile(doc.id, replaceFile);
      setReplaceModalOpen(false);
      setReplaceFileState(null);
    } catch {
      // error notification handled by caller
    } finally {
      setReplacing(false);
    }
  };

  const handleSaveSchoolYear = async (value: string | null) => {
    setSavingSchoolYear(true);
    try {
      await api.patch(`/documents/${doc.id}`, {
        school_year: value,
      });
      (doc as any).school_year = value;
      setSchoolYear(value);
      if (onDescriptionSaved) {
        await onDescriptionSaved();
      }
    } catch (e) {
      console.error(e);
      alert("Failed to save school year.");
    } finally {
      setSavingSchoolYear(false);
    }
  };

  const syncTags = async (nextTags: string[]) => {
    if (!doc || !(doc as any).id) {
      console.error("Cannot sync tags: document id is missing", doc);
      return;
    }

    const docId = (doc as any).id as number;

    setSavingTags(true);
    try {
      const res = await api.post<DocumentRow>(`/documents/${docId}/tags`, {
        tags: nextTags,
      });
      const updated = res.data as any;
      setTags(
        Array.isArray(updated.tags) ? updated.tags.map((t: any) => t.name) : []
      );
      (doc as any).tags = updated.tags;

      // ask parent to reload current context + details
      if (onReloadCurrent) {
        await onReloadCurrent();
      } else if (onDescriptionSaved) {
        await onDescriptionSaved();
      }
    } catch (e: any) {
      console.error(e);
      alert(e?.response?.data?.error || "Failed to update tags.");
    } finally {
      setSavingTags(false);
    }
  };

  const handleAddTag = async () => {
    const trimmed = newTag.trim().toLowerCase();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      setNewTag("");
      return;
    }
    const nextTags = [...tags, trimmed];
    if (nextTags.length > 10) {
      alert("Maximum of 10 tags per document.");
      return;
    }
    setNewTag("");
    await syncTags(nextTags);
  };

  const handleRemoveTag = async (name: string) => {
    const nextTags = tags.filter((t) => t !== name);
    await syncTags(nextTags);
  };

  const handleRevertVersion = async (versionNumber: number) => {
    if (
      !window.confirm(
        `Revert file to version v${versionNumber}? This will create a new version representing the revert.`
      )
    ) {
      return;
    }

    try {
      const res = await api.post<DocumentRow>(
        `/documents/${doc.id}/versions/${versionNumber}/revert`
      );

      const updated = res.data;

      // Update basic doc fields locally so panel feels instant
      (doc as any).original_filename = updated.original_filename;
      (doc as any).mime_type = updated.mime_type;
      (doc as any).size_bytes = updated.size_bytes;
      (doc as any).uploaded_at = updated.uploaded_at;
      (doc as any).uploaded_by = updated.uploaded_by;

      // Reload versions list so the new revert version appears
      const versionsRes = await api.get<VersionDto[]>(
        `/documents/${doc.id}/versions`
      );
      setVersions(versionsRes.data);

      // Ask parent to reload current folder/department + details
      if (onReloadCurrent) {
        await onReloadCurrent();
      }
    } catch (e) {
      console.error(e);
      alert("Failed to revert to this version.");
    }
  };

  return (
    <>
      <p className="mb-1 text-sm font-medium text-slate-100">
        {doc.title || doc.original_filename}
      </p>
      <p className="mb-3 text-[11px] text-slate-400">
        {prettyType(doc.mime_type)} · {formatSize(doc.size_bytes)}
      </p>

      <div className="mb-3">
        <div className="mb-2 h-40 overflow-hidden rounded-md border border-slate-800 bg-slate-950/60">
          {previewLoading ? (
            <div className="flex h-full w-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            </div>
          ) : previewUrl ? (
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
        {previewUrl && !previewLoading && (
          <button
            type="button"
            className="text-[11px] text-sky-400 hover:text-sky-300"
            onClick={() => setPreviewModalOpen(true)}
          >
            View larger
          </button>
        )}
      </div>

      <div className="mb-3">
        <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
          Description
        </p>
        {editingDescription ? (
          <div className="space-y-2">
            <textarea
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={savingDescription}
            />
            <div className="flex gap-2">
              <button
                className="rounded-md bg-sky-600 px-2 py-1 text-[11px] text-white hover:bg-sky-500 disabled:opacity-60"
                onClick={handleSaveDescription}
                disabled={savingDescription}
              >
                {savingDescription ? "Saving..." : "Save"}
              </button>
              <button
                className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  setDescription(doc.description || "");
                  setEditingDescription(false);
                }}
                disabled={savingDescription}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-1 text-xs text-slate-300">
              {doc.description || (
                <span className="text-slate-500">No description.</span>
              )}
            </p>
            <button
              className="text-[11px] text-sky-400 hover:text-sky-300"
              onClick={() => setEditingDescription(true)}
            >
              Edit
            </button>
          </div>
        )}
      </div>

      <div className="mb-3 space-y-1 border-t border-slate-800 pt-2">
        <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
          File info
        </p>
        {status && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Status:</span>
            <span className={statusBadgeClass(status)}>
              {status || "pending"}
            </span>
          </div>
        )}
        {(doc as any).owner?.name && (
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Owner:</span>
            <span className="text-slate-200">{(doc as any).owner.name}</span>
          </div>
        )}
        {(doc as any).uploadedBy?.name && (
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Uploaded by:</span>
            <span className="text-slate-200">
              {(doc as any).uploadedBy.name}
            </span>
          </div>
        )}
        {doc.uploaded_at && (
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Uploaded:</span>
            <span className="text-slate-200">
              {new Date(doc.uploaded_at).toLocaleString()}
            </span>
          </div>
        )}
        {(doc as any).created_at && (
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Created:</span>
            <span className="text-slate-200">
              {new Date((doc as any).created_at).toLocaleString()}
            </span>
          </div>
        )}
        {(doc as any).updated_at && (
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Modified:</span>
            <span className="text-slate-200">
              {new Date((doc as any).updated_at).toLocaleString()}
            </span>
          </div>
        )}

        {/* School year */}
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="text-slate-500">School year:</span>
          <div className="flex items-center gap-1">
            <select
              className="rounded-md border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[11px] text-slate-200"
              value={schoolYear || ""}
              onChange={(e) => {
                const value = e.target.value || null;
                void handleSaveSchoolYear(value);
              }}
              disabled={savingSchoolYear}
            >
              <option value="">None</option>
              {schoolYearOptions.map((sy) => (
                <option key={sy} value={sy}>
                  {sy}
                </option>
              ))}
            </select>
          </div>
        </div>

        {onReplaceFile && (
          <div className="pt-2">
            <button
              type="button"
              className="text-[11px] text-sky-400 hover:text-sky-300"
              onClick={() => setReplaceModalOpen(true)}
            >
              Replace file (new version)
            </button>
          </div>
        )}
      </div>

      {/* QA history (same idea as QA Approval Center modal) */}
      <div className="mb-3 border-t border-slate-800 pt-2">
        <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
          QA history
        </p>
        <div className="max-h-32 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/40 p-2">
          {qaHistoryLoading ? (
            <div className="py-2 text-center text-[11px] text-slate-500">
              Loading QA history...
            </div>
          ) : qaHistory.length === 0 ? (
            <div className="py-2 text-center text-[11px] text-slate-500">
              No QA events yet.
            </div>
          ) : (
            qaHistory.map((entry) => (
              <div
                key={entry.id}
                className="mb-1 rounded bg-slate-800/60 px-2 py-1 text-[11px]"
              >
                <div className="text-[10px] text-slate-400">
                  {entry.user?.name ?? "System"} •{" "}
                  {new Date(entry.created_at).toLocaleString()}
                </div>
                <div className="text-slate-100">
                  {entry.action === "approved" && "Approved"}
                  {entry.action === "rejected" && "Rejected"}
                  {entry.action === "uploaded" && "Uploaded"}
                  {entry.action !== "approved" &&
                    entry.action !== "rejected" &&
                    entry.action !== "uploaded" &&
                    entry.action}
                  {entry.details ? ` — ${entry.details}` : ""}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mb-3 border-t border-slate-800 pt-2">
        <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
          Versions
        </p>
        <div className="max-h-32 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/40 p-2">
          {versionsLoading ? (
            <div className="py-2 text-center text-[11px] text-slate-500">
              Loading versions...
            </div>
          ) : versionsError ? (
            <div className="py-2 text-center text-[11px] text-rose-400">
              {versionsError}
            </div>
          ) : versions.length === 0 ? (
            <div className="py-2 text-center text-[11px] text-slate-500">
              No versions recorded.
            </div>
          ) : (
            versions.map((v) => (
              <div
                key={v.id}
                className="mb-1 flex items-center justify-between rounded bg-slate-800/60 px-2 py-1 text-[11px]"
              >
                <div className="flex flex-col">
                  <span className="text-slate-100">
                    v{v.version_number} ·{" "}
                    {v.original_filename || doc.original_filename}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {v.uploaded_by?.name ?? "Unknown"} ·{" "}
                    {v.created_at
                      ? new Date(v.created_at).toLocaleString()
                      : ""}
                  </span>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-slate-700 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-slate-800"
                  onClick={() => handleRevertVersion(v.version_number)}
                >
                  Revert
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mb-3 border-t border-slate-800 pt-2">
        <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
          Tags
        </p>
        <div className="mb-2 flex flex-wrap gap-1">
          {tags.length === 0 ? (
            <span className="text-[11px] text-slate-500">No tags yet.</span>
          ) : (
            tags.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-100"
              >
                {name}
                <button
                  type="button"
                  className="text-[11px] text-slate-400 hover:text-rose-400"
                  onClick={() => void handleRemoveTag(name)}
                  disabled={savingTags}
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            placeholder="Add tag (press Enter)"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleAddTag();
              }
            }}
            disabled={savingTags}
          />
          <button
            type="button"
            className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800 disabled:opacity-60"
            onClick={() => void handleAddTag()}
            disabled={savingTags || !newTag.trim()}
          >
            {savingTags ? "Saving..." : "Add"}
          </button>
        </div>
      </div>

      <FileCommentsSection documentId={doc.id} canComment={canComment} />

      <Modal
        open={replaceModalOpen}
        title="Replace file (new version)"
        onClose={() => {
          if (replacing) return;
          setReplaceModalOpen(false);
          setReplaceFileState(null);
        }}
      >
        <div className="space-y-3 text-xs text-slate-200">
          <p>
            Upload a new file to create a new version of this document. The
            current file will be kept in version history.
          </p>
          <input
            type="file"
            className="w-full text-[11px] text-slate-200"
            onChange={(e) => setReplaceFileState(e.target.files?.[0] ?? null)}
            disabled={replacing}
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800 disabled:opacity-60"
              onClick={() => {
                if (replacing) return;
                setReplaceModalOpen(false);
                setReplaceFileState(null);
              }}
              disabled={replacing}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-sky-600 px-2 py-1 text-[11px] text-white hover:bg-sky-500 disabled:opacity-60"
              disabled={!replaceFile || replacing}
              onClick={handleReplaceSubmit}
            >
              {replacing ? "Replacing..." : "Replace file"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={previewModalOpen}
        title={doc.title || doc.original_filename || "Preview"}
        onClose={() => setPreviewModalOpen(false)}
      >
        {previewUrl ? (
          <div className="h-[80vh] w-full">
            <iframe
              src={previewUrl}
              className="h-full w-full rounded-md border border-slate-800"
              title="Preview (large)"
            />
          </div>
        ) : (
          <p className="text-xs text-slate-500">No preview available.</p>
        )}
      </Modal>
    </>
  );
}

export function FolderDetails({
  folder,
  onDescriptionSaved,
  onFolderUpdated,
}: FolderDetailsProps) {
  const [editingDescription, setEditingDescription] = useState(false);
  const [description, setDescription] = useState(
    (folder as any).description || ""
  );
  const [savingDescription, setSavingDescription] = useState(false);

  useEffect(() => {
    setDescription((folder as any).description || "");
    setEditingDescription(false);
  }, [folder.id, (folder as any).description]);

  const handleSaveDescription = async () => {
    setSavingDescription(true);
    try {
      const res = await api.patch(`/folders/${folder.id}`, { description });
      const updated = (res.data.folder ?? res.data) as FolderRow;

      setEditingDescription(false);
      setDescription(updated.description || "");

      if (onFolderUpdated) {
        onFolderUpdated(updated);
      }

      if (onDescriptionSaved) await onDescriptionSaved();
    } catch (e) {
      console.error(e);
      alert("Failed to save description");
    } finally {
      setSavingDescription(false);
    }
  };

  return (
    <>
      <p className="mb-1 text-sm font-medium text-slate-100">{folder.name}</p>
      <p className="mb-3 text-[11px] text-slate-400">Folder</p>

      <div className="mb-3">
        <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
          Description
        </p>
        {editingDescription ? (
          <div className="space-y-2">
            <textarea
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={savingDescription}
            />
            <div className="flex gap-2">
              <button
                className="rounded-md bg-sky-600 px-2 py-1 text-[11px] text-white hover:bg-sky-500 disabled:opacity-60"
                onClick={handleSaveDescription}
                disabled={savingDescription}
              >
                {savingDescription ? "Saving..." : "Save"}
              </button>
              <button
                className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  setDescription((folder as any).description || "");
                  setEditingDescription(false);
                }}
                disabled={savingDescription}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-1 text-xs text-slate-300">
              {(folder as any).description || (
                <span className="text-slate-500">No description.</span>
              )}
            </p>
            <button
              className="text-[11px] text-sky-400 hover:text-sky-300"
              onClick={() => setEditingDescription(true)}
            >
              Edit
            </button>
          </div>
        )}
      </div>

      <div className="mb-3 space-y-1 border-t border-slate-800 pt-2">
        <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
          Folder info
        </p>
        {(folder as any).owner?.name && (
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Owner:</span>
            <span className="text-slate-200">{(folder as any).owner.name}</span>
          </div>
        )}
        {(folder as any).created_at && (
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Created:</span>
            <span className="text-slate-200">
              {new Date((folder as any).created_at).toLocaleString()}
            </span>
          </div>
        )}
        {(folder as any).updated_at && (
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500">Modified:</span>
            <span className="text-slate-200">
              {new Date((folder as any).updated_at).toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

export function DepartmentDetails({ selectedItem }: { selectedItem: Item }) {
  const dept = selectedItem.data as any;
  return (
    <>
      <p className="mb-1 text-sm font-medium text-slate-100">{dept.name}</p>
      <p className="mb-3 text-[11px] text-slate-400">Department</p>
      <p className="text-[11px] text-slate-500">
        Departments are administrative containers. File/folder counts and
        detailed stats can be shown here.
      </p>
    </>
  );
}

type CommentDto = {
  id: number;
  body: string;
  created_at: string;
  user: { id: number; name: string; email: string } | null;
};

type QaActivityEntry = {
  id: number;
  action: string;
  details: string | null;
  created_at: string;
  user: { id: number; name: string; email: string } | null;
};

function FileCommentsSection({
  documentId,
  canComment,
}: {
  documentId: number;
  canComment: boolean;
}) {
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadComments = async () => {
      setLoading(true);
      try {
        const res = await api.get<CommentDto[]>(
          `/documents/${documentId}/comments`
        );
        setComments(res.data);
      } catch (e) {
        console.error(e);
        setComments([]);
      } finally {
        setLoading(false);
      }
    };

    loadComments();
  }, [documentId]);

  const handleAddComment = async () => {
    if (!canComment || !newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post<CommentDto>(
        `/documents/${documentId}/comments`,
        {
          body: newComment.trim(),
        }
      );
      setComments((prev) => [...prev, res.data]);
      setNewComment("");
    } catch (e) {
      console.error(e);
      alert("Failed to add comment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-3 border-t border-slate-800 pt-2">
      <p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">
        Comments
      </p>

      <div className="mb-2 h-40 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/40 p-2">
        {loading ? (
          <div className="py-3 text-center text-[11px] text-slate-500">
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div className="py-3 text-center text-[11px] text-slate-500">
            No comments yet.
          </div>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              className="mb-2 rounded bg-slate-800/60 px-2 py-1 text-[11px]"
            >
              <div className="mb-0.5 text-[10px] text-slate-400">
                {c.user?.name ?? "Unknown"} •{" "}
                {new Date(c.created_at).toLocaleString()}
              </div>
              <div className="whitespace-pre-wrap text-slate-100">{c.body}</div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2">
        {canComment ? (
          <>
            <input
              className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <button
              className="rounded-md bg-sky-600 px-2 py-1 text-[11px] text-white hover:bg-sky-500 disabled:opacity-60"
              disabled={!newComment.trim() || submitting}
              onClick={handleAddComment}
            >
              {submitting ? "Sending..." : "Send"}
            </button>
          </>
        ) : (
          <p className="text-[11px] text-slate-500">
            You can view comments but not add new ones.
          </p>
        )}
      </div>
    </div>
  );
}
