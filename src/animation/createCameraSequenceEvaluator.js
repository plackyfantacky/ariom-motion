import { createSequenceSampler } from "./createSequenceSampler.js";

export function createCameraSequenceEvaluator(object, sequence, sequenceName) {
    const sampler = createSequenceSampler(sequence, sequenceName);

    const animatesCameraLock = sequence.keyframes.some((keyframe) => {
        return keyframe.cameraLocked !== undefined;
    });

    let previousCameraLocked = false;

    const frames = sequence.keyframes.map((keyframe) => {
        if (keyframe.cameraLocked !== undefined && typeof keyframe.cameraLocked !== "boolean") {
            throw new Error(`Invalid cameraLocked value in "${sequenceName}".`);
        }

        previousCameraLocked = keyframe.cameraLocked ?? previousCameraLocked;

        return {
            time: keyframe.time,
            cameraLocked: previousCameraLocked,
        };
    });

    function apply(progress) {
        if (!animatesCameraLock) {
            return;
        }

        const time = Math.max(0, Math.min(1, progress)) * sampler.duration;
        let cameraLocked = false;

        for (const frame of frames) {
            if (frame.time > time) {
                break;
            }

            cameraLocked = frame.cameraLocked;
        }

        object.userData.setCameraLocked(cameraLocked);
    }

    return {
        duration: sampler.duration,
        apply,
    };
}
