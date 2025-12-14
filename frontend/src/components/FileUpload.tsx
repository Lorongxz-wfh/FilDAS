// src/components/FileUpload.tsx
import React, { useRef, useState } from "react";
import fileService from "../lib/fileService";

interface FileUploadProps {
  onUploadComplete?: () => void;
  folderId?: number;
}

export default function FileUpload({
  onUploadComplete,
  folderId,
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    uploadFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    uploadFiles(files);
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setUploading(true);
    setError(null);
    setSuccess(false);
    setProgress(0);

    try {
      if (files.length === 1) {
        await fileService.uploadFile(files[0], folderId);
      } else {
        await fileService.uploadMultiple(files, folderId);
      }

      setProgress(100);
      setSuccess(true);
      setUploading(false);

      // Reset after 2 seconds
      setTimeout(() => {
        setSuccess(false);
        setProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = "";
        onUploadComplete?.();
      }, 2000);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Upload failed. Please try again."
      );
      setUploading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
            : "border-neutral-300 dark:border-neutral-700"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
        />

        <div className="space-y-2">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Drag files here or{" "}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-blue-600 hover:underline dark:text-blue-400 disabled:opacity-50"
            >
              click to select
            </button>
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-500">
            PDF, Word, Excel, PowerPoint, Images up to 100MB
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {uploading && (
        <div className="mt-4">
          <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Uploading... {progress}%
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-4 p-3 bg-rose-100 dark:bg-rose-950 border border-rose-300 dark:border-rose-700 rounded text-sm text-rose-800 dark:text-rose-200">
          {error}
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="mt-4 p-3 bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 rounded text-sm text-emerald-800 dark:text-emerald-200">
          ✓ Files uploaded successfully!
        </div>
      )}
    </div>
  );
}
