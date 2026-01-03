// src/components/documents/DocumentGrid.tsx
import { Card } from "../ui/Card";
import { IconButton } from "../ui/IconButton";
import { DropdownMenu } from "../ui/DropdownMenu";
import type { Item, DocumentRow } from "../../types/documents";

type Props = {
  items: Item[];
  isSelected: (item: Item) => boolean;
  formatSize: (bytes: number) => string;
  onClickItem: (item: Item) => void;
  onDoubleClickItem: (item: Item) => void;
  onDownload?: (item: Item) => void;
  onDownloadFolder?: (item: Item) => void;
  onRename: (item: Item) => void;
  onCopy?: (item: Item) => void;
  onMove?: (item: Item) => void;
  onDelete: (item: Item) => void;
  onDetails?: (item: Item) => void;
};

export function DocumentGrid({
  items,
  isSelected,
  formatSize,
  onClickItem,
  onDoubleClickItem,
  onDownload,
  onDownloadFolder,
  onRename,
  onCopy,
  onMove,
  onDelete,
  onDetails,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((item) => {
        const key = `${item.kind}-${(item.data as any).id}`;
        const selected = isSelected(item);
        const name =
          item.kind === "file"
            ? (item.data as DocumentRow).title ||
              (item.data as DocumentRow).original_filename
            : (item.data as any).name;

        return (
          <Card
            key={key}
            selectable
            selected={selected}
            className="group cursor-pointer"
            onClick={() => {
              onClickItem(item);
            }}
            onDoubleClick={() => {
              onDoubleClickItem(item);
            }}
          >
            <div className="relative flex h-full flex-col">
              {/* Kebab menu */}
              <DropdownMenu
                trigger={
                  <IconButton
                    className="dropdown-root absolute right-1 top-1"
                    size="xs"
                    variant="ghost"
                  >
                    ⋮
                  </IconButton>
                }
              >
                {onDetails && (
                  <DropdownMenu.Item onClick={() => onDetails(item)}>
                    Details
                  </DropdownMenu.Item>
                )}

                {item.kind === "file" && onDownload && (
                  <DropdownMenu.Item onClick={() => onDownload(item)}>
                    Download
                  </DropdownMenu.Item>
                )}

                {item.kind === "folder" && onDownloadFolder && (
                  <DropdownMenu.Item onClick={() => onDownloadFolder(item)}>
                    Download
                  </DropdownMenu.Item>
                )}

                <DropdownMenu.Item onClick={() => onRename(item)}>
                  Rename
                </DropdownMenu.Item>

                {onCopy && (
                  <DropdownMenu.Item onClick={() => onCopy(item)}>
                    Copy
                  </DropdownMenu.Item>
                )}

                {onMove && (
                  <DropdownMenu.Item onClick={() => onMove(item)}>
                    Move
                  </DropdownMenu.Item>
                )}

                <DropdownMenu.Item destructive onClick={() => onDelete(item)}>
                  Archive
                </DropdownMenu.Item>
              </DropdownMenu>

              {/* Icon + name + meta */}
              <div className="mb-6 text-[40px]">
                {item.kind === "department" ? (
                  <span>🏛️</span>
                ) : item.kind === "folder" ? (
                  <span>📁</span>
                ) : (
                  <span>📄</span>
                )}
              </div>

              <p className="truncate text-slate-100">{name}</p>
              <p className="text-[10px] text-slate-500">
                {item.kind === "file"
                  ? formatSize((item.data as DocumentRow).size_bytes)
                  : item.kind === "folder"
                  ? "Folder"
                  : "Department"}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
