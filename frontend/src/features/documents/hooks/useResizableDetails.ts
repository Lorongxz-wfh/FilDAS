// src/features/documents/hooks/useResizableDetails.ts
import { useState } from "react";

export function useResizableDetails(initialWidth = 320) {
  const [detailsWidth, setDetailsWidth] = useState(initialWidth);

  const handleDetailsResizeStart = () => {
    const startX =
      window.event instanceof MouseEvent ? window.event.clientX : 0;
    const startWidth = detailsWidth;

    const onMove = (e: MouseEvent) => {
      const delta = startX - e.clientX;
      const next = Math.min(Math.max(startWidth + delta, 260), 520);
      setDetailsWidth(next);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return { detailsWidth, setDetailsWidth, handleDetailsResizeStart };
}
