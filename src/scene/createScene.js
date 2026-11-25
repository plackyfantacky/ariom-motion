import * as THREE from "three";

import { getStageSize } from "./stage.js";

import { createSceneObjects } from "./createSceneObjects.js";
import { createEnvironment } from "../environment/createEnvironment.js";
import { createLights } from "../lighting/createLights.js";
import { createShadowsController } from "../lighting/createShadowsController.js";
import { createBackgroundShader } from "../shaders/createBackgroundShader.js";
import { createOrbitControls } from "./createOrbitControls.js";
import { createCameraHandoff } from "./createCameraHandoff.js";

import { createEventBus } from "../events/createEventBus.js";
import { createPlaybackController } from "../animation/createPlaybackController.js";
import { createSceneObjectAnimations } from "../animation/createSceneObjectAnimations.js";

import { createObjectLocator } from "../interactions/createObjectLocator.js";
import { createObjectInteractions } from "../interactions/createObjectInteractions.js";

import { updateArrowAnimations } from "../animation/updateArrowAnimations.js";
import { getCameraDistanceOffset, handleResize as responsiveResize, positionSceneObjectsForViewport } from "./responsive.js";

import { renderArrowPaths } from "../arrows/renderArrowPaths.js";

import { sceneSettings } from "./sceneSettings.js";

