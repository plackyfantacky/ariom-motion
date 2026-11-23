import { createMotion } from "../dist/ariom-motion.js";

const motion = await createMotion({
    mountElement: document.querySelector("[data-ariom-motion]"),
    dataset: new URL("../src/data/demo-simple.json", import.meta.url),
    editor: {
        enabled: true,
    }
});

motion.on("navigate", (event) => {
    console.log("Navigation requested:", event.params.url, event);
});

window.addEventListener("pagehide", () => {
    motion.destroy();
}, { once: true });