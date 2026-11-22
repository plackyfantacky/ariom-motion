import { createObjectSequenceEvaluator } from "./createObjectSequenceEvaluator.js";
import { createDomSequenceEvaluator } from "./createDomSequenceEvaluator.js";
import { resolveAnimationBindings } from "./resolveAnimationBindings.js";
import { createSequenceClock } from "./createSequenceClock.js";

export function createSceneObjectAnimations(sceneObjects, sequences = {}, events) {
    const controllers = [];
    const unsubscribeEvents = [];
    const scrollBindings = new Map();
    const activations = new Map();
    let previousScrollPosition = null;

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
                    scrollSelection: null,
                    scrollPlayback: null,
                });
            }

            const layer = layers.get(layerName);
            const target = layerName === "additive" ? object.userData.motionGroup : object.userData.poseGroup;

            const evaluator = isDomObject
                ? createDomSequenceEvaluator(object, sequence, binding.play)
                : createObjectSequenceEvaluator(object, sequence, binding.play, target);

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
                if (!scrollBindings.has(layer)) {
                    scrollBindings.set(layer, []);
                }

                scrollBindings.get(layer).push({
                    ...binding.scroll,
                    mode: binding.scroll.mode ?? "scrub",
                    direction: binding.scroll.direction ?? "down",
                    once: binding.scroll.once ?? true,
                    hasPlayed: false,
                    play: activate,
                    seek: objectActivations.get(bindingName).seek,
                    reverseOnReturn: binding.scroll.reverseOnReturn ?? false,
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
        updateScroll(scrollPosition, viewportHeight, isScrolling = false) {
            const hasMoved = previousScrollPosition !== null && scrollPosition !== previousScrollPosition;

            const movingDown = hasMoved && scrollPosition > previousScrollPosition;

            scrollBindings.forEach((bindings, layer) => {
                let earliestBinding = null;
                let earliestStart = Infinity;
                let activeBinding = null;
                let activeStart = -Infinity;

                let triggeredBinding = null;
                let triggeredDirection = 1;
                let triggeredStart = movingDown ? -Infinity : Infinity;

                if (!isScrolling && layer.scrollPlayback) {
                    return;
                }

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

                    if (binding.mode !== "play" || !isScrolling || !hasMoved) {
                        return;
                    }

                    const crossedDown = movingDown && previousScrollPosition <= start && scrollPosition > start;
                    const crossedUp = !movingDown && previousScrollPosition > start && scrollPosition <= start;
                    const matchesDirection = (crossedDown && binding.direction !== "up") || (crossedUp && binding.direction !== "down");

                    const isReturnCrossing =
                        binding.reverseOnReturn && ((binding.direction === "down" && crossedUp) || (binding.direction === "up" && crossedDown));

                    if (!matchesDirection && !isReturnCrossing) {
                        return;
                    }

                    if (isReturnCrossing && !binding.hasPlayed) {
                        return;
                    }

                    if (!isReturnCrossing && binding.once && binding.hasPlayed) {
                        return;
                    }

                    if (!triggeredBinding || (movingDown && start >= triggeredStart) || (!movingDown && start <= triggeredStart)) {
                        triggeredBinding = binding;
                        triggeredStart = start;
                        triggeredDirection = isReturnCrossing ? -1 : 1;
                    }
                });

                const binding = activeBinding ?? earliestBinding;
                const unitSize = binding.unit === "vh" ? viewportHeight / 100 : 1;

                const start = binding.start * unitSize;
                const selectionChanged = layer.scrollSelection !== binding;

                if (selectionChanged) {
                    layer.scrollSelection = binding;
                    layer.scrollPlayback = null;
                }

                const isBeforeTrigger = binding.direction === "up" ? scrollPosition > start : scrollPosition <= start;
                const shouldReset = !binding.reverseOnReturn && binding.direction !== "both" && isBeforeTrigger;

                if (binding.mode === "scrub" && !layer.scrollPlayback) {
                    const end = binding.end * unitSize;
                    binding.seek((scrollPosition - start) / (end - start));
                } else if (binding.mode === "play" && (selectionChanged || shouldReset)) {
                    binding.seek(isBeforeTrigger ? 0 : 1);
                }

                const triggerCanTakeControl = triggeredBinding && (!movingDown || triggeredBinding === binding);

                if (triggerCanTakeControl) {
                    if (triggeredBinding.reverseOnReturn) {
                        triggeredBinding.setDirection(triggeredDirection);
                    } else {
                        triggeredBinding.play();
                    }

                    if (triggeredDirection === 1) {
                        triggeredBinding.hasPlayed = true;
                    }

                    layer.scrollPlayback = triggeredBinding;
                }
            });

            previousScrollPosition = scrollPosition;
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
