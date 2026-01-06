// src/types/documents.ts

export type Tag = {
  id: number;
  name: string;
  color?: string | null;
};

export type DocumentRow = {
  id: number;
  title: string | null;
  description?: string | null;  // NEW
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  file_path?: string;  // NEW
  preview_path?: string | null;  // NEW
  uploaded_at: string;
  last_opened_at?: string | null;
  created_at?: string;  // NEW
  updated_at?: string;  // NEW
  deleted_at?: string | null;  // NEW

  folder_id: number | null;
  department_id: number;
  document_type_id?: number | null;  // NEW
  uploaded_by?: number;  // NEW
  owner_id?: number | null;
  original_owner_id?: number | null;  // NEW

  // Extra metadata (optional, used by Shared Files and some views)
  folder_name?: string | null;
  department_name?: string | null;
  owner_name?: string | null;
  share_permission?: "viewer" | "editor" | string;

  // Relationships (when loaded with ->load())
  folder?: FolderRow;
  uploadedBy?: { id: number; name: string; email: string };  // NEW
  owner?: { id: number; name: string; email: string };  // NEW
  department?: { id: number; name: string };  // NEW

  // New metadata
  school_year?: string | null;
  tags?: Tag[];
};

export type FolderRow = {
  id: number;
  name: string;
  description?: string | null;  // NEW
  parent_id: number | null;
  department_id: number | null;
  owner_id?: number;  // NEW
  original_owner_id?: number | null;  // NEW
  last_opened_at?: string | null;
  created_at?: string;  // NEW
  updated_at?: string;  // NEW
  deleted_at?: string | null;  // NEW

  // Relationships (when loaded)
  owner?: { id: number; name: string; email: string };  // NEW
  department?: { id: number; name: string };  // NEW
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
