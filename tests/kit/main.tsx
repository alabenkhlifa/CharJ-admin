// Entry of the dev-only kit fixture (tests/kit/index.html), served by `vite`.
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "../../src/index.css";
import { KitPage } from "./kit-page";

createRoot(document.getElementById("root")!).render(<KitPage />);
