import datasetNames from "../generated/datasets.json";

export function readEditorUrlOptions(defaultDatasetName) {
    const searchParams = new URLSearchParams(window.location.search);
    const requestedDatasetName = searchParams.get("dataset");

    const distanceParam = searchParams.get("distance");
    const cameraDistance = distanceParam === null ? null : Number(distanceParam);

    return {
        datasetName: datasetNames.includes(requestedDatasetName) ? requestedDatasetName : defaultDatasetName,
        cameraView: searchParams.get("view"),
        cameraDistance: Number.isFinite(cameraDistance) ? cameraDistance : null,
    };
}

export function selectEditorDataset(datasetName) {
    const url = new URL(window.location.href);

    url.searchParams.set("dataset", datasetName);
    window.location.assign(url);
}
