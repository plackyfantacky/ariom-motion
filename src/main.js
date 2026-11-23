import { createScene } from "./scene/createScene.js";
import { loadDataset } from "./data/loadDataset.js";
import { prepareAuthoring } from "@ariom-motion/authoring";

export async function createMotion({
    /* prettier-ignore */
    mountElement,
    dataset: datasetSource,
    editor = {},
} = {}) {
    if (!mountElement) {
        throw new TypeError("createMotion requires a mount element.");
    }

    const authoring = prepareAuthoring(editor);

    const dataset = await loadDataset(authoring?.datasetSource ?? datasetSource);

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
