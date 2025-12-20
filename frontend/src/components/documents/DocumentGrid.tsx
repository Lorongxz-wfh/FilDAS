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
  onRename: (item: Item) => void;
  onDelete: (item: Item) => void;
};

export function DocumentGrid({
  items,
  isSelected,
  formatSize,
  onClickItem,
  onDoubleClickItem,
  onRename,
  onDelete,
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
            onClick={(e) => {
              // ignore clicks inside dropdown
              if ((e.target as HTMLElement).closest(".dropdown-root")) return;
              onClickItem(item);
            }}
            onDoubleClick={(e) => {
              if ((e.target as HTMLElement).closest(".dropdown-root")) return;
              onDoubleClickItem(item);
            }}
          >
            <div className="relative flex h-full flex-col">
              {/* Kebab menu */}
              <DropdownMenu
                trigger={
                  <div className="dropdown-root absolute right-1 top-1 hidden group-hover:flex">
                    <IconButton
                      size="xs"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      ⋮
                    </IconButton>
                  </div>
                }
              >
                <DropdownMenu.Item
                  onClick={() => {
                    onRename(item);
                  }}
                >
                  Rename
                </DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => {}}>
                  Move (placeholder)
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  destructive
                  onClick={() => {
                    onDelete(item);
                  }}
                >
                  Delete
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
