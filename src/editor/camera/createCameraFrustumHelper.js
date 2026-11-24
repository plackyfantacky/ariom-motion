
import * as THREE from 'three';

export function createCameraFrustumHelper(scene, camera, target) {
    const referenceCamera = camera.clone();
    const referenceTarget = target.clone();

    referenceCamera.updateProjectionMatrix();
    referenceCamera.updateMatrixWorld(true);

    const helper = new THREE.CameraHelper(referenceCamera);

    helper.userData.editorHelper = true;
    helper.visible = false;

    scene.add(helper);

    function setVisible(isVisible) {
        helper.visible = isVisible;
    }

    function destroy() {
        scene.remove(helper);
        helper.geometry.dispose();
        helper.material.dispose();
    }

    return {
        setVisible,
        getCamera() {
            return referenceCamera;
        },
        getTarget() {
            return referenceTarget;
        },
        destroy
    };
}
