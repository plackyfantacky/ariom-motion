export function createScrollAnimationController() {
    const scrollBindings = new Map();
    let previousScrollPosition = null;

    return {
        register(layer, binding) {
            if (!scrollBindings.has(layer)) {
                scrollBindings.set(layer, []);
            }

            scrollBindings.get(layer).push(binding);
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

        clear() {
            scrollBindings.clear();
            previousScrollPosition = null;
        },
    };
}