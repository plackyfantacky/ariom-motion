import { Vector3 } from "three";
import { createSequenceSampler } from "./createSequenceSampler.js";

export function createCameraSequenceEvaluator(object, sequence, sequenceName) {
    const sampler = createSequenceSampler(sequence, sequenceName);
    const { camera, cameraOrbit } = object.userData;

    const animatesPosition = sequence.keyframes.some((frame) => {
        return frame.position !== undefined;
    });

    const animatesTarget = sequence.keyframes.some((frame) => {
        return frame.target !== undefined;
    });

    const animatesCameraLock = sequence.keyframes.some((frame) => {
        return frame.cameraLocked !== undefined;
    });

    let previousPosition = camera.position.toArray();
    let previousTarget = cameraOrbit.getControls().target.toArray();
    let previousCameraLocked = false;

    function readVector(value, previousValue, property) {
        if (value === undefined) {
            return previousValue;
        }

        if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
            throw new Error(`Invalid ${property} in sequence "${sequenceName}".`);
        }

        return value;
    }

    const frames = sequence.keyframes.map((keyframe) => {
        previousPosition = readVector(keyframe.position, previousPosition, "position");

        previousTarget = readVector(keyframe.target, previousTarget, "target");

        if (keyframe.cameraLocked !== undefined && typeof keyframe.cameraLocked !== "boolean") {
            throw new Error(`Invalid cameraLocked in sequence "${sequenceName}".`);
        }

        previousCameraLocked = keyframe.cameraLocked ?? previousCameraLocked;

        return {
            time: keyframe.time,
            position: new Vector3(...previousPosition),
            target: new Vector3(...previousTarget),
            cameraLocked: previousCameraLocked,
        };
    });

    const pose = {
        position: animatesPosition ? new Vector3() : null,
        target: animatesTarget ? new Vector3() : null,
        complete: false,
    };

    function apply(progress) {
        const sample = sampler.sample(progress);
        const previousFrame = frames[sample.previousIndex];
        const nextFrame = frames[sample.nextIndex];

        if (animatesCameraLock) {
            const time = Math.max(0, Math.min(1, progress)) * sampler.duration;

            const currentFrame = time >= nextFrame.time ? nextFrame : previousFrame;

            object.userData.setCameraLocked(currentFrame.cameraLocked);
        }

        if (!animatesPosition && !animatesTarget) {
            return;
        }

        pose.position?.lerpVectors(previousFrame.position, nextFrame.position, sample.progress);

        pose.target?.lerpVectors(previousFrame.target, nextFrame.target, sample.progress);

        pose.complete = progress >= 1;

        cameraOrbit.queuePose(pose);
    }

    return {
        duration: sampler.duration,
        apply,
    };
}
