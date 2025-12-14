// main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { setAuthToken } from "./lib/api";

// Restore token on app start
const saved = localStorage.getItem("fildas_token");
if (saved) {
  setAuthToken(saved);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
