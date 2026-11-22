import { createObjectSequenceEvaluator } from "./createObjectSequenceEvaluator.js";
import { createDomSequenceEvaluator } from "./createDomSequenceEvaluator.js";
import { resolveAnimationBindings } from "./resolveAnimationBindings.js";

export function createSceneObjectAnimations(sceneObjects, sequences = {}, events) {
    const controllers = [];
    const unsubscribeEvents = [];
    const scrollBindings = new Map();
    const activations = new Map();

    sceneObjects.forEach((object) => {
        const bindings = resolveAnimationBindings(object.userData.animation, object.userData.sceneObjectId);
        const bindingControllers = new Map();
        const objectActivations = new Map();

        const layers = new Map();

        activations.set(object.userData.sceneObjectId, objectActivations);

        bindings.forEach(({ name: bindingName, binding, hasAt, hasOn, hasScroll }) => {
            const sequence = sequences[binding.play];

            if (!sequence) {
                console.warn(
                    `Animation "${object.userData.sceneObjectId}.${bindingName}" ` + `references undefined sequence "${binding.play}". Binding skipped.`,
                );
                return;
            }

            const layerName = binding.layer ?? "primary";
            if (!["primary", "additive"].includes(layerName)) {
                throw new Error(`Unknown animation layer: ${layerName}`);
            }

            const isDomObject = object.userData.type === "dom";

            if (isDomObject && layerName !== "primary") {
                throw new Error("DOM animations currently support the primary layer only.");
            }

            if (layerName === "additive" && sequence.rotationSpace !== "local") {
                throw new Error("Additive animation requires local rotation space.");
            }

            if (!layers.has(layerName)) {
                layers.set(layerName, {
                    activeBinding: null,
                    previousController: null,
                    scheduled: [],
                });
            }

            const layer = layers.get(layerName);
            const target = layerName === "additive" ? object.userData.motionGroup : object.userData.poseGroup;

            const evaluator = isDomObject
                ? createDomSequenceEvaluator(object, sequence, binding.play)
                : createObjectSequenceEvaluator(object, sequence, binding.play, target);

            const duration = evaluator.duration;

            let idleStartTime = null;
            let activationTime = null;
            let activationPending = false;
            let seekProgress = null;

            function activate() {
                layer.activeBinding = bindingName;
                seekProgress = null;
                activationPending = true;
            }

            objectActivations.set(bindingName, {
                play: activate,

                seek(progress) {
                    layer.activeBinding = bindingName;
                    seekProgress = Math.max(0, Math.min(1, progress));
                    activationPending = false;
                    activationTime = null;
                    idleStartTime = null;
                },
            });

            if (hasOn) {
                unsubscribeEvents.push(events.on(binding.on, activate));
            }

            const controller = {
                update(currentTime, ambientTime) {
                    if (seekProgress !== null) {
                        evaluator.apply(seekProgress);
                        return;
                    }

                    if (activationPending) {
                        activationPending = false;
                        activationTime = ambientTime;
                        idleStartTime = null;

                        object.userData.idleMotion?.update(0);
                    }

                    if (binding.loop && hasAt && activationTime === null && currentTime >= binding.at) {
                        activationTime = ambientTime;
                    }

                    let elapsedTime;

                    if (activationTime !== null) {
                        elapsedTime = ambientTime - activationTime;
                    } else if (hasAt) {
                        elapsedTime = currentTime - binding.at;
                    } else {
                        return;
                    }

                    const elapsed = Math.max(0, elapsedTime);
                    const progress = binding.loop ? (elapsed % duration) / duration : Math.min(1, elapsed / duration);

                    evaluator.apply(progress);

                    if (progress === 1 && idleStartTime === null) {
                        idleStartTime = ambientTime;
                    }

                    if (idleStartTime !== null) {
                        object.userData.idleMotion?.update(ambientTime - idleStartTime);
                    }
                },
            };

            bindingControllers.set(bindingName, controller);

            if (hasAt) {
                layer.scheduled.push({
                    at: binding.at,
                    controller,
                });
            }

            if (hasScroll) {
                if (!scrollBindings.has(layer)) {
                    scrollBindings.set(layer, []);
                }

                scrollBindings.get(layer).push({
                    ...binding.scroll,
                    seek: objectActivations.get(bindingName).seek,
                });
            }
        });

        if (bindingControllers.size === 0) {
            controllers.push({
                update(_currentTime, ambientTime) {
                    object.userData.idleMotion?.update(ambientTime);
                },
            });

            return;
        }

        layers.forEach((layer) => {
            layer.scheduled.sort((first, second) => {
                return first.at - second.at;
            });
        });

        controllers.push({
            update(currentTime, ambientTime) {
                layers.forEach((layer) => {
                    let controller;

                    if (layer.activeBinding !== null) {
                        controller = bindingControllers.get(layer.activeBinding);
                    } else {
                        controller = layer.scheduled[0]?.controller;

                        for (const scheduled of layer.scheduled) {
                            if (scheduled.at <= currentTime) {
                                controller = scheduled.controller;
                            }
                        }
                    }

                    if (!controller) {
                        return;
                    }

                    if (controller !== layer.previousController) {
                        object.userData.idleMotion?.update(0);
                        layer.previousController = controller;
                    }

                    controller.update(currentTime, ambientTime);
                });
            },
        });
    });

    //output
    return {
        play(objectId, bindingName) {
            const activation = activations.get(objectId)?.get(bindingName);

            if (!activation) {
                console.warn(`Unknown animation binding: ${objectId}.${bindingName}`);
                return false;
            }

            activation.play();
            return true;
        },
        seek(objectId, bindingName, progress) {
            const activation = activations.get(objectId)?.get(bindingName);

            if (!activation) {
                console.warn(`Unknown animation binding: ${objectId}.${bindingName}`);
                return false;
            }

            if (!Number.isFinite(progress)) {
                console.warn("Animation progress must be a finite number.");
                return false;
            }

            activation.seek(progress);
            return true;
        },
        update(currentTime, ambientTime) {
            controllers.forEach((controller) => {
                controller.update(currentTime, ambientTime);
            });
        },
        updateScroll(scrollPosition, viewportHeight) {
            scrollBindings.forEach((bindings) => {
                let earliestBinding = null;
                let earliestStart = Infinity;
                let activeBinding = null;
                let activeStart = -Infinity;

                bindings.forEach((binding) => {
                    const unitSize = binding.unit === "vh" ? viewportHeight / 100 : 1;
                    const start = binding.start * unitSize;

                    if (start < earliestStart) {
                        earliestBinding = binding;
                        earliestStart = start;
                    }

                    if (start <= scrollPosition && start >= activeStart) {
                        activeBinding = binding;
                        activeStart = start;
                    }
                });

                const binding = activeBinding ?? earliestBinding;
                const unitSize = binding.unit === "vh" ? viewportHeight / 100 : 1;
                
                const start = binding.start * unitSize;
                const end = binding.end * unitSize;
                
                binding.seek((scrollPosition - start) / (end - start));
            });
        },
        destroy() {
            unsubscribeEvents.forEach((unsubscribe) => {
                unsubscribe();
            });
            activations.clear();
            scrollBindings.clear();
            controllers.length = 0;
        },
    };
}
