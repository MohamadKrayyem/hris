import { createRoot } from "react-dom/client";
import App from "./App";

// Mount the App into <div id="root"> from index.html
createRoot(document.getElementById("root")!).render(<App />);
