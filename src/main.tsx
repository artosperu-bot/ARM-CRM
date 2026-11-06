import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./styles.real.css";

const root = document.getElementById("root");
if (!root) throw new Error("Falta el elemento #root");
createRoot(root).render(<React.StrictMode><App /></React.StrictMode>);
