// src/components/documents/RenameModal.tsx
import Modal from "../Modal";

type Props = {
  open: boolean;
  renaming: boolean;
  renameError: string | null;
  renameName: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onChangeName: (value: string) => void;
};

export function RenameModal({
  open,
  renaming,
  renameError,
  renameName,
  onClose,
  onSubmit,
  onChangeName,
}: Props) {
  return (
    <Modal open={open} title="Rename" onClose={onClose}>
      <form className="space-y-3 text-sm" onSubmit={onSubmit}>
        {renameError && (
          <p className="rounded border border-rose-900 bg-rose-950/40 px-2 py-1 text-xs text-rose-400">
            {renameError}
          </p>
        )}

        <div>
          <label className="mb-1 block text-xs text-slate-400">New name</label>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            value={renameName}
            onChange={(e) => onChangeName(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            className="rounded-md border border-slate-700 px-3 py-2 text-xs text-white hover:bg-slate-800"
            onClick={onClose}
            disabled={renaming}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-60"
            disabled={renaming}
          >
            {renaming ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
