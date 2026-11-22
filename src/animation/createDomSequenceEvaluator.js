import { createSequenceSampler } from "./createSequenceSampler.js";

export function createDomSequenceEvaluator(object, sequence, sequenceName) {
    const element = object.userData.element;
    const sampler = createSequenceSampler(sequence, sequenceName);

    const animatesTranslation = sequence.keyframes.some((keyframe) => {
        return keyframe.translate !== undefined;
    });

    const animatesOpacity = sequence.keyframes.some((keyframe) => {
        return keyframe.opacity !== undefined;
    });

    let previousTranslation = [0, 0];
    let previousOpacity = animatesOpacity ? Number(getComputedStyle(element).opacity) : 1;

    const frames = sequence.keyframes.map((keyframe) => {
        const translation = keyframe.translate ?? previousTranslation;
        const opacity = keyframe.opacity ?? previousOpacity;

        if (
            !Array.isArray(translation) ||
            translation.length !== 2 ||
            !translation.every(Number.isFinite)
        ) {
            throw new Error(`Invalid translation in "${sequenceName}"`);
        }

        if (
            !Number.isFinite(opacity) ||
            opacity < 0 ||
            opacity > 1
        ) {
            throw new Error(`Invalid opacity in "${sequenceName}"`);
        }

        previousTranslation = translation;
        previousOpacity = opacity;

        return {
            x: translation[0],
            y: translation[1],
            opacity,
        };
    });

    function apply(progress) {
        const sample = sampler.sample(progress);
        const previousFrame = frames[sample.previousIndex];
        const nextFrame = frames[sample.nextIndex];
        const amount = sample.progress;

        if (animatesTranslation) {
            const x = previousFrame.x + (nextFrame.x - previousFrame.x) * amount;
            const y = previousFrame.y + (nextFrame.y - previousFrame.y) * amount;
            const translation = `${x}px ${y}px`;

            if (element.style.translate !== translation) {
                element.style.translate = translation;
            }
        }

        if (animatesOpacity) {
            const opacity = String(
                previousFrame.opacity + (nextFrame.opacity - previousFrame.opacity) * amount,
            );

            if (element.style.opacity !== opacity) {
                element.style.opacity = opacity;
            }
        }
    }

    return {
        duration: sampler.duration,
        apply,
    };
}