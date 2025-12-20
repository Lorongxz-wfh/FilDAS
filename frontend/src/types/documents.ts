// src/types/documents.ts

export type DocumentRow = {
  id: number;
  title: string | null;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
  last_opened_at?: string | null;

  folder_id: number | null;
  department_id: number;

  // Extra metadata (optional, used by Shared Files and some views)
  folder_name?: string | null;
  department_name?: string | null;
  owner_id?: number | null;
  owner_name?: string | null;
  share_permission?: "viewer" | "editor" | string;
};

export type FolderRow = {
  id: number;
  name: string;
  parent_id: number | null;
  department_id: number | null;
  last_opened_at?: string | null;
};

export type DocumentPreview = DocumentRow & {
  stream_url: string;
};

export type Department = {
  id: number;
  name: string;
  last_opened_at?: string | null;
};

export type ViewMode = "grid" | "list";

export type SortMode = "alpha" | "recent" | "size" | "uploaded_at";

export type Item =
  | { kind: "department"; data: Department }
  | { kind: "folder"; data: FolderRow }
  | { kind: "file"; data: DocumentRow };
