import { attachArrowCloudEditor } from "./attachArrowCloudEditor.js";
import { readEditorUrlOptions, selectEditorDataset } from "./editorUrlOptions.js";

export function prepareAuthoring(options = {}) {
    if (!options.enabled) {
        return null;
    }

    const urlOptions = readEditorUrlOptions(null);

    return {
        datasetSource: urlOptions.datasetName ? `./src/data/${urlOptions.datasetName}.json` : null,

        attach(runtime, dataset) {
            const stylesheet = document.createElement("link");

            stylesheet.rel = "stylesheet";
            stylesheet.href = new URL("./ariom-motion.css", import.meta.url).href;

            document.head.appendChild(stylesheet);

            let attachment;

            try {
                attachment = attachArrowCloudEditor(runtime, {
                    cameraView: urlOptions.cameraView,
                    cameraDistance: urlOptions.cameraDistance,
                    cameraTarget: dataset.staticCamera?.target,
                    hasInitialCameraState: Boolean(dataset.staticCamera),
                    onDatasetChange: selectEditorDataset,
                });
            } catch (error) {
                stylesheet.remove();
                throw error;
            }

            return {
                destroy() {
                    attachment.destroy();
                    stylesheet.remove();
                },
            };
        },
    };
}
