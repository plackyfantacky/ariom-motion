import { createMotion } from "../dist/ariom-motion.js";

const motion = await createMotion({
    mountElement: document.querySelector("[data-ariom-motion]"),
    dataset: new URL("../examples/demo-simple.json", import.meta.url),
    editor: {
        enabled: false,
    },
});

motion.on("navigate", (event) => {
    console.log("Navigation requested:", event.params.url, event);
});

const playButton = document.querySelector("#demo-play-button");

function handlePlayClick() {
    motion.emit("demo:play");
}

playButton.addEventListener("click", handlePlayClick);

/* prettier-ignore */
window.addEventListener("pagehide", () => {
    playButton.removeEventListener("click", handlePlayClick);
    motion.destroy();
}, { once: true });