export function createScene(mountElement, options = {}) {
    if (!mountElement) {
        throw new Error("createArrowCloudScene requires a mount element.");
    }

    const dataset = options.dataset;

    const animationSettings = {
        ...dataset.animationSettings,
        ...options.animationSettings,
    };

    const events = createEventBus();
    const playback = createPlaybackController(animationSettings);

    let arrowPaths = options.arrowPaths || dataset.arrowPaths;
    const stageSize = getStageSize(mountElement);

    const scene = new THREE.Scene();

    createEnvironment(scene, dataset.environment);

    const backgroundShader = createBackgroundShader(scene, dataset.shaders?.background);

    if (backgroundShader) {
        const backgroundSettings = dataset.shaders.background;

        scene.fog = new THREE.Fog(backgroundSettings.horizonColour ?? "#FFE4D3", backgroundSettings.fogNear ?? 10, backgroundSettings.fogFar ?? 35);
    }

    const camera = new THREE.PerspectiveCamera(
        sceneSettings.camera.fieldOfView,
        stageSize.width / stageSize.height,
        sceneSettings.camera.near,
        sceneSettings.camera.far,
    );

    const staticCamera = dataset.staticCamera;

    if (staticCamera) {
        camera.position.set(staticCamera.position.x, staticCamera.position.y, staticCamera.position.z);
        camera.quaternion.set(staticCamera.quaternion.x, staticCamera.quaternion.y, staticCamera.quaternion.z, staticCamera.quaternion.w).normalize();
        camera.up.set(staticCamera.up?.x ?? 0, staticCamera.up?.y ?? 1, staticCamera.up?.z ?? 0).normalize();
    } else {
        camera.position.set(0, 5, 12);
        camera.lookAt(0, 0, 0);
    }

    let viewportCamera = null;
    let hasManualCameraInteraction = false;
    const cameraHandoff = createCameraHandoff(0.4);
    const pathLayoutCamera = camera.clone();

    pathLayoutCamera.updateProjectionMatrix();

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
    });

    renderer.setSize(stageSize.width, stageSize.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    createShadowsController(renderer, dataset);
    createLights(scene, dataset.lighting);

    // camera
    let cameraLocked = false;
    let orbitInteractionEnabled = true;
    let cameraAnimationEnabled = true;

    let cameraAnimationActive = false;
    let pendingCameraPose = null;
    let completedCameraPose = null;

    let wasSceneOrbitEnabled = false;

    const cameraMovement = new THREE.Vector3();
    const sequenceCameraPosition = new THREE.Vector3();

    // reusable camera orbit controls. for use in both editor and frontend modes.
    const authoredTarget = staticCamera?.target ? new THREE.Vector3(staticCamera.target.x, staticCamera.target.y, staticCamera.target.z) : null;
    const targetDistance = authoredTarget ? camera.position.distanceTo(authoredTarget) : 10;
    const orbitTarget = camera.position.clone().addScaledVector(camera.getWorldDirection(new THREE.Vector3()), targetDistance);

    let orbitControls = createOrbitControls({
        camera,
        domElement: renderer.domElement,
        target: orbitTarget,
        enabled: orbitInteractionEnabled && !cameraLocked,
    });

    orbitControls.addEventListener("start", handleSceneOrbitStart);

    const scriptedCameraPose = {
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
        up: camera.up.clone(),
        target: orbitControls.target.clone(),
    };

    const cameraOrbit = {
        getControls() {
            return orbitControls;
        },

        rebuild(target) {
            orbitControls.dispose();

            orbitControls = createOrbitControls({
                camera,
                domElement: renderer.domElement,
                target,
                enabled: orbitInteractionEnabled && !cameraLocked && !cameraAnimationActive,
            });

            orbitControls.update();
            orbitControls.addEventListener("start", handleSceneOrbitStart);

            return orbitControls;
        },

        setEnabled(isEnabled) {
            orbitInteractionEnabled = isEnabled;
            syncOrbitInteraction();
        },

        setLocked(isLocked) {
            const wasLocked = cameraLocked;
            cameraLocked = isLocked;

            if (isLocked && !wasLocked && cameraAnimationEnabled && hasManualCameraInteraction) {
                beginCameraHandoff();
            }

            syncOrbitInteraction();
        },

        isLocked() {
            return cameraLocked;
        },

        queuePose(pose) {
            pendingCameraPose = pose;
        },
    };

    const sceneObjects = createSceneObjects(scene, dataset.sceneObjects, { camera, cameraOrbit });

    positionSceneObjectsForViewport(sceneObjects, pathLayoutCamera, mountElement);
    const objectAnimations = createSceneObjectAnimations(sceneObjects, dataset.sequences, events);

    mountElement.appendChild(renderer.domElement);

    const arrowMaterial = new THREE.MeshStandardMaterial({
        color: 0xff9d2a,
        roughness: 0.45,
        metalness: 0.15,
        flatShading: true,
        side: THREE.FrontSide,
    });

    const beforeRenderListeners = new Set();
    const frameListeners = new Set();
    const pathRebuildListeners = new Set();

    let renderedArrowItems = [];
    let arrows = [];

    rebuildArrowPaths();

    /* prettier-ignore */
    const getObjectAtPointer = createObjectLocator(
        scene, 
        getRenderCamera, 
        renderer.domElement
    );

    const objectInteractions = createObjectInteractions(renderer.domElement, {
        getObjectAtPointer,
        emit: events.emit,
    });

    const timer = new THREE.Timer();
    let animationFrameId = null;
    let isDestroyed = false;

    // helpers

    function handleSceneOrbitStart() {
        hasManualCameraInteraction = true;
    }

    function getRenderCamera() {
        return viewportCamera ?? camera;
    }

    function setViewportCamera(nextCamera) {
        viewportCamera = nextCamera;

        if (viewportCamera) {
            const size = getStageSize(mountElement);

            viewportCamera.aspect = size.width / size.height;
            viewportCamera.updateProjectionMatrix();
        }
    }

    function syncOrbitInteraction() {
        const shouldEnable = orbitInteractionEnabled && !cameraLocked && !cameraAnimationActive && !cameraHandoff.isActive();

        if (shouldEnable && !orbitControls.enabled) {
            const target = orbitControls.target.clone();
            const zoomEnabled = orbitControls.enableZoom;

            camera.up.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();

            // OrbitControls caches its up frame during construction.
            cameraOrbit.rebuild(target);
            orbitControls.enableZoom = zoomEnabled;
        }

        orbitControls.enabled = shouldEnable;
    }

    function rebuildArrowPaths() {
        const renderState = renderArrowPaths({
            scene,
            pathLayoutCamera,
            mountElement,
            createArrowMaterial() {
                const material = arrowMaterial.clone();

                material.transparent = true;
                material.opacity = 1;

                return material;
            },
            fieldSettings: sceneSettings.field,
            previousRenderedArrowItems: renderedArrowItems,
            arrowPaths,
        });

        renderedArrowItems = renderState.renderedArrowItems;
        arrows = renderState.arrows;

        pathRebuildListeners.forEach((listener) => {
            listener(renderedArrowItems);
        });
    }

    function applyCameraSequencePose(deltaTime) {
        const pose = pendingCameraPose;

        if (!cameraAnimationEnabled) {
            cameraHandoff.cancel();
            cameraAnimationActive = false;
            syncOrbitInteraction();
            return;
        }

        if (!pose || !pose.complete) {
            completedCameraPose = null;
        }

        const shouldApplyPose = Boolean(pose && (!pose.complete || completedCameraPose !== pose));

        if (shouldApplyPose && hasManualCameraInteraction) {
            beginCameraHandoff();
        }

        // Evaluate from authored state, not last frame's blended result.
        if (cameraHandoff.isActive()) {
            restoreScriptedCameraPose();
        }

        cameraAnimationActive = shouldApplyPose || cameraHandoff.isActive();

        syncOrbitInteraction();

        if (shouldApplyPose) {
            if (pose.position) {
                sequenceCameraPosition.copy(pose.position);

                if (pose.responsiveDistance) {
                    sequenceCameraPosition.z += getCameraDistanceOffset(mountElement);
                }

                if (!pose.target) {
                    cameraMovement.copy(sequenceCameraPosition).sub(camera.position);

                    orbitControls.target.add(cameraMovement);
                }

                camera.position.copy(sequenceCameraPosition);
            }

            if (pose.target) {
                orbitControls.target.copy(pose.target);
                camera.lookAt(orbitControls.target);
            }

            // Save the authored destination before applying the blend.
            rememberScriptedCameraPose();

            if (pose.complete) {
                completedCameraPose = pose;
            }
        }

        cameraHandoff.apply(deltaTime, camera, orbitControls.target);
    }

    function rememberScriptedCameraPose() {
        scriptedCameraPose.position.copy(camera.position);
        scriptedCameraPose.quaternion.copy(camera.quaternion);
        scriptedCameraPose.up.copy(camera.up);
        scriptedCameraPose.target.copy(orbitControls.target);
    }

    function restoreScriptedCameraPose() {
        camera.position.copy(scriptedCameraPose.position);
        camera.quaternion.copy(scriptedCameraPose.quaternion);
        camera.up.copy(scriptedCameraPose.up);
        orbitControls.target.copy(scriptedCameraPose.target);
    }

    function beginCameraHandoff() {
        if (cameraHandoff.isActive()) {
            return;
        }

        cameraHandoff.start(camera, orbitControls.target);
        hasManualCameraInteraction = false;

        // Rebuild once to discard remaining orbit damping.
        cameraAnimationActive = true;
        cameraOrbit.rebuild(orbitControls.target.clone());

        syncOrbitInteraction();
    }

    function animate() {
        if (isDestroyed) {
            return;
        }

        animationFrameId = requestAnimationFrame(animate);
        timer.update();

        const deltaTime = timer.getDelta();
        const currentTime = playback.update(deltaTime);
        const ambientTime = timer.getElapsed();

        pendingCameraPose = null;
        objectAnimations.update(currentTime, ambientTime);

        frameListeners.forEach((listener) => {
            listener({
                deltaTime,
                currentTime,
                ambientTime,
            });
        });

        applyCameraSequencePose(deltaTime);

        // if (orbitControls.enabled) {
        //     orbitControls.update();
        // }

        const isSceneOrbitEnabled = orbitControls.enabled;

        if (isSceneOrbitEnabled) {
            const justEnabled = !wasSceneOrbitEnabled;

            const previousQuaternion = justEnabled ? camera.quaternion.clone() : null;

            orbitControls.update();

            if (justEnabled) {
                const adjustment = THREE.MathUtils.radToDeg(previousQuaternion.angleTo(camera.quaternion));

                console.log("Orbit activation adjustment:", adjustment, "degrees");
            }
        }

        wasSceneOrbitEnabled = isSceneOrbitEnabled;

        updateArrowAnimations({
            renderedArrowItems,
            currentTime,
            ambientTime,
        });

        sceneObjects.forEach((object) => {
            object.userData.updateModifiers?.();
        });

        renderFrame();
    }

    function renderFrame() {
        const restoreCallbacks = [];

        try {
            beforeRenderListeners.forEach((listener) => {
                const restore = listener();

                if (typeof restore === "function") {
                    restoreCallbacks.push(restore);
                }
            });

            renderer.render(scene, getRenderCamera());
        } finally {
            restoreCallbacks.reverse().forEach((restore) => {
                restore();
            });
        }
    }

    function handleScroll(event) {
        objectAnimations.updateScroll(window.scrollY, window.innerHeight, event?.type === "scroll");
    }

    function handleResize() {
        if (pendingCameraPose?.responsiveDistance) {
            completedCameraPose = null;
        }

        const cameras = [camera, pathLayoutCamera];

        if (viewportCamera) {
            cameras.push(viewportCamera);
        }

        responsiveResize(mountElement, cameras, renderer);

        positionSceneObjectsForViewport(sceneObjects, pathLayoutCamera, mountElement);

        rebuildArrowPaths();
        handleScroll();
    }

    function destroy() {
        if (isDestroyed) {
            return;
        }

        orbitControls.dispose();

        events.clear();

        isDestroyed = true;
        frameListeners.clear();
        pathRebuildListeners.clear();
        beforeRenderListeners.clear();

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }

        window.removeEventListener("resize", handleResize);
        window.removeEventListener("scroll", handleScroll);

        scene.traverse((object) => {
            if (object.geometry) {
                object.geometry.dispose();
            }

            if (Array.isArray(object.material)) {
                object.material.forEach((material) => {
                    material.dispose();
                });

                return;
            }

            if (object.material) {
                object.material.dispose();
            }
        });

        objectInteractions.destroy();
        objectAnimations.destroy();

        sceneObjects.forEach((object) => {
            object.userData.destroy?.();
        });

        sceneObjects.clear();
        renderer.dispose();

        if (renderer.domElement.parentElement) {
            renderer.domElement.parentElement.removeChild(renderer.domElement);
        }
    }

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, {
        passive: true,
    });

    handleScroll();
    objectAnimations.update(playback.state.currentTime, 0);

    animationFrameId = requestAnimationFrame(animate);

    return {
        scene,
        camera,
        cameraOrbit,
        renderer,
        mountElement,
        on: events.on,
        emit: events.emit,
        playback,
        setInteractionsEnabled: objectInteractions.setEnabled,
        playAnimation: objectAnimations.play,
        seekAnimation: objectAnimations.seek,
        setAnimationDirection: objectAnimations.setDirection,
        setViewportCamera,
        resize: handleResize,
        destroy,

        getArrowPaths() {
            return arrowPaths;
        },

        setArrowPaths(nextArrowPaths) {
            arrowPaths = nextArrowPaths;
            rebuildArrowPaths();
        },

        getRenderedArrowItems() {
            return renderedArrowItems;
        },

        getArrows() {
            return arrows;
        },

        setCameraAnimationEnabled(isEnabled) {
            if (isEnabled && !cameraAnimationEnabled) {
                completedCameraPose = null;
            }

            cameraAnimationEnabled = isEnabled;
        },

        onFrame(listener) {
            frameListeners.add(listener);

            return () => {
                frameListeners.delete(listener);
            };
        },

        onPathsRebuilt(listener) {
            pathRebuildListeners.add(listener);

            return () => {
                pathRebuildListeners.delete(listener);
            };
        },

        onBeforeRender(listener) {
            beforeRenderListeners.add(listener);

            return () => {
                beforeRenderListeners.delete(listener);
            };
        },

        getSceneObject(objectId) {
            return sceneObjects.get(objectId) ?? null;
        },
    };
}
