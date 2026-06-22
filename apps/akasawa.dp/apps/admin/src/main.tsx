import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// エラーを画面に直接表示するデバッグコード
window.addEventListener("error", (event) => {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <div style="padding: 20px; color: red; background: #fee; border: 1px solid red; border-radius: 8px; margin: 20px;">
        <h3>JavaScript Error Detected</h3>
        <p><b>Message:</b> ${event.message}</p>
        <p><b>File:</b> ${event.filename}:${event.lineno}:${event.colno}</p>
        <pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px; margin-top: 10px;">${event.error?.stack || ""}</pre>
      </div>
    `;
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <div style="padding: 20px; color: red; background: #fee; border: 1px solid red; border-radius: 8px; margin: 20px;">
        <h3>Unhandled Promise Rejection</h3>
        <p><b>Reason:</b> ${event.reason?.message || event.reason}</p>
        <pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px; margin-top: 10px;">${event.reason?.stack || ""}</pre>
      </div>
    `;
  }
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
