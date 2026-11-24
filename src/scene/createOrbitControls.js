import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function createOrbitControls({ camera, domElement, target, enabled = true }) {
    const initialPosition = camera.position.clone();
    const initialQuaternion = camera.quaternion.clone();

    const controls = new OrbitControls(camera, domElement);

    controls.target.copy(target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enabled = enabled;

    // Construction can update the camera before our target is assigned.
    camera.position.copy(initialPosition);
    camera.quaternion.copy(initialQuaternion);

    return controls;
}