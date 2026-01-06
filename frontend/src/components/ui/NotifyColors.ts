// src/components/ui/notifyColors.ts
import type { NotifyType } from "../../lib/notify";

export function notifyTypeToColor(type: NotifyType): string {
  switch (type) {
    case "success":
      return "bg-emerald-400";
    case "error":
      return "bg-rose-400";
    case "info":
    default:
      return "bg-sky-400";
  }
}
