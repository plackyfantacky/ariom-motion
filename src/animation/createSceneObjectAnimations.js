import { createCameraSequenceEvaluator } from "./createCameraSequenceEvaluator.js";
import { createObjectSequenceEvaluator } from "./createObjectSequenceEvaluator.js";
import { createDomSequenceEvaluator } from "./createDomSequenceEvaluator.js";
import { resolveAnimationBindings } from "./resolveAnimationBindings.js";
import { createSequenceClock } from "./createSequenceClock.js";
import { createScrollAnimationController } from "./createScrollAnimationController.js";

export function createSceneObjectAnimations(sceneObjects, sequences = {}, events) {
    const controllers = [];
    const unsubscribeEvents = [];
    const scrollAnimations = createScrollAnimationController();
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
            const isCameraObject = object.userData.type === "camera";

            if ((isDomObject || isCameraObject) && layerName !== "primary") {
                throw new Error("DOM and camera animations currently support the primary layer only.");
            }

            if (layerName === "additive" && sequence.rotationSpace !== "local") {
                throw new Error("Additive animation requires local rotation space.");
            }

            if (!layers.has(layerName)) {
                layers.set(layerName, {
                    activeBinding: null,
                    previousController: null,
                    scheduled: [],
                    scrollSelection: null,
                    scrollPlayback: null,
                });
            }

            const layer = layers.get(layerName);
            const target = layerName === "additive" ? object.userData.motionGroup : object.userData.poseGroup;

            let evaluator;

            if (isCameraObject) {
                evaluator = createCameraSequenceEvaluator(object, sequence, binding.play);
            } else if (isDomObject) {
                evaluator = createDomSequenceEvaluator(object, sequence, binding.play);
            } else {
                evaluator = createObjectSequenceEvaluator(object, sequence, binding.play, target);
            }

            const duration = evaluator.duration;
            const clock = createSequenceClock(duration, binding.loop);

            let idleStartTime = null;
            let playbackMode = "scheduled";

            function activate() {
                layer.activeBinding = bindingName;
                layer.scrollPlayback = null;

                clock.restart();

                playbackMode = "playing";
                idleStartTime = null;

                object.userData.idleMotion?.update(0);
            }

            function setDirection(direction) {
                layer.activeBinding = bindingName;
                layer.scrollPlayback = null;

                clock.setDirection(direction);
                clock.seek(clock.getProgress());

                playbackMode = "playing";
                idleStartTime = null;

                object.userData.idleMotion?.update(0);
            }

            objectActivations.set(bindingName, {
                play: activate,
                setDirection,

                seek(progress) {
                    layer.activeBinding = bindingName;
                    layer.scrollPlayback = null;

                    clock.seek(progress);
                    clock.setDirection(1);

                    playbackMode = "held";
                    idleStartTime = null;
                },
            });

            if (hasOn) {
                unsubscribeEvents.push(events.on(binding.on, activate));
            }

            const controller = {
                update(currentTime, ambientTime) {
                    if (playbackMode === "held") {
                        evaluator.apply(clock.getProgress());
                        return;
                    }

                    if (binding.loop && hasAt && playbackMode === "scheduled" && currentTime >= binding.at) {
                        clock.restart();
                        playbackMode = "playing";
                    }

                    let progress;

                    if (playbackMode === "playing") {
                        progress = clock.update(ambientTime);
                    } else if (hasAt) {
                        clock.seek((currentTime - binding.at) / duration);
                        progress = clock.getProgress();
                    } else {
                        return;
                    }

                    evaluator.apply(progress);

                    const hasFinished = !binding.loop && (clock.getDirection() === 1 ? progress === 1 : progress === 0);

                    if (hasFinished) {
                        if (idleStartTime === null) {
                            idleStartTime = ambientTime;
                        }

                        object.userData.idleMotion?.update(ambientTime - idleStartTime);
                    } else {
                        idleStartTime = null;
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
                scrollAnimations.register(layer, {
                    ...binding.scroll,
                    mode: binding.scroll.mode ?? "scrub",
                    direction: binding.scroll.direction ?? "down",
                    once: binding.scroll.once ?? true,
                    reverseOnReturn: binding.scroll.reverseOnReturn ?? false,
                    hasPlayed: false,
                    play: activate,
                    seek: objectActivations.get(bindingName).seek,
                    setDirection: objectActivations.get(bindingName).setDirection,
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
        setDirection(objectId, bindingName, direction) {
            const activation = activations.get(objectId)?.get(bindingName);

            if (!activation) {
                console.warn(`Unknown animation binding: ${objectId}.${bindingName}`);
                return false;
            }

            if (direction !== 1 && direction !== -1) {
                console.warn("Animation direction must be 1 or -1.");
                return false;
            }

            activation.setDirection(direction);
            return true;
        },
        update(currentTime, ambientTime) {
            controllers.forEach((controller) => {
                controller.update(currentTime, ambientTime);
            });
        },
        updateScroll: scrollAnimations.updateScroll,
        destroy() {
            unsubscribeEvents.forEach((unsubscribe) => {
                unsubscribe();
            });
            activations.clear();
            scrollAnimations.clear();
            controllers.length = 0;
        },
    };
}
