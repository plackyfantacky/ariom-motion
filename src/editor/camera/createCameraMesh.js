import * as THREE from "three";

export function createCameraMesh(scene, camera) {
    const object = new THREE.Group();

    object.name = "Scene camera";
    object.userData.editorHelper = true;
    object.visible = false;

    const material = new THREE.MeshBasicMaterial({
        color: 0xffc783,
        wireframe: true,
    });

    let visible = false;

    function addPart(geometry, position, rotation = [0, 0, 0]) {
        const mesh = new THREE.Mesh(geometry, material);

        mesh.position.fromArray(position);
        mesh.rotation.set(...rotation);

        object.add(mesh);

        return mesh;
    }

    // Body, with the lens pointing along the camera's local -Z axis.
    addPart(new THREE.BoxGeometry(0.3, 0.35, 0.5), [0, 0, 0.05]);

    addPart(new THREE.CylinderGeometry(0.12, 0.17, 0.22, 12), [0, 0, -0.31], [Math.PI / 2, 0, 0]);

    // Two film reels, with their axles along local X.
    const reelGeometry = new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12);

    addPart(reelGeometry, [0, 0.3, -0.13], [0, 0, Math.PI / 2]);

    addPart(reelGeometry, [0, 0.3, 0.2], [0, 0, Math.PI / 2]);

    // Small mounting foot.
    addPart(new THREE.BoxGeometry(0.2, 0.08, 0.22), [0, -0.215, 0.05]);

    scene.add(object);

    function update(isInspecting = true) {
        camera.updateWorldMatrix(true, false);
        camera.getWorldPosition(object.position);
        camera.getWorldQuaternion(object.quaternion);

        object.visible = visible && isInspecting;
    }

    function setVisible(isVisible) {
        visible = isVisible;
    }

    function destroy() {
        scene.remove(object);

        const geometries = new Set();

        object.traverse((child) => {
            if (child.geometry) {
                geometries.add(child.geometry);
            }
        });

        geometries.forEach((geometry) => {
            geometry.dispose();
        });

        material.dispose();
    }

    return {
        object,
        update,
        setVisible,
        destroy,
    };
}
