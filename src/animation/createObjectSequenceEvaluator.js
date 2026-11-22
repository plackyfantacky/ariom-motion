import * as THREE from "three";

import { createSequenceSampler } from "./createSequenceSampler.js";

export function createObjectSequenceEvaluator(object, sequence, sequenceName, target = object.userData.poseGroup) {
    const sampler = createSequenceSampler(sequence, sequenceName);
    const keyframes = sequence.keyframes;
    const duration = sampler.duration;
    const rotationSpace = sequence.rotationSpace;

    if (!["world", "local"].includes(rotationSpace)) {
        throw new Error(`Sequence "${sequenceName}" requires rotationSpace "world" or "local".`);
    }

    const animatesProjection = keyframes.some((keyframe) => {
        return keyframe.projection?.perspective !== undefined;
    });

    const animatesPosition = keyframes.some((keyframe) => {
        return keyframe.position !== undefined;
    });

    const animatesRotation = keyframes.some((keyframe) => {
        return keyframe.rotation !== undefined;
    });

    const positionSpace = sequence.positionSpace;

    if (animatesPosition && !["world", "local"].includes(positionSpace)) {
        throw new Error(`Sequence "${sequenceName}" requires positionSpace "world" or "local".`);
    }

    const poseGroup = target;
    const projection = object.userData.projection;

    const modifierIds = new Set();

    keyframes.forEach((keyframe) => {
        Object.keys(keyframe.modifiers ?? {}).forEach((id) => {
            modifierIds.add(id);
        });
    });

    const modifiers = [...modifierIds].map((id) => {
        const state = object.userData.modifiers?.[id];

        if (!state) {
            throw new Error(`Unknown modifier "${id}" in "${sequenceName}".`);
        }

        return { id, state };
    });

    let previousPosition = animatesPosition ? (positionSpace === "world" ? poseGroup.getWorldPosition(new THREE.Vector3()) : poseGroup.position.clone()) : null;
    let previousRotation = rotationSpace === "world" ? poseGroup.getWorldQuaternion(new THREE.Quaternion()) : poseGroup.quaternion.clone();

    let previousPerspective = projection.perspective;
    let previousAmounts = modifiers.map(({ state }) => state.amount);

    const frames = keyframes.map((keyframe) => {
        const position = animatesPosition ? readPosition(keyframe.position, previousPosition) : null;
        const rotation = readRotation(keyframe.rotation, previousRotation);

        const perspective = readPerspective(keyframe.projection?.perspective, previousPerspective);

        const amounts = modifiers.map(({ id }, index) => {
            const amount = keyframe.modifiers?.[id]?.amount ?? previousAmounts[index];

            if (!Number.isFinite(amount)) {
                throw new Error(`Invalid amount for modifier "${id}".`);
            }

            return amount;
        });

        previousPosition = position;
        previousRotation = rotation;
        previousPerspective = perspective;
        previousAmounts = amounts;

        return {
            time: keyframe.time,
            position,
            rotation,
            perspective,
            amounts,
        };
    });

    const worldRotation = new THREE.Quaternion();
    const parentRotation = new THREE.Quaternion();
    const evaluatedPosition = new THREE.Vector3();

    function readPosition(values, fallback) {
        if (values === undefined) {
            return fallback.clone();
        }

        if (!Array.isArray(values) || values.length !== 3 || !values.every(Number.isFinite)) {
            throw new Error(`Invalid position in "${sequenceName}".`);
        }

        return new THREE.Vector3().fromArray(values);
    }

    function readRotation(values, fallback) {
        if (values === undefined) {
            return fallback.clone();
        }

        if (!Array.isArray(values) || values.length !== 3 || !values.every(Number.isFinite)) {
            throw new Error(`Invalid rotation in "${sequenceName}".`);
        }

        return new THREE.Quaternion().setFromEuler(new THREE.Euler(...values));
    }

    function readPerspective(value, fallback) {
        const perspective = value ?? fallback;

        if (!Number.isFinite(perspective) || perspective < 0 || perspective > 1) {
            throw new Error(`Invalid perspective in "${sequenceName}".`);
        }

        return perspective;
    }

    function apply(progress) {
        const sample = sampler.sample(progress);
        const previousFrame = frames[sample.previousIndex];
        const nextFrame = frames[sample.nextIndex];
        const easedProgress = sample.progress;

        if (animatesPosition) {
            evaluatedPosition.lerpVectors(previousFrame.position, nextFrame.position, easedProgress);

            if (positionSpace === "world" && poseGroup.parent) {
                poseGroup.parent.updateWorldMatrix(true, false);
                poseGroup.parent.worldToLocal(evaluatedPosition);
            }

            poseGroup.position.copy(evaluatedPosition);
        }

        if (animatesRotation) {
            worldRotation.slerpQuaternions(previousFrame.rotation, nextFrame.rotation, easedProgress);

            if (rotationSpace === "world") {
                poseGroup.parent.getWorldQuaternion(parentRotation);
                poseGroup.quaternion.copy(parentRotation.invert()).multiply(worldRotation);
            } else {
                poseGroup.quaternion.copy(worldRotation);
            }
        }

        if (animatesProjection) {
            projection.perspective = previousFrame.perspective + (nextFrame.perspective - previousFrame.perspective) * easedProgress;
        }

        for (let i = 0; i < modifiers.length; i++) {
            modifiers[i].state.amount = previousFrame.amounts[i] + (nextFrame.amounts[i] - previousFrame.amounts[i]) * easedProgress;
        }
    }

    return {
        duration,
        apply,
    };
}
