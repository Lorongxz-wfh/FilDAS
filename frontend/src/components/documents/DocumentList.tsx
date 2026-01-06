// src/components/documents/DocumentList.tsx
import { IconButton } from "../ui/IconButton";
import { DropdownMenu } from "../ui/DropdownMenu";
import type { Item, DocumentRow } from "../../types/documents";

type Props = {
  items: Item[];
  isSelected: (item: Item) => boolean;
  formatSize: (bytes: number) => string;
  onClickItem: (item: Item) => void;
  onDoubleClickItem: (item: Item) => void;
  isRoot: boolean;
  onDownload?: (item: Item) => void;
  onRename: (item: Item) => void;
  onCopy?: (item: Item) => void;
  onMove?: (item: Item) => void;
  onDetails?: (item: Item) => void;
  onDelete: (item: Item) => void;
};

export function DocumentList({
  items,
  isSelected,
  formatSize,
  onClickItem,
  onDoubleClickItem,
  isRoot,
  onDownload,
  onRename,
  onCopy,
  onMove,
  onDetails,
  onDelete,
}: Props) {
  return (
    <div className="w-full">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
          <tr>
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Type</th>
            <th className="py-2 pr-4">Size</th>
            <th className="py-2 pr-4">Uploaded at</th>
            <th className="py-2 pr-4" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {items.map((item) => {
            const key = `${item.kind}-${(item.data as any).id}`;
            const selected = isSelected(item);
            const isFile = item.kind === "file";
            const doc =
              item.kind === "file" ? (item.data as DocumentRow) : null;
            const name = isFile
              ? doc!.title || doc!.original_filename
              : (item.data as any).name;

            return (
              <tr
                key={key}
                className={`cursor-pointer hover:bg-slate-800/60 ${
                  selected ? "bg-slate-800/80" : ""
                }`}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest(".dropdown-root"))
                    return;
                  onClickItem(item);
                }}
                onDoubleClick={(e) => {
                  if ((e.target as HTMLElement).closest(".dropdown-root"))
                    return;
                  onDoubleClickItem(item);
                }}
              >
                <td className="py-2 pr-4 text-white">{name}</td>
                <td className="py-2 pr-4 text-slate-400">
                  {item.kind === "department"
                    ? "Department"
                    : item.kind === "folder"
                    ? "Folder"
                    : doc!.mime_type}
                </td>
                <td className="py-2 pr-4 text-slate-400">
                  {isFile ? formatSize(doc!.size_bytes) : ""}
                </td>
                <td className="py-2 pr-4 text-slate-400">
                  {isFile ? new Date(doc!.uploaded_at).toLocaleString() : ""}
                </td>
                <td className="py-2 pr-4 text-right">
                  <DropdownMenu
                    trigger={
                      <div className="dropdown-root inline-flex">
                        <IconButton size="xs" variant="ghost">
                          ⋮
                        </IconButton>
                      </div>
                    }
                  >
                    {/* Departments at root: only Open + Details */}
                    {item.kind === "department" && isRoot ? (
                      <>
                        <DropdownMenu.Item
                          onClick={() => onDoubleClickItem(item)}
                        >
                          Open
                        </DropdownMenu.Item>
                        {onDetails && (
                          <DropdownMenu.Item onClick={() => onDetails(item)}>
                            Details
                          </DropdownMenu.Item>
                        )}
                      </>
                    ) : (
                      <>
                        {item.kind === "folder" && (
                          <DropdownMenu.Item
                            onClick={() => onDoubleClickItem(item)}
                          >
                            Open
                          </DropdownMenu.Item>
                        )}

                        {onDetails && (
                          <DropdownMenu.Item onClick={() => onDetails(item)}>
                            Details
                          </DropdownMenu.Item>
                        )}

                        {isFile && onDownload && (
                          <DropdownMenu.Item onClick={() => onDownload(item)}>
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

                        <DropdownMenu.Item
                          destructive
                          onClick={() => onDelete(item)}
                        >
                          Trash
                        </DropdownMenu.Item>
                      </>
                    )}
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
