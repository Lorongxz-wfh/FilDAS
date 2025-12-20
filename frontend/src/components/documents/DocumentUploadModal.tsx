// src/components/documents/DocumentUploadModal.tsx
import Modal from "../Modal";

type Props = {
  open: boolean;
  uploading: boolean;
  uploadError: string | null;
  uploadTitle: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onChangeTitle: (value: string) => void;
  onChangeFile: (file: File | null) => void;
};

export function DocumentUploadModal({
  open,
  uploading,
  uploadError,
  uploadTitle,
  onClose,
  onSubmit,
  onChangeTitle,
  onChangeFile,
}: Props) {
  return (
    <Modal open={open} title="Upload file" onClose={onClose}>
      <form className="space-y-3 text-sm" onSubmit={onSubmit}>
        {uploadError && (
          <p className="rounded border border-rose-900 bg-rose-950/40 px-2 py-1 text-xs text-rose-400">
            {uploadError}
          </p>
        )}

        <div>
          <label className="mb-1 block text-xs text-slate-400">File</label>
          <input
            type="file"
            className="w-full text-xs text-slate-200"
            onChange={(e) => onChangeFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-400">
            Title (optional)
          </label>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={uploadTitle}
            onChange={(e) => onChangeTitle(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            className="rounded-md border border-slate-700 px-3 py-2 text-xs text-white hover:bg-slate-800"
            onClick={onClose}
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-60"
            disabled={uploading}
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
