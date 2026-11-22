export function createSequenceClock(duration, loop = false) {
    let elapsed = 0;
    let direction = 1;
    let previousTime = null;

    function getProgress() {
        return elapsed / duration;
    }

    function seek(progress) {
        if (!Number.isFinite(progress)) {
            throw new Error("Sequence progress must be finite.");
        }

        elapsed = Math.max(0, Math.min(1, progress)) * duration;
        previousTime = null;
    }

    function setDirection(nextDirection) {
        if (nextDirection !== 1 && nextDirection !== -1) {
            throw new Error("Sequence direction must be 1 or -1.");
        }

        if (direction === nextDirection) {
            return;
        }

        direction = nextDirection;
        previousTime = null;
    }

    function restart() {
        elapsed = 0;
        direction = 1;
        previousTime = null;
    }

    function update(currentTime) {
        if (previousTime !== null) {
            const deltaTime = Math.max(0, currentTime - previousTime);

            elapsed += deltaTime * direction;

            if (loop) {
                elapsed = ((elapsed % duration) + duration) % duration;
            } else {
                elapsed = Math.max(0, Math.min(duration, elapsed));
            }
        }

        previousTime = currentTime;

        return getProgress();
    }

    return {
        getProgress,
        seek,
        setDirection,
        restart,
        update,
    };
}
