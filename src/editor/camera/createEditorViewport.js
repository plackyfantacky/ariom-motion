import { createOrbitControls } from "../../scene/createOrbitControls.js";

export function createEditorViewport(sceneCamera, sceneOrbit, renderer) {
    const camera = sceneCamera.clone();

    let controls = makeControls(sceneOrbit.getControls().target);

    function makeControls(target, enabled = false) {
        return createOrbitControls({
            camera,
            domElement: renderer.domElement,
            target,
            enabled,
        });
    }

    const cameraOrbit = {
        getControls() {
            return controls;
        },

        setEnabled(isEnabled) {
            controls.enabled = isEnabled;
        },

        isLocked() {
            return false;
        },

        rebuild(target) {
            const enabled = controls.enabled;
            const zoomEnabled = controls.enableZoom;

            controls.dispose();
            controls = makeControls(target, enabled);
            controls.enableZoom = zoomEnabled;

            return controls;
        },
    };

    function followScene() {
        camera.position.copy(sceneCamera.position);
        camera.quaternion.copy(sceneCamera.quaternion);
        camera.up.copy(sceneCamera.up);
        camera.fov = sceneCamera.fov;
        camera.near = sceneCamera.near;
        camera.far = sceneCamera.far;

        camera.updateProjectionMatrix();

        controls.target.copy(sceneOrbit.getControls().target);
    }

    function update() {
        if (controls.enabled) {
            controls.update();
        }
    }

    function destroy() {
        controls.dispose();
    }

    return {
        camera,
        cameraOrbit,
        followScene,
        update,
        destroy,
    };
}
