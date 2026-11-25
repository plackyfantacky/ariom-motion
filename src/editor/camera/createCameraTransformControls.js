import { Vector3 } from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";

export function createCameraTransformControls({
    /* prettier-ignore */
    camera,
    getSceneCameraTarget,
    onDragStateChange = () => {},
    renderer,
    scene,
    sceneCamera,
    sceneTargetObject,
}) {
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
    const cameraDirection = new Vector3();

    let targetDistance = 1;

    let enabled = false;
    let editTarget = "camera";

    function handleDragStateChange(event) {
        if (event.value) {
            previousPosition.copy(sceneCamera.position);

            targetDistance = Math.max(sceneCamera.position.distanceTo(getSceneCameraTarget()), 0.001);
        }

        onDragStateChange(event.value);
    }

    function handleObjectChange() {
        if (!controls.dragging) {
            return;
        }

        const target = getSceneCameraTarget();

        if (controls.getMode() === "rotate") {
            sceneCamera.getWorldDirection(cameraDirection);

            target.copy(sceneCamera.position).addScaledVector(cameraDirection, targetDistance);

            // Preserve the rotated camera's roll when later aiming at a target.
            sceneCamera.up.set(0, 1, 0).applyQuaternion(sceneCamera.quaternion).normalize();

            sceneCamera.updateMatrixWorld(true);
            return;
        }

        if (editTarget === "target") {
            if (sceneTargetObject.position.distanceToSquared(sceneCamera.position) < 0.000001) {
                sceneTargetObject.position.copy(target);
                return;
            }

            target.copy(sceneTargetObject.position);
            sceneCamera.lookAt(target);
        } else if (editTarget === "both") {
            movement.subVectors(sceneCamera.position, previousPosition);
            target.add(movement);
            previousPosition.copy(sceneCamera.position);
        } else {
            sceneCamera.lookAt(target);
        }

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
            sceneTargetObject.position.copy(getSceneCameraTarget());
            attachSelectedObject();
        } else {
            controls.detach();
        }
    }

    function setTransformMode(mode) {
        if (!["translate", "rotate"].includes(mode)) {
            throw new Error(`Unknown camera transform mode: ${mode}`);
        }

        const nextMode = editTarget === "target" ? "translate" : mode;

        controls.setMode(nextMode);
        controls.setSpace(nextMode === "rotate" ? "local" : "world");
    }

    function attachSelectedObject() {
        controls.attach(editTarget === "target" ? sceneTargetObject : sceneCamera);
    }

    function setEditTarget(nextTarget) {
        if (!["camera", "target", "both"].includes(nextTarget)) {
            throw new Error(`Unknown camera edit target: ${nextTarget}`);
        }

        if (editTarget === nextTarget) {
            return;
        }

        if (controls.dragging) {
            controls.dragging = false;
        }

        editTarget = nextTarget;

        if (editTarget === "target") {
            setTransformMode("translate");
        }

        sceneTargetObject.position.copy(getSceneCameraTarget());

        if (enabled) {
            attachSelectedObject();
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
        setEditTarget,
        setTransformMode,
        destroy,
    };
}
