import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HermesDocumentation } from "./HermesPage";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {window.location.pathname === "/hermes-doc" || window.location.pathname === "/hermes-doc/" ? <HermesDocumentation /> : <App />}
  </StrictMode>
);
