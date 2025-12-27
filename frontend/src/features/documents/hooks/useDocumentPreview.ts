// src/features/documents/hooks/useDocumentPreview.ts
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import type { DocumentRow, DocumentPreview, Item } from "../../../types/documents";

type UseDocumentPreviewParams = {
  detailsOpen: boolean;
  selectedItem: Item | null;
};

export function useDocumentPreview({ detailsOpen, selectedItem }: UseDocumentPreviewParams) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const getPreviewUrlFromApi = async (docId: number) => {
    const res = await api.get<DocumentPreview>(`/documents/${docId}/preview`);
    return res.data.stream_url;
  };

  useEffect(() => {
    const loadPreview = async () => {
      if (!detailsOpen || !selectedItem || selectedItem.kind !== "file") {
        setPreviewUrl(null);
        setPreviewLoading(false);
        return;
      }

      const doc = selectedItem.data as DocumentRow;
      const mime = doc.mime_type || "";

      if (
        !mime.startsWith("image/") &&
        mime !== "application/pdf" &&
        mime !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
        mime !== "application/msword" &&
        mime !== "application/vnd.openxmlformats-officedocument.presentationml.presentation" &&
        mime !== "application/vnd.ms-powerpoint"
      ) {
        setPreviewUrl(null);
        setPreviewLoading(false);
        return;
      }

      setPreviewLoading(true);

      try {
        const url = await getPreviewUrlFromApi(doc.id);
        setPreviewUrl(url);
      } catch (e) {
        console.error("Failed to load preview URL", e);
        setPreviewUrl(null);
      } finally {
        setPreviewLoading(false);
      }
    };

    loadPreview();
  }, [detailsOpen, selectedItem]);

  return { previewUrl, previewLoading };
}
