import { createArrowCloudEditor } from "./createArrowCloudEditor.js";
import { createEditorViewport } from "./camera/createEditorViewport.js";

export function attachArrowCloudEditor(runtime, options = {}) {
    const viewport = createEditorViewport(runtime.camera, runtime.cameraOrbit, runtime.renderer);

    const sceneOrbitWasEnabled = runtime.cameraOrbit.getControls().enabled;

    runtime.cameraOrbit.setEnabled(false);
    runtime.setViewportCamera(viewport.camera);

    const editor = createArrowCloudEditor({
        playback: runtime.playback,
        camera: viewport.camera,
        cameraOrbit: viewport.cameraOrbit,

        sceneCamera: runtime.camera,
        renderer: runtime.renderer,
        mountElement: runtime.mountElement,
        scene: runtime.scene,
        arrowPaths: runtime.getArrowPaths(),

        initialCameraView: options.cameraView,
        initialCameraDistance: options.cameraDistance,
        initialCameraTarget: options.cameraTarget,

        getRenderedArrowItems: runtime.getRenderedArrowItems,
        getArrows: runtime.getArrows,

        hasInitialCameraState: options.hasInitialCameraState,

        onArrowPathsChange: runtime.setArrowPaths,
        onDatasetChange: options.onDatasetChange,
        domElements: options.domElements,

        onUIVisibilityChange(isVisible) {
            runtime.setInteractionsEnabled(!isVisible);
        },

        getSceneCameraTarget() {
            return runtime.cameraOrbit.getControls().target;
        },

        isSceneCameraLocked() {
            return runtime.cameraOrbit.isLocked();
        },

        onSceneCameraEditingChange(isEditing) {
            runtime.setCameraAnimationEnabled(!isEditing);
        },

        onScenePreviewChange(isPreviewing) {
            runtime.cameraOrbit.setEnabled(isPreviewing);
        },
    });

    const unsubscribeFrame = runtime.onFrame((frame) => {
        editor.update(frame);
        viewport.update();
    });

    const unsubscribePaths = runtime.onPathsRebuilt(() => {
        editor.syncRenderedArrowItems();
    });

    const unsubscribeRender = runtime.onBeforeRender(() => {
        if (!editor.isCameraOverridden()) {
            viewport.followScene();
        }

        return editor.prepareRender();
    });

    editor.syncRenderedArrowItems();

    let isDestroyed = false;

    function destroy() {
        if (isDestroyed) {
            return;
        }

        isDestroyed = true;

        unsubscribeFrame();
        unsubscribePaths();
        unsubscribeRender();

        editor.destroy();
        viewport.destroy();
        runtime.setViewportCamera(null);
        runtime.cameraOrbit.setEnabled(sceneOrbitWasEnabled);
        runtime.setInteractionsEnabled(true);
        runtime.setCameraAnimationEnabled(true);
    }

    return {
        destroy,
    };
}
