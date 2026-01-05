// src/components/documents/ViewSortSearchBar.tsx
import { Button } from "../ui/Button";
import type { SortMode, ViewMode } from "../../types/documents";

type Props = {
  viewMode: ViewMode;
  sortMode: SortMode;
  searchQuery: string;
  onChangeViewMode: (mode: ViewMode) => void;
  onChangeSortMode: (mode: SortMode) => void;
  onChangeSearchQuery: (value: string) => void;
  onToggleDetails: () => void;
};

export function ViewSortSearchBar({
  viewMode,
  sortMode,
  searchQuery,
  onChangeViewMode,
  onChangeSortMode,
  onChangeSearchQuery,
  onToggleDetails,
}: Props) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-md border border-slate-700 bg-slate-900">
          <Button
            size="xs"
            variant={viewMode === "grid" ? "primary" : "ghost"}
            className="rounded-none"
            onClick={() => onChangeViewMode("grid")}
          >
            Grid
          </Button>
          <Button
            size="xs"
            variant={viewMode === "list" ? "primary" : "ghost"}
            className="rounded-none"
            onClick={() => onChangeViewMode("list")}
          >
            List
          </Button>
        </div>

        <select
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
          value={sortMode}
          onChange={(e) => onChangeSortMode(e.target.value as SortMode)}
        >
          <option value="alpha">Alphabetical</option>
          <option value="recent">Recently opened</option>
          <option value="uploaded_at">Uploaded date</option>
          <option value="size">File size</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search name..."
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
          value={searchQuery}
          onChange={(e) => onChangeSearchQuery(e.target.value)}
        />
        <Button size="xs" variant="secondary" onClick={onToggleDetails}>
          Details
        </Button>
      </div>
    </div>
  );
}
