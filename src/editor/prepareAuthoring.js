import { editorConfig } from "./editorConfig.js";
import { attachArrowCloudEditor } from "./attachArrowCloudEditor.js";
import { readEditorUrlOptions, selectEditorDataset } from "./editorUrlOptions.js";

export function prepareAuthoring(defaultDatasetName) {
    if (!editorConfig.enabled) {
        return null;
    }

    const urlOptions = readEditorUrlOptions(defaultDatasetName);

    return {
        datasetName: urlOptions.datasetName,

        attach(runtime, dataset) {
            const stylesheet = document.createElement("link");

            stylesheet.rel = "stylesheet";
            stylesheet.href = new URL("./main.css", import.meta.url).href;

            document.head.appendChild(stylesheet);

            let attachment;

            try {
                attachment = attachArrowCloudEditor(runtime, {
                    cameraView: urlOptions.cameraView,
                    cameraDistance: urlOptions.cameraDistance,
                    cameraTarget: dataset.staticCamera?.target,
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
