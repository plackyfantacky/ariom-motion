export function resolveAnimationBindings(definitions = {}, objectId) {
    return Object.entries(definitions).map(([name, definition]) => {
        const binding = typeof definition === "string" ? { play: definition } : definition;

        const identifier = `${objectId}.${name}`;

        const definesAt = binding.at !== undefined;
        const definesOn = binding.on !== undefined;
        const definesScroll = binding.scroll !== undefined;

        const triggerCount = Number(definesAt) + Number(definesOn) + Number(definesScroll);

        const hasAt = definesAt && triggerCount === 1;
        const hasOn = definesOn && triggerCount === 1;
        const hasScroll = definesScroll && triggerCount === 1;

        if (triggerCount > 1) {
            console.warn(`Animation "${identifier}" ` + "defines multiple automatic controls. Automatic activation disabled.");
        }

        if (hasAt && (!Number.isFinite(binding.at) || binding.at < 0)) {
            throw new Error(`Animation "${identifier}" requires a non-negative "at".`);
        }

        if (hasOn && (typeof binding.on !== "string" || binding.on.trim() === "")) {
            throw new Error(`Animation "${identifier}" requires a non-empty "on".`);
        }

        if (hasScroll) {
            const scroll = binding.scroll;

            if (!scroll || !Number.isFinite(scroll.start) || scroll.start < 0) {
                throw new Error(`Animation "${identifier}" requires a non-negative scroll start.`);
            }

            if (!["px", "vh"].includes(scroll.unit)) {
                throw new Error(`Animation "${identifier}" requires scroll unit "px" or "vh".`);
            }

            const mode = scroll.mode ?? "scrub";

            if (!["scrub", "play"].includes(mode)) {
                throw new Error(`Animation "${identifier}" requires scroll mode "scrub" or "play".`);
            }

            if (mode === "scrub") {
                if (!Number.isFinite(scroll.end) || scroll.end <= scroll.start) {
                    throw new Error(`Animation "${identifier}" requires a scroll end ` + "greater than start.");
                }
            } else {
                const direction = scroll.direction ?? "down";

                if (!["down", "up", "both"].includes(direction)) {
                    throw new Error(`Animation "${identifier}" requires scroll direction ` + '"down", "up", or "both".');
                }

                if (scroll.once !== undefined && typeof scroll.once !== "boolean") {
                    throw new Error(`Animation "${identifier}" requires a boolean scroll "once".`);
                }

                if (scroll.end !== undefined) {
                    throw new Error(`Animation "${identifier}" uses scroll mode "play", ` + 'which does not use "end".');
                }
            }
        }

        return {
            name,
            binding,
            hasAt,
            hasOn,
            hasScroll,
        };
    });
}
