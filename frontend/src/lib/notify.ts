// src/lib/notify.ts
export type NotifyType = "info" | "success" | "error";

type NotifyListener = (message: string, type: NotifyType) => void;

let listeners: NotifyListener[] = [];

// Called by the UI toast component to subscribe
export function subscribeToNotifications(listener: NotifyListener) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

// Called from anywhere in the app to show a toast
export function notify(message: string, type: NotifyType = "info") {
  for (const listener of listeners) {
    listener(message, type);
  }
}
