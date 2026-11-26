/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CameraManager.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-10-08
 * Last modified: 2026-11-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
  CURRENT_CAMERA,
  CURRENT_MAP_POINT,
  CURRENT_POI,
  CURRENT_STORE,
  FOCUS_STARTER,
  JOURNEYS_STORE,
  MILLIS,
  MINUTE,
} from "@Core/constants";

import { MapTarget } from "@Core/MapTarget";
import {
  normalizeOrbitDirection,
  normalizeOrbitRPM,
} from "@Core/OrbitSettings";
import { CameraUtils } from "@Utils/cesium/CameraUtils.js";
import { getSceneRenderScheduler, requestSceneRender } from "@Utils/cesium/SceneRenderScheduler";
import { UIToast } from "@Utils/UIToast";
import {getMainSceneCameraPivot} from "@Core/ui/MainSceneCameraPivot"
import { Cartesian3, Cartographic, HeadingPitchRange, Math as CesiumMath, Matrix4 } from "cesium"
import { snapshot } from "valtio";
import { deepClone } from "valtio/utils";
import { Journey } from "../Journey";
import {isCameraOwnedByReplay, replayCameraOwnershipRevision} from "./replay/ReplayCameraOwnership"

const finiteNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const targetHeightOf = (target) => target?.simulatedHeight ?? target?.height;

const hasMapCoordinates = (target) =>
  finiteNumber(target?.longitude) !== null &&
  finiteNumber(target?.latitude) !== null &&
  finiteNumber(targetHeightOf(target)) !== null;

const hasCameraCoordinates = (position) =>
  finiteNumber(position?.longitude) !== null &&
  finiteNumber(position?.latitude) !== null &&
  finiteNumber(position?.height) !== null;

const CAMERA_LOCAL_STORAGE_KEY = 'lgs1920.camera.snapshot';
const ORBIT_RESOLUTION_SCALE = 1
const ORBIT_MAXIMUM_TERRAIN_SCREEN_SPACE_ERROR = 8

