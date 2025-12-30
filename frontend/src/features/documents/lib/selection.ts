// src/features/documents/lib/selection.ts
import type { Item } from "../../../types/documents";
import type { DocumentRow, SharedFolder } from "../hooks/useSharedFiles";

type SharePermission = "viewer" | "contributor" | "editor";

export function canModifySharedFolder(
  folder: SharedFolder,
  userId: number,
  isAdmin: boolean
): boolean {
  const perm = folder.permission as SharePermission | null;
  const isOwner =
    folder.owner_id != null && Number(folder.owner_id) === Number(userId);
  const isEditor = perm === "editor" || isAdmin;
  const isContributor = perm === "contributor";

  return isEditor || (isContributor && isOwner);
}

export function canModifySharedFile(
  doc: DocumentRow,
  userId: number,
  isAdmin: boolean
): boolean {
  const perm = doc.share_permission as SharePermission | null;
  const isOwner =
    doc.owner_id != null && Number(doc.owner_id) === Number(userId);
  const isEditor = perm === "editor" || isAdmin;
  const isContributor = perm === "contributor";

  return isEditor || (isContributor && isOwner);
}


export function isSelectedItem(
  selectedItem: Item | null,
  kind: Item["kind"],
  id: number
): boolean {
  if (!selectedItem) return false;
  if (selectedItem.kind !== kind) return false;
  return (selectedItem.data as any).id === id;
}
