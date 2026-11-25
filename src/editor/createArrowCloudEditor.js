import * as THREE from "three";

//styles for UI
import "./styles.css";

//editor
import { createEditorPreferences, createBuildInfo } from "./editorUI.js";
import editorViewControlsTemplate from "./editorViewControls.html";

//camera
import { createCameraController } from "./camera/createCameraController.js";
import { createCameraControls } from "./camera/createCameraControls.js";
import { createCameraFrustumHelper } from "./camera/createCameraFrustumHelper.js";
import { createCameraMesh } from "./camera/createCameraMesh.js";
import { createCameraTransformControls } from "./camera/createCameraTransformControls.js";
import { createCameraTargetMarker } from "./camera/createCameraTargetMarker.js";

//scene
import { createAxesGauge } from "./scene/createAxesGauge.js";
import { createSceneControls } from "./scene/createSceneControls.js";
import { createArrowDisplayState } from "./scene/createArrowDisplayState.js";
import { createSceneOriginMarker } from "./scene/createSceneOriginMarker.js";

//paths
import { createPathTools } from "./path/createPathTools.js";

//timeline
import { createTimelineControls } from "./timeline/createTimelineControls.js";

export function createArrowCloudEditor({
    arrowPaths,
    camera,
    cameraOrbit,
    domElements = [],
    getArrows,
    getRenderedArrowItems,
    getSceneCameraTarget,
    hasInitialCameraState,
    initialCameraDistance,
    initialCameraTarget,
    initialCameraView,
    isSceneCameraLocked,
    mountElement,
    onArrowPathsChange,
    onDatasetChange,
    onSceneCameraEditingChange = () => {},
    onScenePreviewChange = () => {},
    onUIVisibilityChange = () => {},
    playback,
    renderer,
    scene,
    sceneCamera,
}) {
    const preferences = createEditorPreferences();

    let isEditingSceneCamera = false;

    const originalDomVisibility = new Map(
        domElements.map((element) => {
            return [element, element.classList.contains("editor-dom-hidden")];
        }),
    );

    setDomVisible(preferences.get("domVisible"));

    const uiVisibilityToggle = createUIVisibilityToggle();
    const sidebar = document.createElement("aside");
    sidebar.className = "editor-sidebar ui";
    document.body.append(sidebar);

    //before camera controller is made
    /* prettier-ignore */
    const cameraFrustumHelper = createCameraFrustumHelper(
        scene,
        sceneCamera,
        getSceneCameraTarget,
    );

    const cameraMesh = createCameraMesh(scene, sceneCamera);

    const sceneTargetMarker = createCameraTargetMarker(scene, 0.6, 0xffc783);
    sceneTargetMarker.setPosition(getSceneCameraTarget());

    //main actions
    const cameraController = createCameraController({
        camera,
        cameraOrbit,
        renderer,
        mountElement,
        scene,
        initialCameraTarget,
        hasInitialCameraState,
    });

    const cameraTransformControls = createCameraTransformControls({
        camera,
        getSceneCameraTarget,
        renderer,
        scene,
        sceneCamera,
        sceneTargetObject: sceneTargetMarker.object,

        onDragStateChange(isDragging) {
            cameraController.setInteractionEnabled(!isDragging);
        },
    });

    const savedCameraMode = preferences.get("cameraMode");

    if (["tracked", "orbital", "fly"].includes(savedCameraMode)) {
        cameraController.setMode(savedCameraMode);
    }

    cameraController.setViewPresetChangeHandler(() => {
        cameraControls.updateCameraViewButtons();
    });

    const cameraControls = createCameraControls({
        container: sidebar,

        cameraZoomEnabled: cameraController.getZoomEnabled(),
        domVisible: preferences.get("domVisible"),
        initialExpanded: preferences.get("cameraPanelExpanded"),
        sceneCameraVisible: preferences.get("sceneCameraVisible"),
        viewportTargetVisible: preferences.get("viewportTargetVisible"),

        onPanelExpandedChange(isExpanded) {
            preferences.set("cameraPanelExpanded", isExpanded);
        },

        getCameraMode() {
            return cameraController.getMode();
        },

        getCameraView() {
            return cameraController.getViewPreset();
        },

        onCameraModeChange(cameraMode) {
            if (isEditingSceneCamera) {
                setSceneCameraEditing(false);
                cameraControls.setCameraEditing(false);
            }

            cameraController.setMode(cameraMode);
            preferences.set("cameraMode", cameraController.getMode());
        },

        onCameraViewChange(presetName) {
            cameraController.setViewPreset(presetName);
            preferences.set("cameraMode", cameraController.getMode());
        },

        onResetCamera() {
            cameraController.reset();
            preferences.set("cameraMode", cameraController.getMode());
        },

        onCopySceneCamera() {
            cameraController.copy(cameraFrustumHelper.getCamera(), cameraFrustumHelper.getTarget());
        },

        onCopyCurrentViewport() {
            cameraController.copy();
        },

        onViewportTargetVisibilityChange(isVisible) {
            cameraController.setViewportTargetVisible(isVisible);
            preferences.set("viewportTargetVisible", isVisible);
        },

        onCameraEditingChange(isEditing) {
            setSceneCameraEditing(isEditing);
            cameraControls.updateCameraModeButtons();
        },

        onSceneCameraVisibilityChange(isVisible) {
            preferences.set("sceneCameraVisible", isVisible);

            if (!isVisible && isEditingSceneCamera) {
                setSceneCameraEditing(false);
                cameraControls.setCameraEditing(false);
            }

            cameraControls.setSceneCameraVisible(isVisible);
            syncSceneCameraVisibility();
        },

        onCameraZoomChange(isEnabled) {
            cameraController.setZoomEnabled(isEnabled);
        },

        getCameraLocked() {
            return isSceneCameraLocked();
        },

        onDomVisibilityChange(isVisible) {
            setDomVisible(isVisible);
            preferences.set("domVisible", isVisible);
        },

        onCameraEditTargetChange(target) {
            cameraTransformControls.setEditTarget(target);
        },

        onCameraTransformModeChange(mode) {
            cameraTransformControls.setTransformMode(mode);
        },
    });

    if (initialCameraView) {
        cameraController.setViewPreset(initialCameraView, initialCameraDistance);
    }

    cameraController.setViewportTargetVisible(preferences.get("viewportTargetVisible"));

    const pathTools = createPathTools({
        camera,
        renderer,
        scene,
        arrowPaths,
        container: sidebar,

        lineLabelsVisible: preferences.get("lineLabelsVisible"),

        initialExpanded: preferences.get("pathPanelExpanded"),

        onPanelExpandedChange(isExpanded) {
            preferences.set("pathPanelExpanded", isExpanded);
        },

        getArrows() {
            return getArrows();
        },

        getPathVisibility(pathName) {
            return arrowDisplayState.getVisibility(pathName);
        },

        onPathsChange(nextArrowPaths) {
            onArrowPathsChange(nextArrowPaths);
        },

        onSelectionChange(pathName) {
            arrowDisplayState.apply(getRenderedArrowItems());
            sceneControls.setSelectedPathName(pathName);
        },

        onPathCollectionChange(nextPaths) {
            sceneControls.setArrowNames(nextPaths.map((path) => path.name));
        },

        onOriginDragStateChange(isDragging) {
            cameraController.setInteractionEnabled(!isDragging);
        },

        shouldIgnoreSceneClick() {
            return isEditingSceneCamera;
        },
    });

    const arrowDisplayState = createArrowDisplayState(pathTools.getArrowPaths());

    const gridHelper = new THREE.GridHelper(200, 200);
    gridHelper.visible = preferences.get("gridVisible");
    gridHelper.userData.editorHelper = true;
    scene.add(gridHelper);

    const axesGauge = createAxesGauge({
        size: 2,
        labelOffset: 0.35,
    });

    axesGauge.position.set(0.1, 0.1, 0.1);
    axesGauge.visible = preferences.get("axesVisible");
    axesGauge.userData.editorHelper = true;
    scene.add(axesGauge);

    const sceneOriginMarker = createSceneOriginMarker({ size: 2 });
    sceneOriginMarker.visible = preferences.get("sceneOriginVisible");
    scene.add(sceneOriginMarker);

    const sceneControls = createSceneControls({
        container: sidebar,
        onDatasetChange,
        gridVisible: gridHelper.visible,
        axesVisible: axesGauge.visible,
        initialExpanded: preferences.get("scenePanelExpanded"),
        lineLabelsVisible: preferences.get("lineLabelsVisible"),
        sceneOriginVisible: sceneOriginMarker.visible,

        getArrowVisibility(arrowName) {
            return arrowDisplayState.getVisibility(arrowName);
        },

        getArrowOpacity(arrowName) {
            return arrowDisplayState.getOpacity(arrowName);
        },

        onLineLabelsVisibilityChange(isVisible) {
            pathTools.setArrowNameLabelsVisible(isVisible);
            preferences.set("lineLabelsVisible", isVisible);
        },

        onPanelExpandedChange(isExpanded) {
            preferences.set("scenePanelExpanded", isExpanded);
        },

        arrowNames: pathTools.getArrowPaths().map((arrowPath) => arrowPath.name),

        onGridVisibilityChange(isVisible) {
            gridHelper.visible = isVisible;
            preferences.set("gridVisible", isVisible);
        },

        onAxesVisibilityChange(isVisible) {
            axesGauge.visible = isVisible;
            preferences.set("axesVisible", isVisible);
        },

        onArrowVisibilityChange(arrowName, isVisible) {
            arrowDisplayState.setVisibility(arrowName, isVisible);
            arrowDisplayState.apply(getRenderedArrowItems());
            syncPathVisibility();
        },

        onArrowOpacityChange(arrowName, opacity) {
            arrowDisplayState.setOpacity(arrowName, opacity);
            arrowDisplayState.apply(getRenderedArrowItems());
        },

        onSceneOriginVisibilityChange(isVisible) {
            sceneOriginMarker.visible = isVisible;
            preferences.set("sceneOriginVisible", isVisible);
        },
    });

    const buildInfo = createBuildInfo(sidebar, __ARROW_CLOUD_BUILD__);

    const timelineControls = createTimelineControls(playback);

    //helpers

    function createUIVisibilityToggle() {
        const template = document.createElement("template");
        template.innerHTML = editorViewControlsTemplate.trim();
        const element = template.content.firstElementChild.cloneNode(true);

        const showUIInput = element.querySelector("[data-show-ui]");
        const previewInput = element.querySelector("[data-preview-scene]");

        let previousViewport = null;
        let previousIsPlaying = false;

        showUIInput.checked = preferences.get("uiVisible");

        function applyVisibility() {
            const isVisible = showUIInput.checked && !previewInput.checked;

            showUIInput.disabled = previewInput.checked;

            document.body.classList.toggle("editor-ui-hidden", !isVisible);
            onUIVisibilityChange(isVisible);
        }

        function handleUIChange() {
            preferences.set("uiVisible", showUIInput.checked);
            applyVisibility();
        }

        function handlePreviewChange() {
            if (previewInput.checked) {
                previousViewport = cameraController.captureViewport();
                previousIsPlaying = playback.state.isPlaying;

                if (isEditingSceneCamera) {
                    setSceneCameraEditing(false);
                    cameraControls.setCameraEditing(false);
                }

                onSceneCameraEditingChange(false);
                playback.state.isPlaying = true;

                cameraController.setMode("tracked");
                setDomVisible(true);
            } else {
                playback.state.isPlaying = previousIsPlaying;

                if (previousViewport) {
                    cameraController.restoreViewport(previousViewport);
                    previousViewport = null;
                }

                setDomVisible(preferences.get("domVisible"));
            }

            cameraControls.updateCameraModeButtons();
            cameraControls.updateCameraViewButtons();

            onScenePreviewChange(previewInput.checked);
            applyVisibility();
        }

        showUIInput.addEventListener("change", handleUIChange);
        previewInput.addEventListener("change", handlePreviewChange);

        document.body.append(element);
        applyVisibility();

        return {
            destroy() {
                showUIInput.removeEventListener("change", handleUIChange);
                previewInput.removeEventListener("change", handlePreviewChange);

                if (previewInput.checked) {
                    playback.state.isPlaying = previousIsPlaying;
                }

                element.remove();
                document.body.classList.remove("editor-ui-hidden");
            },
        };
    }

    function setAnimationSettings(animationSettings) {
        timelineControls.setAnimationSettings(animationSettings);
    }

    function setDomVisible(isVisible) {
        domElements.forEach((element) => {
            element.classList.toggle("editor-dom-hidden", !isVisible);
        });
    }

    function setSceneCameraEditing(isEditing) {
        isEditingSceneCamera = isEditing;

        onSceneCameraEditingChange(isEditing);

        if (isEditing) {
            cameraController.setMode("orbital");
            preferences.set("cameraMode", "orbital");
            pathTools.clearSelection();
        }

        syncSceneCameraVisibility();
    }

    //exposed output functions

    function update({ deltaTime }) {
        timelineControls.updateProgressInput();

        cameraController.update(deltaTime);
        cameraControls.updateCameraLock();
        pathTools.update();

        gridHelper.position.x = Math.round(camera.position.x);
        gridHelper.position.z = Math.round(camera.position.z);

        syncSceneCameraVisibility();
    }

    function isCameraOverridden() {
        return cameraController.getMode() !== "tracked";
    }

    function syncSceneCameraVisibility() {
        const isVisible = preferences.get("sceneCameraVisible") && isCameraOverridden() && !document.body.classList.contains("editor-ui-hidden");

        sceneTargetMarker.setVisible(isVisible);

        cameraMesh.setVisible(isVisible);
        cameraFrustumHelper.setVisible(isVisible);

        cameraTransformControls.setEnabled(isVisible && isEditingSceneCamera);
    }

    function getArrowPaths() {
        return pathTools.getArrowPaths();
    }

    function setArrowPaths(arrowPaths) {
        pathTools.setArrowPaths(arrowPaths);

        arrowDisplayState.reset(arrowPaths);

        sceneControls.setArrowNames(arrowPaths.map((arrowPath) => arrowPath.name));
    }

    function syncRenderedArrowItems() {
        const renderedArrowItems = getRenderedArrowItems();

        pathTools.attachPathInfo(renderedArrowItems);
        pathTools.syncArrowNameLabels(renderedArrowItems);
        arrowDisplayState.apply(renderedArrowItems);
        syncPathVisibility();

        pathTools.setArrowNameLabelsVisible(preferences.get("lineLabelsVisible"));
    }

    function syncPathVisibility() {
        pathTools.getArrowPaths().forEach((path) => {
            pathTools.setPathVisibility(path.name, arrowDisplayState.getVisibility(path.name));
        });
    }

    function prepareRender() {
        syncSceneCameraVisibility();
        cameraFrustumHelper.update();
        cameraMesh.update();

        sceneTargetMarker.setPosition(getSceneCameraTarget());

        if (!document.body.classList.contains("editor-ui-hidden")) {
            return;
        }

        const helperVisibility = new Map();
        const highlightMaterials = new Map();

        scene.traverse((object) => {
            if (object.userData.editorHelper) {
                helperVisibility.set(object, object.visible);
                object.visible = false;
            }

            const originalMaterial = object.userData.pathHighlightOriginalMaterial;

            if (originalMaterial) {
                highlightMaterials.set(object, object.material);
                object.material = originalMaterial;
            }
        });

        return () => {
            helperVisibility.forEach((wasVisible, object) => {
                object.visible = wasVisible;
            });

            highlightMaterials.forEach((material, object) => {
                object.material = material;
            });
        };
    }

    function destroy() {
        buildInfo.destroy();
        cameraController.destroy();
        cameraControls.destroy();
        cameraFrustumHelper.destroy();
        cameraMesh.destroy();
        cameraTransformControls.destroy();
        pathTools.destroy();
        sceneControls.destroy();
        sceneTargetMarker.destroy();
        timelineControls.destroy();
        uiVisibilityToggle.destroy();

        onSceneCameraEditingChange(false);

        if (previewInput.checked) {
            playback.state.isPlaying = previousIsPlaying;
            onScenePreviewChange(false);
        }

        scene.remove(gridHelper);
        scene.remove(axesGauge);
        scene.remove(sceneOriginMarker);

        sceneOriginMarker.dispose();

        originalDomVisibility.forEach((wasHidden, element) => {
            element.classList.toggle("editor-dom-hidden", wasHidden);
        });
    }

    //end output
    return {
        update,
        isCameraOverridden,
        getArrowPaths,
        setArrowPaths,
        setAnimationSettings,
        syncRenderedArrowItems,
        prepareRender,
        destroy,
    };
}
