// src/lib/notify.ts
export type NotifyType = "info" | "success" | "error";

export function notify(message: string, _type: NotifyType = "info") {
  // Simple wrapper for now: always show a browser alert.
  window.alert(message);
}
