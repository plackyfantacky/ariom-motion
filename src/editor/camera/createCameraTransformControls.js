import { Vector3 } from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";

export function createCameraTransformControls({ scene, camera, sceneCamera, renderer, getSceneCameraTarget, onDragStateChange = () => {} }) {
    const controls = new TransformControls(camera, renderer.domElement);

    controls.setMode("translate");
    controls.setSpace("world");
    controls.enabled = false;

    const helper = controls.getHelper();

    helper.userData.editorHelper = true;
    helper.visible = false;

    scene.add(helper);

    // TransformControls requires its attached object to have a parent.
    const addedCameraToScene = sceneCamera.parent === null;

    if (addedCameraToScene) {
        scene.add(sceneCamera);
    }

    const previousPosition = new Vector3();
    const movement = new Vector3();

    let enabled = false;

    function handleDragStateChange(event) {
        if (event.value) {
            previousPosition.copy(sceneCamera.position);
        }

        onDragStateChange(event.value);
    }

    function handleObjectChange() {
        if (!controls.dragging) {
            return;
        }

        movement.subVectors(sceneCamera.position, previousPosition);

        // Move the target with the camera to preserve its viewing direction.
        getSceneCameraTarget().add(movement);
        previousPosition.copy(sceneCamera.position);

        sceneCamera.updateMatrixWorld(true);
    }

    function setEnabled(isEnabled) {
        if (enabled === isEnabled) {
            return;
        }

        enabled = isEnabled;

        if (!enabled && controls.dragging) {
            controls.dragging = false;
        }

        controls.enabled = enabled;
        helper.visible = enabled;

        if (enabled) {
            controls.attach(sceneCamera);
        } else {
            controls.detach();
        }
    }

    function destroy() {
        setEnabled(false);

        controls.removeEventListener("dragging-changed", handleDragStateChange);

        controls.removeEventListener("objectChange", handleObjectChange);

        scene.remove(helper);
        controls.dispose();

        if (addedCameraToScene) {
            scene.remove(sceneCamera);
        }
    }

    controls.addEventListener("dragging-changed", handleDragStateChange);

    controls.addEventListener("objectChange", handleObjectChange);

    return {
        setEnabled,
        destroy,
    };
}
