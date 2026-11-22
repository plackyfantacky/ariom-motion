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

            if (!scroll || !Number.isFinite(scroll.start) || !Number.isFinite(scroll.end) || scroll.start < 0 || scroll.end <= scroll.start) {
                throw new Error(`Animation "${identifier}" requires a non-negative scroll ` + "start and an end greater than start.");

            }

            if (!["px", "vh"].includes(scroll.unit)) {
                throw new Error(`Animation "${identifier}" requires scroll unit "px" or "vh".`);
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
