import cameraControlsTemplate from "./cameraControls.html";

import { createPanelToggle } from "../editorUI";

export function createCameraControls({
    initialExpanded = true,
    onPanelExpandedChange = () => {},
    getCameraMode = () => "orbital",
    getCameraView = () => null,
    cameraZoomEnabled = false,
    onCameraZoomChange = () => {},
    getCameraLocked = () => false,
    onCameraModeChange = () => {},
    onCameraViewChange = () => {},
    onResetCamera = () => {},
    onCopySceneCamera = () => {},
    onCopyCurrentViewport = () => {},
    onCameraTargetVisibilityChange = () => {},
    onCameraUpVisibilityChange = () => {},
    container = document.body,
    cameraTargetVisible = true,
    cameraUpVisible = true,
    onCameraFrustumVisibilityChange = () => {},
    cameraFrustumVisible = false,
} = {}) {
    const template = document.createElement("template");
    template.innerHTML = cameraControlsTemplate;

    const controlsContainer = template.content.firstElementChild.cloneNode(true);

    const toggleButton = controlsContainer.querySelector('[data-action="toggle"]');
    const content = controlsContainer.querySelector("[data-content]");

    const panelToggle = createPanelToggle({
        button: toggleButton,
        content,
        label: "Camera",
        initialExpanded,
        onExpandedChange: onPanelExpandedChange,
    });

    /* selectors */

    const cameraModeButtons = [...controlsContainer.querySelectorAll("[data-camera-mode]")];
    const cameraViewButtons = [...controlsContainer.querySelectorAll("[data-camera-view]")];
    const resetCameraButton = controlsContainer.querySelector('[data-action="reset-camera"]');
    const copySceneCameraButton = controlsContainer.querySelector('[data-action="copy-scene-camera"]');
    const copyCurrentViewportButton = controlsContainer.querySelector('[data-action="copy-current-viewport"]');
    const cameraTargetVisibilityInput = controlsContainer.querySelector("[data-camera-target-visible]");
    const cameraUpVisibilityInput = controlsContainer.querySelector("[data-camera-up-visible]");
    const cameraFrustumVisibilityInput = controlsContainer.querySelector("[data-camera-frustum-visible]");

    const orbitalOptions = controlsContainer.querySelector("[data-camera-orbital-options]");
    const zoomEnabledInput = controlsContainer.querySelector("[data-camera-zoom-enabled]");
    const lockNotice = controlsContainer.querySelector("[data-camera-lock-notice]");

    /* listeners */

    cameraModeButtons.forEach((button) => {
        button.addEventListener("click", () => {
            onCameraModeChange(button.dataset.cameraMode);

            updateCameraModeButtons();
        });
    });

    cameraViewButtons.forEach((button) => {
        button.addEventListener("click", () => {
            onCameraViewChange(button.dataset.cameraView);

            updateCameraModeButtons();
            updateCameraViewButtons();
        });
    });

    zoomEnabledInput.addEventListener("change", handleZoomChange);

    resetCameraButton.addEventListener("click", onResetCamera);
    copySceneCameraButton.addEventListener("click", onCopySceneCamera);
    copyCurrentViewportButton.addEventListener("click", onCopyCurrentViewport);

    cameraTargetVisibilityInput.addEventListener("change", () => {
        onCameraTargetVisibilityChange(cameraTargetVisibilityInput.checked);
    });

    cameraUpVisibilityInput.addEventListener("change", () => {
        onCameraUpVisibilityChange(cameraUpVisibilityInput.checked);
    });

    cameraFrustumVisibilityInput.addEventListener("change", () => {
        onCameraFrustumVisibilityChange(cameraFrustumVisibilityInput.checked);
    });

    /* handlers/helpers */

    function updateCameraModeButtons() {
        const cameraMode = getCameraMode();
        orbitalOptions.hidden = cameraMode !== "orbital";

        cameraModeButtons.forEach((button) => {
            button.disabled = button.dataset.cameraMode === cameraMode;
        });
    }

    function updateCameraViewButtons() {
        const cameraView = getCameraView();

        cameraViewButtons.forEach((button) => {
            button.disabled = button.dataset.cameraView === cameraView;
        });
    }

    function handleZoomChange() {
        onCameraZoomChange(zoomEnabledInput.checked);
    }

    function updateCameraLock() {
        const isLocked = getCameraLocked();

        lockNotice.hidden = getCameraMode() !== "orbital" || !isLocked;
        zoomEnabledInput.disabled = isLocked;
    }



    /* runtime defaults */
    zoomEnabledInput.checked = cameraZoomEnabled;

    updateCameraModeButtons();
    updateCameraViewButtons();
    updateCameraLock();

    cameraTargetVisibilityInput.checked = cameraTargetVisible;
    cameraUpVisibilityInput.checked = cameraUpVisible;
    cameraFrustumVisibilityInput.checked = cameraFrustumVisible;

    container.appendChild(controlsContainer);

    return {
        updateCameraModeButtons,
        updateCameraViewButtons,
        updateCameraLock,

        destroy() {
            zoomEnabledInput.removeEventListener("change", handleZoomChange);
            controlsContainer.remove();
            panelToggle.destroy();
        },
    };
}