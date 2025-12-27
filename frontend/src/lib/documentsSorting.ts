// src/features/documents/lib/documentsSorting.ts
import type {
  Department,
  DocumentRow,
  FolderRow,
  Item,
  SortMode,
} from "../types/documents";

export function applySort(items: Item[], sortMode: SortMode): Item[] {
  const alphaSort = (a: Item, b: Item) => {
    const nameA =
      a.kind === "file"
        ? (a.data as DocumentRow).title ||
          (a.data as DocumentRow).original_filename
        : (a.data as any).name;
    const nameB =
      b.kind === "file"
        ? (b.data as DocumentRow).title ||
          (b.data as DocumentRow).original_filename
        : (b.data as any).name;
    return nameA.localeCompare(nameB);
  };

  if (sortMode === "alpha") return [...items].sort(alphaSort);

  if (sortMode === "uploaded_at") {
    const foldersOnly = items.filter((i) => i.kind === "folder");
    const filesOnly = items
      .filter((i) => i.kind === "file")
      .sort(
        (a, b) =>
          new Date((b.data as DocumentRow).uploaded_at).getTime() -
          new Date((a.data as DocumentRow).uploaded_at).getTime()
      );
    return [...foldersOnly, ...filesOnly];
  }

  if (sortMode === "recent") {
    return [...items].sort((a, b) => {
      const getOpened = (item: Item) => {
        if (item.kind === "file") {
          return (item.data as DocumentRow).last_opened_at;
        }
        if (item.kind === "folder") {
          return (item.data as FolderRow).last_opened_at;
        }
        return (item.data as Department).last_opened_at;
      };
      const aTime = getOpened(a)
        ? new Date(getOpened(a) as string).getTime()
        : 0;
      const bTime = getOpened(b)
        ? new Date(getOpened(b) as string).getTime()
        : 0;
      return bTime - aTime;
    });
  }

  if (sortMode === "size") {
    const foldersOnly = items.filter((i) => i.kind === "folder");
    const filesOnly = items
      .filter((i) => i.kind === "file")
      .sort(
        (a, b) =>
          (b.data as DocumentRow).size_bytes -
          (a.data as DocumentRow).size_bytes
      );
    return [...foldersOnly, ...filesOnly];
  }

  return items;
}

export function computeVisibleItems(params: {
  currentDepartment: Department | null;
  currentFolder: FolderRow | null;
  departments: Department[];
  folders: FolderRow[];
  documents: DocumentRow[];
  sortMode: SortMode;
  searchQuery: string;
  isSuperAdmin: boolean;
}): Item[] {
  const {
    currentDepartment,
    currentFolder,
    departments,
    folders,
    documents,
    sortMode,
    searchQuery,
    isSuperAdmin,
  } = params;

  if (!currentDepartment) {
    if (!isSuperAdmin) {
      return [];
    }

    let list = departments.map<Item>((d) => ({
      kind: "department",
      data: d,
    }));
    if (sortMode === "alpha") {
      list = list.sort((a, b) =>
        (a.data as Department).name.localeCompare(
          (b.data as Department).name
        )
      );
    }
    return list;
  }

  const directFolders = folders.filter(
    (f) =>
      f.department_id === currentDepartment.id &&
      f.parent_id === (currentFolder ? currentFolder.id : null)
  );
  const directFiles = documents.filter(
    (d) =>
      d.department_id === currentDepartment.id &&
      (currentFolder ? d.folder_id === currentFolder.id : !d.folder_id)
  );

  let items: Item[] = [
    ...directFolders.map<Item>((f) => ({ kind: "folder", data: f })),
    ...directFiles.map<Item>((d) => ({ kind: "file", data: d })),
  ];

  items = items.filter((item, index, self) => {
    const id = (item.data as any).id;
    const key = `${item.kind}-${id}`;
    return (
      index ===
      self.findIndex((other) => {
        const otherId = (other.data as any).id;
        return `${other.kind}-${otherId}` === key;
      })
    );
  });

  const q = searchQuery.trim().toLowerCase();
  if (!q) return applySort(items, sortMode);

  const allDeptFolders = folders.filter(
    (f) => f.department_id === currentDepartment.id
  );
  const allDeptFiles = documents.filter(
    (d) => d.department_id === currentDepartment.id
  );

  let globalItems: Item[] = [
    ...allDeptFolders.map<Item>((f) => ({ kind: "folder", data: f })),
    ...allDeptFiles.map<Item>((d) => ({ kind: "file", data: d })),
  ];

  globalItems = globalItems.filter((item) => {
    if (item.kind === "file") {
      const d = item.data as DocumentRow;
      const name = (d.title || d.original_filename || "").toLowerCase();
      return name.includes(q);
    }
    const name = (item.data as any).name.toLowerCase();
    return name.includes(q);
  });

  globalItems = globalItems.filter((item, index, self) => {
    const id = (item.data as any).id;
    const key = `${item.kind}-${id}`;
    return (
      index ===
      self.findIndex((other) => {
        const otherId = (other.data as any).id;
        return `${other.kind}-${otherId}` === key;
      })
    );
  });

  return applySort(globalItems, sortMode);
}
