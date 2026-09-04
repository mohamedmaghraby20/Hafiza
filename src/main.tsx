import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@app/App";
import { LocalHafizaApplication } from "@app/bootstrap/LocalHafizaApplication";
import "@app/styles.css";
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Hafiza root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App application={new LocalHafizaApplication()} />
  </StrictMode>,
);
