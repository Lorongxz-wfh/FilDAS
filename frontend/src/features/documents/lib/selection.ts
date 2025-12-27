// src/features/documents/lib/selection.ts
import type { Item } from "../../../types/documents";

export function isSelectedItem(
  selectedItem: Item | null,
  kind: Item["kind"],
  id: number
): boolean {
  if (!selectedItem) return false;
  if (selectedItem.kind !== kind) return false;
  return (selectedItem.data as any).id === id;
}
