export async function loadDataset(source) {
    let dataset = source;

    if (typeof source === "string" || source instanceof URL) {
        const response = await fetch(source);

        if (!response.ok) {
            throw new Error(
                `Could not load dataset: ${source} (${response.status})`,
            );
        }

        dataset = await response.json();
    }

    if (!dataset || typeof dataset !== "object" || Array.isArray(dataset)) {
        throw new TypeError("A dataset object or JSON URL is required.");
    }

    return dataset;
}