const readLocalCamera = () => {
  try {
    const value = window.localStorage.getItem(CAMERA_LOCAL_STORAGE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const writeLocalCamera = camera => {
  try {
    window.localStorage.setItem(CAMERA_LOCAL_STORAGE_KEY, JSON.stringify(camera));
  } catch {
    // IndexedDB remains the durable fallback when localStorage is unavailable.
  }
};

const orbitRangeForHeight = (height, targetHeight, pitch, fallbackRange) => {
  const relativeHeight = Number(height) - Number(targetHeight);
  const pitchSine = Math.sin(Math.abs(Number(pitch)));

  if (
    !Number.isFinite(relativeHeight) ||
    !Number.isFinite(pitchSine) ||
    pitchSine <= 0.000001
  ) {
    return fallbackRange;
  }

  return Math.max(1, Math.abs(relativeHeight) / pitchSine);
};

export class CameraManager {
  static CLOCKWISE = true;
  static NORMAL = "normal";
  static ROTATE = "rotate";

  target = {};
  position = {};
  orbitalInPause = false;
  saveTimer = null;
  flightLocks = 0;
  renderQuality = {
    locks: 0,
    msaaSamples: null,
    shadows: null,
    scene: null,
    globe: null,
    maximumScreenSpaceError: null,
    continuousReleases: [],
  };
  #panoramicCancel = null;
  #orbitResolution = null
  activeOrbitRetarget = null;

  constructor(settings) {
    // Singleton
    if (CameraManager.instance) {
      return CameraManager.instance;
    }
    this.proxy = CameraUtils;
    (async () => await this.readCameraInformation())();
    this.settings = settings;

    this.clockwise = CameraManager.CLOCKWISE;
    this.store = lgs.stores.main.components.camera;
    this.move = { type: null, stopWatching: null, animation: null };

    // we track window resizing to get
    // target coordinates in pixels
    window.addEventListener("resize", () => {
      this.targetInPixels();
      this.raiseUpdateEvent();
    });

    // Let's save the information before new window content
    window.addEventListener("beforeunload", () =>
      this.saveInformation(Date.now())
    );

    CameraManager.instance = this;
  }

  set settings(settings) {
    this.target.longitude = settings?.target?.longitude; //?? lgs.settings.getStarter.longitude
    this.target.latitude = settings?.target?.latitude; //?? lgs.settings.getStarter.latitude
    this.target.height = settings?.target?.height; //?? lgs.settings.getStarter.height;
    this.targetInPixels();

    this.position.longitude =
      settings?.position?.longitude ?? lgs.settings.camera.longitude;
    this.position.latitude =
      settings?.position?.latitude ?? lgs.settings.camera.latitude;
    this.position.height =
      settings?.position?.height ?? lgs.settings.camera.height;

    this.position.heading =
      settings?.position?.heading ?? lgs.settings.camera.heading;
    this.position.pitch =
      settings?.position?.pitch ?? lgs.settings.camera.pitch;
    this.position.roll = settings?.position?.roll ?? lgs.settings.camera.roll;
    this.position.range =
      settings?.position?.range ?? lgs.settings.camera.range;
  }

  get settings() {
    return {
      position: this.position,
      target: this.target,
    };
  }

  targetInPixels = () => {
    const pixels = this.proxy.getTargetPositionInPixels(this.target);
    this.target.x = pixels?.x;
    this.target.y = pixels?.y;
  };

  /** Retarget a running map-wide orbit when the user selects a new camera pivot. */
  retargetActiveRotationToMapPivot = position => {
    const camera = lgs.camera ?? lgs.viewer?.camera;
    const rotate = lgs.stores?.ui?.mainUI?.rotate;
    if (!position || !camera || !rotate || !this.activeOrbitRetarget || !this.isRotating()
      || rotate.target?.element === CURRENT_POI || isCameraOwnedByReplay(camera)) {
      return false;
    }

    const cartographic = Cartographic.fromCartesian(position);
    if (!cartographic) return false;
    const longitude = CesiumMath.toDegrees(cartographic.longitude);
    const latitude = CesiumMath.toDegrees(cartographic.latitude);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return false;

    const height = __.ui.sceneManager?.noRelief?.() ? 0 : cartographic.height;
    const target = new MapTarget(CURRENT_MAP_POINT, {
      height,
      id: `${CURRENT_MAP_POINT}:${longitude.toFixed(6)}:${latitude.toFixed(6)}`,
      latitude,
      longitude,
    });
    target.simulatedHeight = height;
    target.title = "Map pivot";
    return this.activeOrbitRetarget(target);
  };

  /**
   *
   * @param target
   * @return {boolean}
   */
  lookingAtTheSky = (target = this.target) => {
    return (
      target.longitude === undefined &&
      target.latitude === undefined &&
      target.height === undefined
    );
  };

  /**
   * Let's update ad save information
   *
   * @return {Promise<void>}
   */
  raiseUpdateEvent = async (options = {}) => {
    await this.updatePositionInformation(options);
  };

  stopWatching = () => {
    if (this.move.stopWatching) {
      this.move.stopWatching();
      this.move.stopWatching = null;
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }
  };

  getCurrentUpdateOptions = () => {
    if (
      lgs.stores.ui.mainUI.rotate.running &&
      hasMapCoordinates(lgs.stores.ui.mainUI.rotate.target)
    ) {
      return {
        skipTargetPick: true,
        target: lgs.stores.ui.mainUI.rotate.target,
      };
    }

    if (
      lgs.stores.ui.mainUI.panorama.active &&
      hasMapCoordinates(lgs.stores.ui.mainUI.panorama.target)
    ) {
      return {
        skipTargetPick: true,
        target: lgs.stores.ui.mainUI.panorama.target,
      };
    }

    return {};
  };

  /** Read the normal map pose only while Replay has released its camera. */
  syncPositionInformation = (options = this.getCurrentUpdateOptions()) => {
    if (isCameraOwnedByReplay(lgs.camera ?? lgs.viewer?.camera)) return null
    const data = this.proxy.updatePositionInformationSync?.(null, options)
    if (!data) {
      return null
    }

    this.settings = data
    this.clone()

    if (lgs.theJourney) {
      lgs.theJourney.camera = snapshot(this.store)
    }

    return data
  }

  /**
   * Save camera information
   *
   * @param last is the reference time (ie the last known)
   *
   */
  saveInformation = async (last, { sync = true } = {}) => {
    if (isCameraOwnedByReplay(lgs.camera ?? lgs.viewer?.camera)) return
    if (sync) {
      this.syncPositionInformation()
    }

    if (Date.now() - last >= lgs.configuration.db.IDBDelay * MILLIS) {
      clearInterval(this.saveTimer)
      this.saveTimer = null
    }
    const currentCamera = snapshot(this.store)
    if (!hasMapCoordinates(currentCamera.target) || !hasCameraCoordinates(currentCamera.position)) {
      return
    }

    writeLocalCamera(currentCamera)

    const writes = [
      lgs.db.lgs1920.put(CURRENT_CAMERA, currentCamera, CURRENT_STORE),
    ]
    if (lgs.theJourney) {
      lgs.theJourney.camera = currentCamera
      writes.push(lgs.db.lgs1920.put(
        lgs.theJourney.slug,
        Journey.unproxify(snapshot(lgs.theJourney)),
        JOURNEYS_STORE
      ))
    }
    await Promise.all(writes)
  }

  /**
   * Start watching camera information in order to save it.
   *
   * @return {Promise<void>}
   */
  startWatching = async () => {
    if (this.saveTimer) {
      return;
    }
    const date = Date.now();
    this.saveInformation(date);
    this.saveTimer = setInterval(
      this.saveInformation.bind(this),
      lgs.configuration.db.IDBDelay * MILLIS,
      date
    );
  };

  /**
   * Read Camera information in local database
   *
   * @return {Promise<*|null>}
   */
  readCameraInformation = async ({ fallback = true } = {}) => {
    let data = readLocalCamera();
    if (!data || !hasMapCoordinates(data.target) || !hasCameraCoordinates(data.position)) {
      data = await lgs.db.lgs1920.get(CURRENT_CAMERA, CURRENT_STORE);
    }
    if (!data || __.app.isEmpty(data.target)) {
      return fallback ? this.focusToStarterPOI() : null;
    }
    return data;
  };

  /** Resume normal camera persistence when no animation or Replay owns the camera. */
  enableMapDragging = () => {
    const camera = lgs.camera ?? lgs.viewer?.camera
    if (this.isRotating() || this.isFlying() || isCameraOwnedByReplay(camera)) {
      return
    }

    if (this.move.type === CameraManager.NORMAL && this.move.stopWatching) {
      return;
    }

    // Stop any camera position tracking
    this.stopWatching();

    // Set move event
    lgs.camera.percentageChanged = lgs.settings.camera.percentageChanged;

    this.move = {
      type: CameraManager.NORMAL,
      stopWatching: lgs.camera.changed.addEventListener(async () => {
        if (!this.saveTimer) {
          await this.startWatching();
        }
      }),
    };
  };

  beginFlight = () => {
    this.flightLocks += 1;
    if (lgs.stores?.ui?.mainUI?.cameraFlight) {
      lgs.stores.ui.mainUI.cameraFlight.running = true;
    }
  };

  endFlight = () => {
    this.flightLocks = Math.max(0, this.flightLocks - 1);
    if (lgs.stores?.ui?.mainUI?.cameraFlight) {
      lgs.stores.ui.mainUI.cameraFlight.running = this.flightLocks > 0;
    }
  };

  isFlying = () => Boolean(lgs.stores?.ui?.mainUI?.cameraFlight?.running);

  /**
   * Update and maintain camera position
   *
   * @return {Promise<void>}
   */
  updatePositionInformation = async (options = {}) => {
    const camera = lgs.camera ?? lgs.viewer?.camera
    if (isCameraOwnedByReplay(camera)) return
    const revision = replayCameraOwnershipRevision(camera)
    const data = await this.proxy.updatePositionInformation(null, options)
    // Reject reads that overlap a Replay camera lease, even after handback.
    if (isCameraOwnedByReplay(camera) || revision !== replayCameraOwnershipRevision(camera)) return
    // Update Camera Manager information
    if (data) {
      this.settings = data
    } else {
      this.resetCameraInformation()
    }
    // Update camera proxy
    this.clone()

    // Update Journey Camera if needed
    if (lgs.theJourney) {
      lgs.theJourney.camera = snapshot(lgs.stores.main.components.camera)
    }
  }

  /**
   * Clone the position
   */
  clone = () => {
    lgs.stores.main.components.camera.position = deepClone(this.position);
    lgs.stores.main.components.camera.target = deepClone(this.target);
  };

  /** Lower scene quality during a continuous camera animation and acquire a render demand. */
  optimizeContinuousCameraRender = () => {
    if (!lgs.viewer) {
      return;
    }

    const scene = lgs.scene ?? lgs.viewer.scene;
    const releaseContinuous = getSceneRenderScheduler(scene)?.acquireContinuous();
    this.renderQuality.continuousReleases.push(releaseContinuous ?? null);
    this.renderQuality.locks += 1;
    if (this.renderQuality.locks !== 1) {
      return;
    }

    this.renderQuality.scene = scene;
    this.renderQuality.msaaSamples = scene?.msaaSamples ?? null;
    if (scene?.msaaSamples > 1) {
      scene.msaaSamples = 1;
    }

    this.renderQuality.shadows = scene?.shadows ?? null;
    if (scene?.shadows) {
      scene.shadows = false;
    }

    const globe = scene?.globe
    const maximumScreenSpaceError = Number(globe?.maximumScreenSpaceError)
    this.renderQuality.globe = globe ?? null
    this.renderQuality.maximumScreenSpaceError = Number.isFinite(maximumScreenSpaceError)
      ? maximumScreenSpaceError
      : null
    if (Number.isFinite(maximumScreenSpaceError)
      && maximumScreenSpaceError < ORBIT_MAXIMUM_TERRAIN_SCREEN_SPACE_ERROR) {
      // Coarser terrain reduces tile refinement work while the camera continuously changes its view.
      globe.maximumScreenSpaceError = ORBIT_MAXIMUM_TERRAIN_SCREEN_SPACE_ERROR
    }
  };

  /** Release one continuous-render consumer and restore quality after the final release. */
  restoreContinuousCameraRender = () => {
    if (this.renderQuality.locks === 0) {
      return;
    }

    this.renderQuality.continuousReleases.pop()?.();
    this.renderQuality.locks -= 1;
    if (this.renderQuality.locks > 0) {
      return;
    }

    const scene = this.renderQuality.scene;
    const activeScene = lgs.scene ?? lgs.viewer?.scene;
    if (!scene || scene !== activeScene || scene.isDestroyed?.()) {
      this.renderQuality.msaaSamples = null;
      this.renderQuality.shadows = null;
      this.renderQuality.scene = null;
      this.renderQuality.globe = null;
      this.renderQuality.maximumScreenSpaceError = null;
      return;
    }

    let shouldRequestRender = false;
    if (scene && this.renderQuality.msaaSamples !== null) {
      scene.msaaSamples = this.renderQuality.msaaSamples;
      this.renderQuality.msaaSamples = null;
      shouldRequestRender = true;
    }
    if (scene && this.renderQuality.shadows !== null) {
      scene.shadows = this.renderQuality.shadows;
      this.renderQuality.shadows = null;
      shouldRequestRender = true;
    }
    const globe = this.renderQuality.globe
    if (globe && scene.globe === globe && this.renderQuality.maximumScreenSpaceError !== null) {
      if (globe.maximumScreenSpaceError !== this.renderQuality.maximumScreenSpaceError) {
        globe.maximumScreenSpaceError = this.renderQuality.maximumScreenSpaceError
        shouldRequestRender = true
      }
    }
    this.renderQuality.maximumScreenSpaceError = null
    this.renderQuality.globe = null
    if (shouldRequestRender) {
      requestSceneRender(scene);
    }
    this.renderQuality.scene = null;
  };

  /** Lower the main viewer resolution for the duration of a map orbit. */
  lowerOrbitResolution = () => {
    const viewer = lgs.viewer
    const scene = lgs.scene ?? viewer?.scene
    const resolutionScale = Number(viewer?.resolutionScale)
    if (!viewer || !scene || !Number.isFinite(resolutionScale) || resolutionScale <= ORBIT_RESOLUTION_SCALE) {
      return false
    }

    this.#orbitResolution = {viewer, scene, resolutionScale}
    viewer.resolutionScale = ORBIT_RESOLUTION_SCALE
    requestSceneRender(scene)
    return true
  }

  /** Restore the viewer resolution captured before the active map orbit. */
  restoreOrbitResolution = () => {
    const orbitResolution = this.#orbitResolution
    this.#orbitResolution = null
    const activeScene = lgs.scene ?? orbitResolution?.viewer?.scene
    if (!orbitResolution || orbitResolution.viewer !== lgs.viewer
      || orbitResolution.scene !== activeScene
      || orbitResolution.viewer.isDestroyed?.()
      || orbitResolution.scene.isDestroyed?.()) {
      return false
    }

    orbitResolution.viewer.resolutionScale = orbitResolution.resolutionScale
    requestSceneRender(orbitResolution.scene)
    return true
  }

  /**
   * Get the data of the camera instance
   */
  get = () => {
    return this;
  };

  /**
   * Reset the camera settings management.
   *
   *
   */
  resetCameraInformation = () => {
    this.settings = this.focusToStarterPOI();
  };

  /**
   * Reset the camera information to target
   *
   * @return the camera position nd settings
   */
  focusToStarterPOI = () => {
    return {
      target: {
        longitude: lgs.settings.starter.longitude,
        latitude: lgs.settings.starter.latitude,
        height: lgs.settings.starter.height,
      },

      position: {
        longitude: undefined,
        latitude: undefined,
        height: undefined,
        heading: lgs.settings.camera.heading,
        pitch: lgs.settings.camera.pitch,
        roll: lgs.settings.camera.roll,
        range: lgs.settings.camera.range,
      },
    };
  };

  /**
   * Look at a specific point
   *
   * @param point target : data in degrees, meters
   *
   * point is in the form: {
   *      latitude,longitude,height,
   *      camera:{heading,pitch,roll,range}
   *      }
   */
  lookAt = (point) => {
    this.proxy.lookAt(lgs.camera, point, point.camera);
  };

  /**
   * Rotate around a specific point
   *
   *
   * @param point
   * @param options
   * @return {Promise<void>}
   */
  rotateAround = async (point = null, options) => {
    // Let's stop any rotation
    await this.stopRotate();
    this.activeOrbitRetarget = null;

    // And any related event
    this.stopWatching();

    __.ui.sceneManager.startRotate;

    if (point === null) {
      //take current settings from proxy
      const settings = snapshot(this.store);
      const scene = lgs.scene ?? lgs.viewer?.scene
      const camera = lgs.camera ?? lgs.viewer?.camera
      const pivot = getMainSceneCameraPivot(scene, camera)
      const cartographic = pivot && settings.target?.element !== CURRENT_POI
        ? Cartographic.fromCartesian(pivot)
        : null
      point = cartographic
        ? {
            longitude: CesiumMath.toDegrees(cartographic.longitude),
            latitude: CesiumMath.toDegrees(cartographic.latitude),
            height: cartographic.height,
            simulatedHeight: cartographic.height,
            camera: settings.position,
          }
        : {
            ...settings.target,
            camera: settings.position,
          }
    }

    const preserveView = options?.preserveView === true;
    const cameraPosition = preserveView
      ? snapshot(this.store).position
      : point.camera;

    // Update target and camera position
    this.settings = {
      target: {
        longitude: point.longitude,
        latitude: point.latitude,
        height: point.height,
        simulatedHeight: point.simulatedHeight ?? point.height,
      },
      position: {
        heading: cameraPosition.heading,
        pitch: cameraPosition.pitch,
        roll: cameraPosition.roll,
        range: cameraPosition.range,
      },
    };

    // Set some configuration parameters
    const $rotate = lgs.stores.ui.mainUI.rotate;
    $rotate.rpm = normalizeOrbitRPM(options?.rpm ?? $rotate.rpm);
    $rotate.direction = normalizeOrbitDirection(
      options?.direction ?? $rotate.direction
    );
    $rotate.heightOffset = 0;
    $rotate.heightAdjustmentUntil = 0;

    const infinite = options?.infinite ?? true;
    const rotations = options?.rotations ?? lgs.settings.camera.rotations;
    const lookAt = options?.lookAt ?? true;

    // Do we need a camera pre-positioning ?
    if (preserveView) {
      this.proxy.setOrbitTransform(lgs.camera, point);
      requestSceneRender(lgs.scene);
    } else if (lookAt) {
      this.lookAt(point);
      requestSceneRender(lgs.scene);
    }
    // Set the initial spinner speed and keep writes out of the animation hot path.
    let lastAppliedEffectiveRpm = $rotate.rpm * Math.abs($rotate.direction)
    __.ui.css.setCSSVariable(
      "--map-rotation-speed",
      `${60 / Math.max(lastAppliedEffectiveRpm, 0.2)}s`
    )

    let totalRotation = 0;
    const totalTurns = rotations * 2 * Math.PI;
    lgs.camera.percentageChanged = lgs.settings.camera.percentageChanged;
    lgs.camera.orbitalPercentageChanged =
      lgs.settings.camera.orbitalPercentageChanged;
    const baseOrbitCameraHeight = Number(
      lgs.camera?.positionCartographic?.height
    );
    let baseOrbitTargetHeight = Number(point.simulatedHeight ?? point.height);
    const orbitCamera = lgs.camera ?? lgs.viewer?.camera;
    const orbitHeightWorldPosition = new Cartesian3();
    const orbitHeightLocalOffset = new Cartesian3();
    let appliedOrbitHeightOffset = 0;
    const applyOrbitHeightWithPitch = (nextHeight) => {
      const heading = Number(lgs.camera?.heading);
      const pitch = Number(lgs.camera?.pitch);
      const fallbackRange = lgs.camera?.position
        ? Cartesian3.magnitude(lgs.camera.position)
        : undefined;
      const range = orbitRangeForHeight(
        nextHeight,
        baseOrbitTargetHeight,
        pitch,
        fallbackRange
      );

      if (
        !Number.isFinite(heading) ||
        !Number.isFinite(pitch) ||
        !Number.isFinite(range)
      ) {
        return false;
      }

      lgs.camera.lookAtTransform(
        lgs.camera.transform,
        new HeadingPitchRange(heading, pitch, range)
      );
      return true;
    };
    const applyOrbitHeightOffset = () => {
      const heightOffset = Number($rotate.heightOffset);
      const cartographic = lgs.camera?.positionCartographic;
      if (
        !lgs.camera ||
        !cartographic ||
        !Number.isFinite(baseOrbitCameraHeight) ||
        !Number.isFinite(heightOffset) ||
        !Number.isFinite(cartographic.longitude) ||
        !Number.isFinite(cartographic.latitude)
      ) {
        return false;
      }
      if (heightOffset === appliedOrbitHeightOffset) {
        return false;
      }

      const nextHeight = Math.max(1, baseOrbitCameraHeight + heightOffset);
      if (!applyOrbitHeightWithPitch(nextHeight)) {
        Cartesian3.fromRadians(
          cartographic.longitude,
          cartographic.latitude,
          nextHeight,
          undefined,
          orbitHeightWorldPosition
        );
        Matrix4.multiplyByPoint(
          lgs.camera.inverseTransform,
          orbitHeightWorldPosition,
          orbitHeightLocalOffset
        );
        lgs.camera.lookAtTransform(lgs.camera.transform, orbitHeightLocalOffset);
      }
      appliedOrbitHeightOffset = heightOffset;
      return true;
    };

    this.activeOrbitRetarget = target => {
      const activeCamera = lgs.camera ?? lgs.viewer?.camera;
      const nextTargetHeight = Number(target.simulatedHeight ?? target.height);
      if (activeCamera !== orbitCamera || !this.isRotating() || !Number.isFinite(nextTargetHeight)) {
        return false;
      }

      this.proxy.setOrbitTransform(activeCamera, target);
      baseOrbitTargetHeight = nextTargetHeight;
      $rotate.target = target;
      this.syncPositionInformation({skipTargetPick: true, target});
      requestSceneRender(lgs.scene);
      return true;
    };

    let lastFrameTime = null;

    /** Advance the orbit and release its temporary resolution after an external stop. */
    const rotateCamera = () => {
      if (!this.isRotating()) {
        void this.stopRotate().catch(error => {
          console.error("[LGS1920][Camera] Failed to clean up an externally stopped orbit.", error)
        })
        return;
      }

      try {
        const currentTime = performance.now();
        if (lastFrameTime === null) {
          lastFrameTime = currentTime;
        }

        const elapsedSeconds = (currentTime - lastFrameTime) / MILLIS;
        lastFrameTime = currentTime;
        const rpm = normalizeOrbitRPM($rotate.rpm);
        const direction = normalizeOrbitDirection($rotate.direction);
        const effectiveRpm = rpm * Math.abs(direction);
        const angleRotation =
          ((2 * Math.PI) / (MINUTE / MILLIS)) * effectiveRpm * elapsedSeconds;
        const heightAdjustmentUntil = Number($rotate.heightAdjustmentUntil);
        const heightAdjusting =
          Number.isFinite(heightAdjustmentUntil) &&
          currentTime <= heightAdjustmentUntil;

        if ((lgs.camera && infinite) || totalRotation < totalTurns) {
          const heightOffset = Number($rotate.heightOffset);
          const heightOffsetChanged =
            Number.isFinite(heightOffset) &&
            heightOffset !== appliedOrbitHeightOffset;

          if (effectiveRpm > 0 && !heightAdjusting) {
            if (direction >= 0) {
              lgs.camera.rotateRight(angleRotation);
            } else {
              lgs.camera.rotateLeft(angleRotation);
            }
            if (heightOffsetChanged) {
              applyOrbitHeightOffset();
            }
            totalRotation += Math.abs(angleRotation);
            if (effectiveRpm !== lastAppliedEffectiveRpm) {
              __.ui.css.setCSSVariable(
                "--map-rotation-speed",
                `${60 / Math.max(effectiveRpm, 0.2)}s`
              )
              lastAppliedEffectiveRpm = effectiveRpm
            }
          } else if (heightAdjusting || heightOffsetChanged) {
            applyOrbitHeightOffset();
          }
          this.move.animation = __.requestAnimationFrame(rotateCamera);
        } else {
          void this.stopRotate().catch(cleanupError => {
            console.error("[LGS1920][Camera] Failed to release a completed orbit.", cleanupError)
          })
          totalRotation = totalTurns;
        }
      } catch (error) {
        console.error("[LGS1920][Camera] Continuous orbit failed.", error);
        void this.stopRotate().catch(cleanupError => {
          console.error("[LGS1920][Camera] Failed to release the stopped orbit.", cleanupError);
        });
      }
    };

    try {
      this.lowerOrbitResolution()
      this.optimizeContinuousCameraRender();
      this.move = {
        type: CameraManager.ROTATE,
        animation: __.requestAnimationFrame(rotateCamera),
        stopWatching: null,
      };
    } catch (error) {
      try {
        this.restoreContinuousCameraRender();
      } catch (cleanupError) {
        console.error("[LGS1920][Camera] Failed to release an interrupted orbit.", cleanupError);
      }
      try {
        this.restoreOrbitResolution()
      } catch (cleanupError) {
        console.error("[LGS1920][Camera] Failed to restore the map resolution after an interrupted orbit.", cleanupError)
      }
      throw error;
    }
  };

  /**
   * Stop rotate mode
   *
   * @return {Promise<void>}
   */
  stopRotate = async () => {
    this.activeOrbitRetarget = null;
    const orbitIsActive = this.isRotating() || this.move.type === CameraManager.ROTATE
    if (orbitIsActive) {
      const target = lgs.stores.ui.mainUI.rotate.target;
      lgs.stores.ui.mainUI.rotate.running = false
      __.cancelAnimationFrame(this.move.animation);
      this.move.animation = null;
      this.move.type = null
      this.stopWatching();
      try {
        this.restoreContinuousCameraRender()
      } finally {
        try {
          this.restoreOrbitResolution()
        } finally {
          this.unlock()
        }
      }
      await this.updatePositionInformation(
        target
          ? {
              skipTargetPick: true,
              target,
            }
          : undefined
      );
      this.saveInformation(Date.now(), { sync: false });
      this.enableMapDragging();
      requestSceneRender(lgs.scene);
    }
  };

  /**
   * Check if rotate mode is on
   *
   * @return {boolean}
   */
  isRotating = (target) => {
    if (target) {
      return (
        lgs.stores.ui.mainUI.rotate.running &&
        // type and slug are not defined in geocoding
        lgs.stores.ui.mainUI.rotate.target?.element === target.element &&
        lgs.stores.ui.mainUI.rotate.target?.slug === target.slug
      );
    } else {
      return lgs.stores.ui.mainUI.rotate.running;
    }
  };
  /**
   * Reset focus to STARTER
   */
  reset = () => {
    lgs.settings.ui.camera.start.app = FOCUS_STARTER;
  };

  /**
   * Check app focus
   */
  isAppFocusOn = (type) => lgs.settings.ui.camera.start.app === type;

  /**
   * Check journey focus
   */
  isJourneyFocusOn = (type) => lgs.settings.ui.camera.start.journey === type;

  /**
   * Unlock the camera
   */
  unlock = () => {
    this.proxy.unlock(lgs.camera);
  };

  panoramic = () => {
    UIToast.warning({
      caption: `Panoramic is not yet available`,
      text: "Please use another feature!",
    });
  };
  /**
   * Register the active panorama motion cancellation callback.
   *
   * @param {Function|null} cancel - Callback that stops the panorama flight and animation frame.
   * @return {Function} Callback unregistering this exact panorama motion handler.
   */
  setPanoramicCancel = (cancel) => {
    this.#panoramicCancel = typeof cancel === "function" ? cancel : null;
    return () => {
      if (this.#panoramicCancel === cancel) {
        this.#panoramicCancel = null;
      }
    };
  };

  /**
   * Stop the active panorama flight and its render loop immediately.
   *
   * @return {boolean} Whether a panorama state or motion handler was active.
   */
  stopPanoramic = () => {
    const panorama = lgs.stores?.ui?.mainUI?.panorama;
    const cancel = this.#panoramicCancel;
    const wasActive = panorama?.active === true;
    this.#panoramicCancel = null;
    if (panorama) {
      panorama.active = false;
      panorama.target = false;
    }
    cancel?.();
    return Boolean(cancel || wasActive);
  };
}
