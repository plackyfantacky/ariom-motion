import cameraControlsTemplate from "./cameraControls.html";

import { createPanelToggle } from "../editorUI";

export function createCameraControls({
    cameraTargetVisible = true,
    cameraUpVisible = true,
    cameraZoomEnabled = false,
    container = document.body,
    domVisible = true,
    getCameraLocked = () => false,
    getCameraMode = () => "orbital",
    getCameraView = () => null,
    initialExpanded = true,
    onCameraEditingChange = () => {},
    onCameraEditTargetChange = () => {},
    onCameraModeChange = () => {},
    onCameraTargetVisibilityChange = () => {},
    onCameraTransformModeChange = () => {},
    onCameraUpVisibilityChange = () => {},
    onCameraViewChange = () => {},
    onCameraZoomChange = () => {},
    onCopyCurrentViewport = () => {},
    onCopySceneCamera = () => {},
    onDomVisibilityChange = () => {},
    onPanelExpandedChange = () => {},
    onResetCamera = () => {},
    onSceneCameraVisibilityChange = () => {},
    sceneCameraVisible = true,
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

    const cameraEditingInput = controlsContainer.querySelector("[data-camera-editing]");
    const cameraEditTargetInputs = [...controlsContainer.querySelectorAll("[data-camera-edit-target]")];
    const cameraModeButtons = [...controlsContainer.querySelectorAll("[data-camera-mode]")];
    const cameraTargetVisibilityInput = controlsContainer.querySelector("[data-camera-target-visible]");
    const cameraTransformModeButtons = [...controlsContainer.querySelectorAll("[data-camera-transform-mode]")];
    const cameraUpVisibilityInput = controlsContainer.querySelector("[data-camera-up-visible]");
    const cameraViewButtons = [...controlsContainer.querySelectorAll("[data-camera-view]")];
    const copyCurrentViewportButton = controlsContainer.querySelector('[data-action="copy-current-viewport"]');
    const copySceneCameraButton = controlsContainer.querySelector('[data-action="copy-scene-camera"]');
    const domVisibilityInput = controlsContainer.querySelector("[data-dom-visible]");
    const lockNotice = controlsContainer.querySelector("[data-camera-lock-notice]");
    const orbitalOptions = controlsContainer.querySelector("[data-camera-orbital-options]");
    const resetCameraButton = controlsContainer.querySelector('[data-action="reset-camera"]');
    const sceneCameraVisibilityInput = controlsContainer.querySelector("[data-scene-camera-visible]");
    const zoomEnabledInput = controlsContainer.querySelector("[data-camera-zoom-enabled]");

    /* listeners */

    cameraEditTargetInputs.forEach((input) => {
        input.addEventListener("change", handleCameraEditTargetChange);
    });

    cameraModeButtons.forEach((button) => {
        button.addEventListener("click", () => {
            onCameraModeChange(button.dataset.cameraMode);

            updateCameraModeButtons();
        });
    });

    cameraTargetVisibilityInput.addEventListener("change", () => {
        onCameraTargetVisibilityChange(cameraTargetVisibilityInput.checked);
    });

    cameraTransformModeButtons.forEach((button) => {
        button.addEventListener("click", handleCameraTransformModeClick);
    });

    cameraUpVisibilityInput.addEventListener("change", () => {
        onCameraUpVisibilityChange(cameraUpVisibilityInput.checked);
    });

    cameraViewButtons.forEach((button) => {
        button.addEventListener("click", () => {
            onCameraViewChange(button.dataset.cameraView);

            updateCameraModeButtons();
            updateCameraViewButtons();
        });
    });

    cameraEditingInput.addEventListener("change", handleCameraEditingChange);
    domVisibilityInput.addEventListener("change", handleDomVisibilityChange);
    sceneCameraVisibilityInput.addEventListener("change", handleSceneCameraVisibilityChange);
    zoomEnabledInput.addEventListener("change", handleZoomChange);

    copyCurrentViewportButton.addEventListener("click", onCopyCurrentViewport);
    copySceneCameraButton.addEventListener("click", onCopySceneCamera);
    resetCameraButton.addEventListener("click", onResetCamera);

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
        lockNotice.hidden = !getCameraLocked();
    }

    function handleDomVisibilityChange() {
        onDomVisibilityChange(domVisibilityInput.checked);
    }

    function handleSceneCameraVisibilityChange() {
        onSceneCameraVisibilityChange(sceneCameraVisibilityInput.checked);
    }

    function handleCameraEditTargetChange(event) {
        if (!event.target.checked) {
            return;
        }

        onCameraEditTargetChange(event.target.value);

        if (event.target.value === "target") {
            cameraTransformMode = "translate";
            onCameraTransformModeChange(cameraTransformMode);
        }

        updateCameraTransformModeButtons();
    }

    function setSceneCameraVisible(isVisible) {
        sceneCameraVisibilityInput.checked = isVisible;
        cameraEditingInput.disabled = !isVisible;

        cameraEditTargetInputs.forEach((input) => {
            input.disabled = !isVisible;
        });
        updateCameraTransformModeButtons();
    }

    function handleCameraEditingChange() {
        onCameraEditingChange(cameraEditingInput.checked);
        updateCameraTransformModeButtons();
    }

    function setCameraEditing(isEditing) {
        cameraEditingInput.checked = isEditing;
        updateCameraTransformModeButtons();
    }

    function updateCameraTransformModeButtons() {
        const isTargetSelected = cameraEditTargetInputs.some((input) => {
            return input.checked && input.value === "target";
        });

        cameraTransformModeButtons.forEach((button) => {
            const mode = button.dataset.cameraTransformMode;

            button.disabled = !cameraEditingInput.checked || !sceneCameraVisibilityInput.checked || (isTargetSelected && mode === "rotate");

            button.setAttribute("aria-pressed", String(mode === cameraTransformMode));
        });
    }

    function handleCameraTransformModeClick(event) {
        cameraTransformMode = event.currentTarget.dataset.cameraTransformMode;

        onCameraTransformModeChange(cameraTransformMode);
        updateCameraTransformModeButtons();
    }

    /* runtime defaults */
    let cameraTransformMode = "translate";
    zoomEnabledInput.checked = cameraZoomEnabled;
    domVisibilityInput.checked = domVisible;

    updateCameraModeButtons();
    updateCameraViewButtons();
    updateCameraLock();

    cameraTargetVisibilityInput.checked = cameraTargetVisible;
    cameraUpVisibilityInput.checked = cameraUpVisible;
    setSceneCameraVisible(sceneCameraVisible);

    container.appendChild(controlsContainer);

    return {
        setCameraEditing,
        setSceneCameraVisible,
        updateCameraModeButtons,
        updateCameraViewButtons,
        updateCameraLock,

        destroy() {
            controlsContainer.remove();
            panelToggle.destroy();
            cameraEditingInput.removeEventListener("change", handleCameraEditingChange);
            cameraEditTargetInputs.forEach((input) => {
                input.removeEventListener("change", handleCameraEditTargetChange);
            });
            cameraTransformModeButtons.forEach((button) => {
                button.removeEventListener("click", handleCameraTransformModeClick);
            });
            domVisibilityInput.removeEventListener("change", handleDomVisibilityChange);
            sceneCameraVisibilityInput.removeEventListener("change", handleSceneCameraVisibilityChange);
            zoomEnabledInput.removeEventListener("change", handleZoomChange);
        },
    };
}
