import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const stored = localStorage.getItem("monopoly-theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const theme =
  stored === "light" || stored === "dark"
    ? stored
    : prefersDark
      ? "dark"
      : "light";
document.documentElement.classList.toggle("dark", theme === "dark");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
