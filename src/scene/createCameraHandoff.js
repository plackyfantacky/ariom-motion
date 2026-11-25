import { Quaternion, Vector3 } from "three";

export function createCameraHandoff(duration = 0.4) {
    const startPosition = new Vector3();
    const startQuaternion = new Quaternion();
    const destinationQuaternion = new Quaternion();
    const direction = new Vector3();

    let startDistance = 1;
    let elapsed = 0;
    let active = false;

    function start(camera, target) {
        startPosition.copy(camera.position);
        startQuaternion.copy(camera.quaternion);
        startDistance = camera.position.distanceTo(target);

        elapsed = 0;
        active = true;
    }

    function apply(deltaTime, camera, target) {
        if (!active) {
            return;
        }

        elapsed += deltaTime;

        const progress = Math.min(elapsed / duration, 1);

        if (progress === 1) {
            active = false;
            return;
        }

        const amount = progress * progress * (3 - 2 * progress);
        const destinationDistance = camera.position.distanceTo(target);

        destinationQuaternion.copy(camera.quaternion);
        camera.position.lerpVectors(startPosition, camera.position, amount);
        camera.quaternion.slerpQuaternions(startQuaternion, destinationQuaternion, amount);

        const distance = startDistance + (destinationDistance - startDistance) * amount;

        direction.set(0, 0, -1).applyQuaternion(camera.quaternion);
        target.copy(camera.position).addScaledVector(direction, distance);

        camera.updateMatrixWorld(true);
    }

    return {
        start,
        apply,

        isActive() {
            return active;
        },

        cancel() {
            active = false;
        },
    };
}
