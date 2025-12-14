// src/lib/fileService.ts
import { api } from './api';

export interface UploadResponse {
  success: boolean;
  message: string;
  file?: {
    id: number;
    title: string;
    original_filename: string;
    file_path: string;
    mime_type: string;
    size_bytes: number;
    uploaded_at: string;
  };
}

export interface FileListResponse {
  data: any[];
  current_page: number;
  total: number;
  per_page: number;
  last_page: number;
}

const fileService = {
  // Upload single file
  uploadFile: async (file: File, folderId?: number): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) formData.append('folder_id', folderId.toString());

    return api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Upload multiple files
  uploadMultiple: async (files: File[], folderId?: number): Promise<any> => {
    const formData = new FormData();
    files.forEach(file => formData.append('files[]', file));
    if (folderId) formData.append('folder_id', folderId.toString());

    return api.post('/files/upload-multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Get file list
  getFiles: async (page = 1): Promise<FileListResponse> => {
    return api.get(`/files?page=${page}`);
  },

  // Get files by folder
  getFilesByFolder: async (folderId: number, page = 1): Promise<FileListResponse> => {
    return api.get(`/files/folder/${folderId}?page=${page}`);
  },

  // Search files
  searchFiles: async (query: string, type?: string, folderIds?: number[]): Promise<FileListResponse> => {
    let url = `/files/search?q=${query}`;
    if (type) url += `&type=${type}`;
    if (folderIds?.length) url += `&folders=${folderIds.join(',')}`;
    return api.get(url);
  },

  // Delete file
  deleteFile: async (id: number): Promise<any> => {
    return api.delete(`/files/${id}`);
  },

  // Rename file
  renameFile: async (id: number, title: string): Promise<any> => {
    return api.patch(`/files/${id}/rename`, { title });
  },

  // Download file
  downloadFile: async (id: number): Promise<void> => {
    window.location.href = `/api/files/${id}/download`;
  },
};

export default fileService;
