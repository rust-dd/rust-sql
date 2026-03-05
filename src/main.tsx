import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress benign ResizeObserver loop warnings (caused by glide-data-grid / Monaco)
const origError = window.onerror;
window.onerror = (msg, ...args) => {
  if (typeof msg === "string" && msg.includes("ResizeObserver loop")) return true;
  return origError ? origError(msg, ...args) : false;
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
