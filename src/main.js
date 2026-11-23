import { createScene } from "./scene/createScene.js";
import { loadArrowDataset } from "./data/loadDataset.js";

import { prepareAuthoring } from "@ariom-motion/authoring";

/* prettier-ignore */
export async function createMotion({
    mountElement = document.querySelector("[data-ariom-motion]") || document.body,
    dataset: providedDataset = null,
} = {}) {

    const defaultDatasetName = "demo-simple";
    const authoring = prepareAuthoring(defaultDatasetName);
    const datasetName = authoring?.datasetName ?? defaultDatasetName;

    const dataset = providedDataset ?? await loadArrowDataset(datasetName);

    const runtime = createScene(mountElement, {
        dataset,
    });

   let editorAttachment = null;

    try {
        editorAttachment = authoring?.attach(runtime, dataset) ?? null;
    } catch (error) {
        runtime.destroy();
        throw error;
    }

    let destroyed = false;

    function destroy() {
        if (destroyed) {
            return;
        }

        destroyed = true;

        try {
            editorAttachment?.destroy();
        } finally {
            runtime.destroy();
        }
    }

    return {
        ...runtime,
        destroy,
    };
}
