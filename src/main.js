import { createScene } from "./scene/createScene.js";
import { loadArrowDataset } from "./data/loadDataset.js";

import { prepareAuthoring } from "@ariom-motion/authoring";

/* prettier-ignore */
export async function createMotion({
    mountElement = document.querySelector("[data-ariom-motion]") || document.body,
    dataset: providedDataset = null,
} = {}) {

    const defaultDatasetName = "demo";
    const authoring = prepareAuthoring(defaultDatasetName);
    const datasetName = authoring?.datasetName ?? defaultDatasetName;

    const dataset = await loadArrowDataset(datasetName);

    const runtime = createScene(mountElement, {
        dataset,
    });

    const unsubscribeNavigate = runtime.on("navigate", (event) => {
        console.log("Navigation requested:", event.params.url, event);
    });

    const editorAttachment = authoring?.attach(runtime, dataset) ?? null;

    window.addEventListener(
        "pagehide",
        () => {
            editorAttachment?.destroy();
            unsubscribeNavigate();
            runtime.destroy();
        },
        { once: true },
    );
}
