// src/components/ui/ToastContainer.tsx
import { useEffect, useState } from "react";
import { notifyTypeToColor } from "./NotifyColors";
import { subscribeToNotifications } from "../../lib/notify";
import type { NotifyType } from "../../lib/notify";

type Toast = {
  id: number;
  message: string;
  type: NotifyType;
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let counter = 1;

    const unsubscribe = subscribeToNotifications((message, type) => {
      const id = counter++;
      setToasts((prev) => [...prev, { id, message, type }]);

      // Auto-remove after 4 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    });

    return () => unsubscribe();
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center">
      <div className="flex w-full max-w-md flex-col gap-2 px-3">
        {toasts.map((toast) => {
          const color = notifyTypeToColor(toast.type);
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-md border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs shadow-lg`}
            >
              <div className="flex items-start gap-2">
                <div
                  className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${color}`}
                />
                <div className="flex-1 text-slate-100">{toast.message}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
