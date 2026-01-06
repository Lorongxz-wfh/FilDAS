// src/components/documents/SelectionActionsToolbar.tsx
import { Button } from "../ui/Button";
import type { Item } from "../../types/documents";

type Props = {
  selectedItem: Item | null;
  toolbarLabel: string;
  selectedIsFileOrFolder: boolean;
  onDownloadSelected: () => void;
  onRenameSelected: () => void;
  onCopySelected: () => void;
  onMoveSelected: () => void;
  onTrashSelected: () => void;
};

export function SelectionActionsToolbar({
  selectedItem,
  toolbarLabel,
  selectedIsFileOrFolder,
  onDownloadSelected,
  onRenameSelected,
  onCopySelected,
  onMoveSelected,
  onTrashSelected,
}: Props) {
  return (
    <div className="mb-2.5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      {/* LEFT: uploads placeholder kept in parent; this is only the RIGHT block in DM page */}
      <div className="flex flex-wrap items-center gap-2 text-xs md:ml-auto">
        <span className="mr-2 text-slate-500">{toolbarLabel}</span>
        {selectedIsFileOrFolder && selectedItem && (
          <>
            <Button size="xs" onClick={onDownloadSelected}>
              Download
            </Button>

            <Button size="xs" onClick={onRenameSelected}>
              Rename
            </Button>

            <Button size="xs" onClick={onCopySelected}>
              Copy
            </Button>

            <Button size="xs" onClick={onMoveSelected}>
              Move
            </Button>

            <Button size="xs" onClick={onTrashSelected}>
              Trash
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
