// src/features/documents/pages/ArchivePage.tsx
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { Button } from "../../../components/ui/Button";
import { notify } from "../../../lib/notify";
import type { DocumentRow, FolderRow } from "../../../types/documents";
import { useOutletContext } from "react-router-dom";

type LayoutContext = {
  user: {
    id: number;
    name: string;
    email: string;
    department_id: number | null;
    role?: { id: number; name: string } | null;
  };
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

type ArchivedFolder = FolderRow & {
  department_name?: string | null;
  owner_name?: string | null;
};

type ArchivedDocument = DocumentRow & {
  department_name?: string | null;
  owner_name?: string | null;
  folder_name?: string | null;
};

export default function ArchivePage() {
  const { isSuperAdmin } = useOutletContext<LayoutContext>();

  const [folders, setFolders] = useState<ArchivedFolder[]>([]);
  const [documents, setDocuments] = useState<ArchivedDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadArchive = async () => {
    setLoading(true);
    setError(null);
    try {
      const [foldersRes, docsRes] = await Promise.all([
        api.get("/archive/folders"),
        api.get("/archive/documents"),
      ]);

      const foldersData: ArchivedFolder[] =
        foldersRes.data.data ?? foldersRes.data ?? [];
      const docsData: ArchivedDocument[] =
        docsRes.data.data ?? docsRes.data ?? [];

      setFolders(foldersData);
      setDocuments(docsData);
    } catch (e: any) {
      console.error(e);
      const msg = e?.response?.data?.message || "Failed to load archive.";
      setError(msg);
      notify(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArchive();
  }, []);

  const handleRestoreFolder = async (folder: ArchivedFolder) => {
    if (
      !window.confirm(`Restore folder "${folder.name}" and all its contents?`)
    ) {
      return;
    }

    try {
      await api.post(`/folders/${folder.id}/restore`);
      notify("Folder restored.", "success");
      await loadArchive();
    } catch (e: any) {
      console.error(e);
      const msg = e?.response?.data?.message || "Failed to restore folder.";
      notify(msg, "error");
    }
  };

  const handleRestoreDocument = async (doc: ArchivedDocument) => {
    if (
      !window.confirm(
        `Restore document "${doc.title || doc.original_filename}"?`
      )
    ) {
      return;
    }

    try {
      await api.post(`/documents/${doc.id}/restore`);
      notify("Document restored.", "success");
      await loadArchive();
    } catch (e: any) {
      console.error(e);
      const msg = e?.response?.data?.message || "Failed to restore document.";
      notify(msg, "error");
    }
  };

  const handleDeleteFolder = async (folder: ArchivedFolder) => {
    if (!isSuperAdmin) return;

    if (
      !window.confirm(
        `Permanently delete folder "${folder.name}" and ALL its contents? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await api.delete(`/folders/${folder.id}`);
      notify("Folder permanently deleted.", "success");
      await loadArchive();
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.message || "Failed to permanently delete folder.";
      notify(msg, "error");
    }
  };

  const handleDeleteDocument = async (doc: ArchivedDocument) => {
    if (!isSuperAdmin) return;

    if (
      !window.confirm(
        `Permanently delete document "${
          doc.title || doc.original_filename
        }"? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await api.delete(`/documents/${doc.id}`);
      notify("Document permanently deleted.", "success");
      await loadArchive();
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.message || "Failed to permanently delete document.";
      notify(msg, "error");
    }
  };

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-white">Archive</h1>
      <div className="mb-3 flex items-center gap-2 text-xs">
        <Button
          size="xs"
          variant="secondary"
          onClick={loadArchive}
          disabled={loading}
        >
          {loading ? "Reloading…" : "Reload"}
        </Button>
        {error && <span className="text-[11px] text-red-400">{error}</span>}
      </div>

      <div className="flex flex-col gap-4 text-xs text-slate-200">
        {/* Archived folders */}
        <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase text-slate-400">
            Archived folders
          </p>
          {folders.length === 0 ? (
            <p className="text-[11px] text-slate-500">No archived folders.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                  <tr>
                    <th className="py-2 pr-3">Folder</th>
                    <th className="py-2 pr-3">Department</th>
                    <th className="py-2 pr-3">Owner</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {folders.map((folder) => (
                    <tr key={folder.id}>
                      <td className="py-2 pr-3 text-slate-100">
                        {folder.name}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {folder.department_name || "Unknown"}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {folder.owner_name || "Unknown"}
                      </td>
                      <td className="py-2 pr-3 flex gap-2">
                        <Button
                          size="xs"
                          onClick={() => handleRestoreFolder(folder)}
                        >
                          Restore
                        </Button>
                        {isSuperAdmin && (
                          <Button
                            size="xs"
                            variant="secondary"
                            onClick={() => handleDeleteFolder(folder)}
                          >
                            Delete
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Archived documents */}
        <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase text-slate-400">
            Archived documents
          </p>
          {documents.length === 0 ? (
            <p className="text-[11px] text-slate-500">No archived documents.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                  <tr>
                    <th className="py-2 pr-3">Document</th>
                    <th className="py-2 pr-3">Folder</th>
                    <th className="py-2 pr-3">Owner</th>
                    <th className="py-2 pr-3">Department</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {documents.map((doc) => (
                    <tr key={doc.id}>
                      <td className="py-2 pr-3 text-slate-100">
                        {doc.title || doc.original_filename}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {doc.folder_name || "—"}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {doc.owner_name || "Unknown"}
                      </td>
                      <td className="py-2 pr-3 text-slate-300">
                        {doc.department_name || "Unknown"}
                      </td>
                      <td className="py-2 pr-3 flex gap-2">
                        <Button
                          size="xs"
                          onClick={() => handleRestoreDocument(doc)}
                        >
                          Restore
                        </Button>
                        {isSuperAdmin && (
                          <Button
                            size="xs"
                            variant="secondary"
                            onClick={() => handleDeleteDocument(doc)}
                          >
                            Delete
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
