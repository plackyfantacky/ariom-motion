import { smaa } from "three/examples/jsm/tsl/display/SMAANode.js";

export function createSequenceSampler(sequence, sequenceName) {
    const keyframes = sequence.keyframes;

    if (!Array.isArray(keyframes) || keyframes.length < 2) {
        throw new Error(`Sequence "${sequenceName}" requires at least to keyframes`);
    }

    const duration = sequence.duration ?? keyframes[keyframes.length - 1].time;

    if (
        !Number.isFinite(duration) ||
        duration <= 0 ||
        keyframes[0].time !== 0 ||
        keyframes[keyframes.length - 1].time !== duration
    ) {
        throw new Error(`Sequence "${sequenceName}" requires a positive duration and keyframes spanning its duration`);
    }

    keyframes.forEach((keyframe, index) => {
        if (
            !Number.isFinite(keyframe.time) ||
            (index > 0 && keyframe.time <= keyframes[index - 1].time)
        ) {
            throw new Error(`Keyframe times must increase in "${sequenceName}"`);
        }        
    });

    const result = {
        previousIndex: 0,
        nextIndex: 0,
        progress: 0,
    }

    function sample(progress) {
        const time = Math.max(0, Math.min(1, progress)) * duration;
        let nextIndex = 1;

        while (
            nextIndex < keyframes.length - 1 &&
            time > keyframes[nextIndex].time
        ) {
            nextIndex++;
        }

        const previousTime = keyframes[nextIndex - 1].time;
        const nextTime = keyframes[nextIndex].time;
        const segmentProgress = (time - previousTime) / (nextTime - previousTime);

        result.previousIndex = nextIndex - 1;
        result.nextIndex = nextIndex;
        result.progress = segmentProgress * segmentProgress * (3 -2 * segmentProgress);
        
        return result;
    }

    return {
        duration,
        sample,
    };
}