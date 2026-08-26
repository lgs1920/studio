/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PanoramaWidget.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-23
 * Last modified: 2026-05-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
  CURRENT_POI,
  LGS_WIDGET,
  MILLIS,
  SCENE_WIDGETS,
  SCENE_WIDGETS_BOARD,
} from "@Core/constants";
import {
  ORBIT_RPM_MAX,
  ORBIT_RPM_MIN,
  ORBIT_RPM_STEP,
  PANORAMA_HEIGHT_OFFSET_MAX,
  PANORAMA_HEIGHT_OFFSET_MIN,
  PANORAMA_HEIGHT_OFFSET_STEP,
  PANORAMA_PITCH_MAX,
  PANORAMA_PITCH_MIN,
  PANORAMA_PITCH_STEP,
  normalizeOrbitDirection,
  normalizeOrbitRPM,
  persistOrbitSettings,
  normalizePanoramaHeightOffset,
  normalizePanoramaPitch,
} from "@Core/OrbitSettings";
import { Widget } from "@Components/MainUI/widgets/Widget";
import { OrbitInteractionHintsToggleButton } from "@Components/MainUI/OrbitInteractionHintsWidget";
import { faAngle, faMagnifyingGlassLocation, faVideo } from "@fortawesome/pro-regular-svg-icons";
import { FA2SL } from "@Utils/FA2SL";
import { foot, meter, UnitUtils } from "@Utils/UnitUtils";
import { cameraViewToSlippyLevel } from "@Utils/cesium/CameraLevel";
import {
  buildCameraTransferPath,
  selectCameraTransferMode,
} from "@Core/ui/replay/JourneyReplayCameraPath";
import { Cartesian3, Math as M } from "cesium";
import {
  WaButton,
  WaCard,
  WaIcon,
  WaSlider,
  WaTooltip,
} from "@web.awesome.me/webawesome-pro/dist/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSnapshot } from "valtio";
import { scheduleCameraAdjustmentWidgetCenter } from "./cameraAdjustmentWidgetPosition";
import { getOrbitWidgetConfig } from "./orbitWidgetConfig";
import { getOrbitRPMGaugeIcon } from "./orbitWidgetPresentation";

const POINTER_PITCH_DEGREES_PER_PIXEL = 0.25;
const POINTER_HEIGHT_METERS_PER_PIXEL = 10;
const KEYBOARD_HEIGHT_STEP_METERS = 100;
const KEYBOARD_FAST_HEIGHT_STEP_METERS = 10;
const KEYBOARD_FINE_HEIGHT_STEP_METERS = 1;
const INTERACTION_PERSIST_DELAY = 400;
const ADJUSTMENT_OVERLAY_DELAY = 2000;
const PANORAMA_ADJUSTMENT_WIDGET = "panorama-adjustment-widget";
const EDITABLE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "wa-input",
  "wa-textarea",
  "wa-select",
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role="textbox"]',
].join(",");

const hasFinePointer = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(any-pointer: fine)").matches ?? false);
const wheelHeightMetersPerStep = (event) => {
  if (event.ctrlKey) return KEYBOARD_FINE_HEIGHT_STEP_METERS;
  if (event.shiftKey) {
    return KEYBOARD_FAST_HEIGHT_STEP_METERS;
  }
  return KEYBOARD_HEIGHT_STEP_METERS;
};
const isEditableTarget = (target) => {
  const ElementClass = globalThis.Element;
  if (!ElementClass || !(target instanceof ElementClass)) {
    return false;
  }
  if (target.matches('input[type="range"]')) {
    return false;
  }
  return Boolean(target.closest(EDITABLE_SELECTOR));
};
const isPlusKey = (event) =>
  event.key === "+" ||
  event.code === "NumpadAdd" ||
  event.key?.toLowerCase() === "plus" ||
  (event.code === "Equal" && (event.ctrlKey || event.shiftKey));
const isMinusKey = (event) =>
  event.key === "-" ||
  event.code === "Minus" ||
  event.code === "NumpadSubtract" ||
  event.key?.toLowerCase() === "minus";
const panoramaHeightKeyboardDirection = (event) => {
  if (event.key === "ArrowUp") {
    return 1;
  }
  if (event.key === "ArrowDown") {
    return -1;
  }
  return 0;
};
const panoramaHeightKeyboardStep = (event) => {
  if (event.ctrlKey) {
    return KEYBOARD_FINE_HEIGHT_STEP_METERS;
  }
  if (event.shiftKey) {
    return KEYBOARD_FAST_HEIGHT_STEP_METERS;
  }
  return KEYBOARD_HEIGHT_STEP_METERS;
};
const orbitRPMKeyboardDirection = (event) => {
  if (isPlusKey(event)) {
    return 1;
  }
  if (isMinusKey(event)) {
    return -1;
  }
  return 0;
};
const orbitDirectionKeyboardSign = (event) => {
  if (event.key === "ArrowRight") {
    return 1;
  }
  if (event.key === "ArrowLeft") {
    return -1;
  }
  return 0;
};
const numericValueOf = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};
const panoramaBaseHeightOf = (target) =>
  numericValueOf(target?.simulatedHeight ?? target?.height ?? 0);
const panoramaCameraAltitudeOf = (target, heightOffset) =>
  panoramaBaseHeightOf(target) + numericValueOf(heightOffset);
const formatPanoramaCameraAltitude = (target, heightOffset) => {
  return UnitUtils.formatMetric(
    panoramaCameraAltitudeOf(target, heightOffset),
    {
      units: [meter, foot],
      precision: 0,
    }
  ).full;
};
const formatCameraAltitude = (height) =>
  UnitUtils.formatMetric(numericValueOf(height), {
    units: [meter, foot],
    precision: 0,
  }).full;
const formatPanoramaPitch = (pitch) => `${Math.round(numericValueOf(pitch))}°`;
const formatCameraAdjustmentValues = (position) => ({
  height: formatCameraAltitude(position?.height),
  pitch: formatPanoramaPitch(position?.pitch),
  level: position?.level ?? null,
});
const currentCameraMovementSnapshot = () => {
  const camera = lgs.camera;
  const cartographic = camera?.positionCartographic;
  if (!camera || !cartographic) {
    return null;
  }

  const key = [
    cartographic.longitude,
    cartographic.latitude,
    cartographic.height,
    camera.heading,
    camera.pitch,
    camera.roll,
  ]
    .map((value) =>
      Number.isFinite(Number(value)) ? Number(value).toFixed(6) : ""
    )
    .join("|");

  if (!key.replaceAll("|", "")) {
    return null;
  }

  return {
    key,
    position: {
      height: cartographic.height,
      pitch: M.toDegrees(camera.pitch ?? 0),
      level: cameraViewToSlippyLevel(camera, lgs.scene ?? lgs.viewer?.scene, {
        imageryProvider: lgs.viewer?.imageryLayers?.get?.(0)?.imageryProvider,
        fallbackHeight: cartographic.height,
      }),
    },
  };
};

export const PanoramaWidget = memo(() => {
  const $panorama = lgs.stores.ui.mainUI.panorama;
  const panorama = useSnapshot($panorama);
  const rotate = useSnapshot(lgs.stores.ui.mainUI.rotate);
  const cameraSettings = useSnapshot(lgs.settings.ui.camera);
  const { toolBar } = useSnapshot(lgs.settings.ui.menu);
  useSnapshot(lgs.settings.unitSystem);
  useSnapshot(lgs.stores.ui.device);
  const [finePointer, setFinePointer] = useState(hasFinePointer);
  const animationRef = useRef(null);
  const lastFrameRef = useRef(null);
  const headingRef = useRef(0);
  const heightOffsetRef = useRef(panorama.heightOffset);
  const pitchRef = useRef(panorama.pitch);
  const rpmRef = useRef(panorama.rpm);
  const directionRef = useRef(panorama.direction);
  const controllerStateRef = useRef(null);
  const interactionPersistTimerRef = useRef(null);
  const adjustmentOverlayTimerRef = useRef(null);
  const centerAdjustmentCancelRef = useRef(null);
  const [adjustmentVisible, setAdjustmentVisible] = useState(false);
  const [adjustmentValues, setAdjustmentValues] = useState(() => ({
    height: formatPanoramaCameraAltitude(
      panorama.target,
      panorama.heightOffset
    ),
    pitch: formatPanoramaPitch(panorama.pitch),
  }));
  const showCameraMovementWidget = cameraSettings.showMovementWidget ?? true;
  const standardCameraKeyRef = useRef(null);
  const standardCameraFrameRef = useRef(null);
  const config = useMemo(
    () => getOrbitWidgetConfig("panorama-widget", toolBar.fromStart),
    [toolBar.fromStart]
  );
  const adjustmentConfig = useMemo(
    () => ({
      attachTo: "center",
      contextMenu: {
        canRemove: false,
      },
      draggable: true,
      dynamic: true,
      group: SCENE_WIDGETS,
      id: PANORAMA_ADJUSTMENT_WIDGET,
      left: "50%",
      margin: lgs.gutter.s,
      opacity: 1,
      persist: false,
      resizable: false,
      rotatable: false,
      scalable: false,
      snappable: true,
      stopPropagation: true,
      top: "50%",
      transient: true,
      type: LGS_WIDGET,
      widgetsBoard: SCENE_WIDGETS_BOARD,
      zIndex: 11950,
    }),
    []
  );

  heightOffsetRef.current = normalizePanoramaHeightOffset(
    panorama.heightOffset
  );
  pitchRef.current = normalizePanoramaPitch(panorama.pitch);
  rpmRef.current = panorama.rpm;
  directionRef.current = panorama.direction;

  const centerAdjustmentWidget = useCallback(() => {
    centerAdjustmentCancelRef.current?.();
    centerAdjustmentCancelRef.current = scheduleCameraAdjustmentWidgetCenter(
      PANORAMA_ADJUSTMENT_WIDGET
    );
  }, []);

  useEffect(() => {
    const finePointerQuery = window.matchMedia?.("(any-pointer: fine)");
    if (!finePointerQuery) {
      return;
    }

    const updatePointerMode = () => setFinePointer(finePointerQuery.matches);
    updatePointerMode();
    finePointerQuery.addEventListener("change", updatePointerMode);

    return () =>
      finePointerQuery.removeEventListener("change", updatePointerMode);
  }, []);

  const adjustmentWidgetMounted = panorama.active || showCameraMovementWidget;

  useEffect(() => {
    if (!adjustmentWidgetMounted) {
      centerAdjustmentCancelRef.current?.();
      centerAdjustmentCancelRef.current = null;
      return undefined;
    }

    centerAdjustmentWidget();

    const handleResize = () => centerAdjustmentWidget();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      centerAdjustmentCancelRef.current?.();
      centerAdjustmentCancelRef.current = null;
    };
  }, [adjustmentWidgetMounted, centerAdjustmentWidget]);

  useEffect(() => {
    if (!panorama.active) {
      return;
    }

    const heightOffset = normalizePanoramaHeightOffset(panorama.heightOffset);
    const pitch = normalizePanoramaPitch(panorama.pitch);

    if (heightOffset !== panorama.heightOffset) {
      $panorama.heightOffset = heightOffset;
    }
    if (pitch !== panorama.pitch) {
      $panorama.pitch = pitch;
    }
  }, [$panorama, panorama.active, panorama.heightOffset, panorama.pitch]);

  const stopPropagation = useCallback((event) => {
    event.stopPropagation();
  }, []);

  const blockWidgetDrag = useCallback((event) => {
    event.stopPropagation();
    event.nativeEvent?.stopImmediatePropagation?.();
  }, []);

  const setPoiAnimated = useCallback(
    async (animated) => {
      if (panorama.target?.element !== CURRENT_POI) {
        return;
      }

      const poiId = panorama.target.slug ?? panorama.target.id;
      if (!poiId) {
        return;
      }

      const poi = lgs.stores.main.components.pois.list.get(poiId);
      if (poi?.animated !== animated) {
        await __.ui.poiManager.updatePOI(poiId, { animated });
      }
    },
    [panorama.target]
  );

  const persistPanoramaSettings = useCallback(
    (updates = {}) => {
      void persistOrbitSettings(panorama.target, "panorama", updates);
    },
    [panorama.target]
  );

  const hideAdjustmentOverlay = useCallback(() => {
    setAdjustmentVisible(false);
    if (lgs.stores.ui.widget.current?.id === PANORAMA_ADJUSTMENT_WIDGET) {
      lgs.stores.ui.widget.current = { id: null };
    }
  }, []);

  const showAdjustmentValues = useCallback(
    (values) => {
      setAdjustmentValues(values);
      setAdjustmentVisible(true);

      if (adjustmentOverlayTimerRef.current) {
        window.clearTimeout(adjustmentOverlayTimerRef.current);
      }

      adjustmentOverlayTimerRef.current = window.setTimeout(() => {
        hideAdjustmentOverlay();
        adjustmentOverlayTimerRef.current = null;
      }, ADJUSTMENT_OVERLAY_DELAY);
    },
    [hideAdjustmentOverlay]
  );

  const showAdjustmentOverlay = useCallback(
    (heightOffset, pitch) => {
      showAdjustmentValues({
        height: formatPanoramaCameraAltitude(panorama.target, heightOffset),
        pitch: formatPanoramaPitch(pitch),
        level: cameraViewToSlippyLevel(lgs.camera, lgs.scene ?? lgs.viewer?.scene, {
          imageryProvider: lgs.viewer?.imageryLayers?.get?.(0)?.imageryProvider,
          fallbackHeight: panoramaCameraAltitudeOf(panorama.target, heightOffset),
        }),
      });
    },
    [panorama.target, showAdjustmentValues]
  );

  const showCameraAdjustmentOverlay = useCallback(
    (position) => {
      showAdjustmentValues(formatCameraAdjustmentValues(position));
    },
    [showAdjustmentValues]
  );

  const schedulePersistPanoramaSettings = useCallback(
    (updates = {}) => {
      if (interactionPersistTimerRef.current) {
        window.clearTimeout(interactionPersistTimerRef.current);
      }

      interactionPersistTimerRef.current = window.setTimeout(() => {
        interactionPersistTimerRef.current = null;
        persistPanoramaSettings(updates);
      }, INTERACTION_PERSIST_DELAY);
    },
    [persistPanoramaSettings]
  );

  const setPanoramaHeightOffset = useCallback(
    (value, persist = false) => {
      const heightOffset = normalizePanoramaHeightOffset(
        value,
        heightOffsetRef.current
      );
      if (heightOffset === heightOffsetRef.current) {
        return;
      }

      heightOffsetRef.current = heightOffset;
      $panorama.heightOffset = heightOffset;
      showAdjustmentOverlay(heightOffset, pitchRef.current);

      if (persist) {
        schedulePersistPanoramaSettings({ heightOffset });
      }
    },
    [$panorama, schedulePersistPanoramaSettings, showAdjustmentOverlay]
  );

  const setPanoramaPitch = useCallback(
    (value, persist = false) => {
      const pitch = normalizePanoramaPitch(value, pitchRef.current);
      if (pitch === pitchRef.current) {
        return;
      }

      pitchRef.current = pitch;
      $panorama.pitch = pitch;
      showAdjustmentOverlay(heightOffsetRef.current, pitch);

      if (persist) {
        schedulePersistPanoramaSettings({ pitch });
      }
    },
    [$panorama, schedulePersistPanoramaSettings, showAdjustmentOverlay]
  );

  const setPanoramaRPM = useCallback(
    (value, persist = false) => {
      const rpm = normalizeOrbitRPM(value, rpmRef.current);
      if (rpm === rpmRef.current) {
        return;
      }

      rpmRef.current = rpm;
      $panorama.rpm = rpm;

      if (persist) {
        schedulePersistPanoramaSettings({ rpm });
      }
    },
    [$panorama, schedulePersistPanoramaSettings]
  );

  const setPanoramaDirectionSign = useCallback(
    (sign, persist = false) => {
      const currentMagnitude = Math.abs(Number(directionRef.current));
      const magnitude =
        Number.isFinite(currentMagnitude) && currentMagnitude > 0
          ? currentMagnitude
          : 1;
      const direction = normalizeOrbitDirection(
        sign * magnitude,
        directionRef.current
      );
      if (direction === directionRef.current) {
        return;
      }

      directionRef.current = direction;
      $panorama.direction = direction;

      if (persist) {
        schedulePersistPanoramaSettings({ direction });
      }
    },
    [$panorama, schedulePersistPanoramaSettings]
  );

  const handleAdjustmentWheel = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!panorama.active) {
        return;
      }
      const direction = Math.sign(event.deltaY);
      if (direction === 0) {
        return;
      }
      setPanoramaHeightOffset(
        heightOffsetRef.current + direction * wheelHeightMetersPerStep(event),
        true
      );
    },
    [panorama.active, setPanoramaHeightOffset]
  );

  useEffect(() => {
    if (!panorama.active) {
      return;
    }

    const handleKeyDown = (event) => {
      if (event.altKey || event.metaKey || isEditableTarget(event.target)) {
        return;
      }

      const directionSign = event.ctrlKey
        ? 0
        : orbitDirectionKeyboardSign(event);
      if (directionSign !== 0) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        if (!event.repeat) {
          setPanoramaDirectionSign(directionSign, true);
        }
        return;
      }

      const rpmDirection = event.ctrlKey ? 0 : orbitRPMKeyboardDirection(event);
      if (rpmDirection !== 0) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        setPanoramaRPM(rpmRef.current + rpmDirection * ORBIT_RPM_STEP, true);
        return;
      }

      const heightDirection = panoramaHeightKeyboardDirection(event);
      if (heightDirection === 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      const step = panoramaHeightKeyboardStep(event);
      setPanoramaHeightOffset(
        heightOffsetRef.current + heightDirection * step,
        true
      );
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });

    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [
    panorama.active,
    setPanoramaDirectionSign,
    setPanoramaHeightOffset,
    setPanoramaRPM,
  ]);

  const closePanorama = useCallback(
    (event) => {
      event?.stopPropagation?.();
      $panorama.active = false;
      $panorama.target = false;
    },
    [$panorama]
  );

  const updateHeight = useCallback(
    (event) => {
      setPanoramaHeightOffset(event.target.value);
    },
    [setPanoramaHeightOffset]
  );

  const persistHeight = useCallback(
    (event) => {
      const heightOffset = normalizePanoramaHeightOffset(
        event.target.value,
        heightOffsetRef.current
      );
      persistPanoramaSettings({ heightOffset });
    },
    [persistPanoramaSettings]
  );

  const updatePitch = useCallback(
    (event) => {
      setPanoramaPitch(event.target.value);
    },
    [setPanoramaPitch]
  );

  const persistPitch = useCallback(
    (event) => {
      const pitch = normalizePanoramaPitch(
        event.target.value,
        pitchRef.current
      );
      persistPanoramaSettings({ pitch });
    },
    [persistPanoramaSettings]
  );

  const updateRPM = useCallback(
    (event) => {
      const value = Number(event.target.value);
      $panorama.rpm = value;
    },
    [$panorama]
  );

  const persistRPM = useCallback(
    (event) => {
      const value = Number(event.target.value);
      persistPanoramaSettings({ rpm: value });
    },
    [persistPanoramaSettings]
  );

  const toggleDirection = useCallback(
    (event) => {
      event?.stopPropagation?.();
      const direction = Number(directionRef.current) < 0 ? 1 : -1;
      directionRef.current = direction;
      $panorama.direction = direction;
      persistPanoramaSettings({ direction });
    },
    [$panorama, persistPanoramaSettings]
  );

  useEffect(() => {
    if (!panorama.active) {
      return;
    }

    const timeout = window.setTimeout(() => {
      showAdjustmentOverlay(heightOffsetRef.current, pitchRef.current);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [panorama.active, showAdjustmentOverlay]);

  useEffect(() => {
    const clearStandardCameraFrame = () => {
      if (standardCameraFrameRef.current !== null) {
        window.cancelAnimationFrame(standardCameraFrameRef.current);
        standardCameraFrameRef.current = null;
      }
    };
    let cancelled = false;
    let retryTimer = null;
    let removeChangedListener = null;

    const showCurrentCameraMovement = () => {
      if (standardCameraFrameRef.current !== null) {
        return;
      }

      standardCameraFrameRef.current = window.requestAnimationFrame(() => {
        standardCameraFrameRef.current = null;

        if (lgs.stores.ui.mainUI.panorama.active) {
          standardCameraKeyRef.current = null;
          return;
        }

        const snapshot = currentCameraMovementSnapshot();
        if (!snapshot || standardCameraKeyRef.current === snapshot.key) {
          return;
        }

        standardCameraKeyRef.current = snapshot.key;
        if (lgs.stores.ui.mainUI.rotate.running) {
          return;
        }

        showCameraAdjustmentOverlay(snapshot.position);
      });
    };

    if (!showCameraMovementWidget) {
      standardCameraKeyRef.current = null;
      clearStandardCameraFrame();
      if (!panorama.active) {
        hideAdjustmentOverlay();
      }
      return undefined;
    }

    const attachCameraListener = () => {
      if (cancelled) {
        return;
      }

      if (!lgs.camera?.changed) {
        retryTimer = window.setTimeout(
          attachCameraListener,
          ADJUSTMENT_OVERLAY_DELAY / 4
        );
        return;
      }

      standardCameraKeyRef.current =
        currentCameraMovementSnapshot()?.key ?? null;
      removeChangedListener = lgs.camera.changed.addEventListener(
        showCurrentCameraMovement
      );
    };

    if (panorama.active || !lgs.camera?.changed) {
      standardCameraKeyRef.current = null;
      clearStandardCameraFrame();
      if (!panorama.active) {
        attachCameraListener();
      }
      return () => {
        cancelled = true;
        removeChangedListener?.();
        if (retryTimer) {
          window.clearTimeout(retryTimer);
        }
        clearStandardCameraFrame();
      };
    }

    attachCameraListener();

    return () => {
      cancelled = true;
      removeChangedListener?.();
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
      clearStandardCameraFrame();
    };
  }, [
    hideAdjustmentOverlay,
    panorama.active,
    rotate.running,
    showCameraAdjustmentOverlay,
    showCameraMovementWidget,
  ]);

  useEffect(() => {
    if (rotate.running && !panorama.active) {
      hideAdjustmentOverlay();
    }
  }, [hideAdjustmentOverlay, panorama.active, rotate.running]);

  useEffect(() => {
    return () => {
      if (interactionPersistTimerRef.current) {
        window.clearTimeout(interactionPersistTimerRef.current);
        interactionPersistTimerRef.current = null;
      }
      centerAdjustmentCancelRef.current?.();
      centerAdjustmentCancelRef.current = null;
      if (adjustmentOverlayTimerRef.current) {
        window.clearTimeout(adjustmentOverlayTimerRef.current);
        adjustmentOverlayTimerRef.current = null;
      }
      hideAdjustmentOverlay();
    };
  }, [hideAdjustmentOverlay]);

  useEffect(() => {
    if (!panorama.active || !finePointer || !lgs.viewer?.canvas) {
      return;
    }

    const canvas = lgs.viewer.canvas;
    const drag = {
      active: false,
      mode: "pitch",
      startHeight: heightOffsetRef.current,
      startPitch: pitchRef.current,
      startY: 0,
    };

    const stopDragListeners = () => {
      document.removeEventListener("pointermove", handlePointerMove, true);
      document.removeEventListener("pointerup", handlePointerUp, true);
      document.removeEventListener("pointercancel", handlePointerUp, true);
    };

    const persistDragValue = () => {
      if (drag.mode === "height") {
        schedulePersistPanoramaSettings({
          heightOffset: heightOffsetRef.current,
        });
      } else {
        schedulePersistPanoramaSettings({ pitch: pitchRef.current });
      }
    };

    function handlePointerDown(event) {
      if (
        event.pointerType === "touch" ||
        ![0, 2].includes(event.button) ||
        !$panorama.active
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      drag.active = true;
      drag.mode =
        event.button === 2 || event.altKey || event.shiftKey
          ? "height"
          : "pitch";
      drag.startHeight = heightOffsetRef.current;
      drag.startPitch = pitchRef.current;
      drag.startY = event.clientY;

      document.addEventListener("pointermove", handlePointerMove, true);
      document.addEventListener("pointerup", handlePointerUp, true);
      document.addEventListener("pointercancel", handlePointerUp, true);
    }

    function handlePointerMove(event) {
      if (!drag.active) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const deltaY = event.clientY - drag.startY;
      if (drag.mode === "height") {
        setPanoramaHeightOffset(
          drag.startHeight - deltaY * POINTER_HEIGHT_METERS_PER_PIXEL
        );
      } else {
        setPanoramaPitch(
          drag.startPitch - deltaY * POINTER_PITCH_DEGREES_PER_PIXEL
        );
      }
    }

    function handlePointerUp(event) {
      if (!drag.active) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      drag.active = false;
      persistDragValue();
      stopDragListeners();
    }

    const handleWheel = (event) => {
      if (!$panorama.active) {
        return;
      }

      const direction = Math.sign(event.deltaY);
      if (direction === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      setPanoramaHeightOffset(
        heightOffsetRef.current + direction * wheelHeightMetersPerStep(event),
        true
      );
    };
    const handleContextMenu = (event) => {
      if (!$panorama.active) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    canvas.addEventListener("pointerdown", handlePointerDown, true);
    canvas.addEventListener("wheel", handleWheel, {
      capture: true,
      passive: false,
    });
    canvas.addEventListener("contextmenu", handleContextMenu, true);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown, true);
      canvas.removeEventListener("wheel", handleWheel, { capture: true });
      canvas.removeEventListener("contextmenu", handleContextMenu, true);
      stopDragListeners();
    };
  }, [
    $panorama,
    finePointer,
    panorama.active,
    schedulePersistPanoramaSettings,
    setPanoramaHeightOffset,
    setPanoramaPitch,
  ]);

  const showDirectPanoramaControls = !finePointer || __.device.isMobile;

  useEffect(() => {
    if (!panorama.active || !panorama.target) {
      return;
    }

    const target = panorama.target;
    if (
      !Number.isFinite(target.longitude) ||
      !Number.isFinite(target.latitude)
    ) {
      return;
    }

    __.ui.cameraManager.optimizeContinuousCameraRender();

    const controller = lgs.scene?.screenSpaceCameraController;
    if (controller) {
      controllerStateRef.current = {
        enableInputs: controller.enableInputs,
        enableLook: controller.enableLook,
        enableRotate: controller.enableRotate,
        enableTilt: controller.enableTilt,
        enableTranslate: controller.enableTranslate,
        enableZoom: controller.enableZoom,
      };

      controller.enableInputs = false;
      controller.enableLook = false;
      controller.enableRotate = false;
      controller.enableTilt = false;
      controller.enableTranslate = false;
      controller.enableZoom = false;
    }

    headingRef.current = Number.isFinite(panorama.heading)
      ? panorama.heading
      : M.toDegrees(lgs.camera.heading ?? 0);
    lastFrameRef.current = null;

    const renderFrame = () => {
      const baseHeight = target.simulatedHeight ?? target.height ?? 0;
      lgs.camera.setView({
        destination: Cartesian3.fromDegrees(
          target.longitude,
          target.latitude,
          baseHeight + heightOffsetRef.current
        ),
        orientation: {
          heading: M.toRadians(headingRef.current),
          pitch: M.toRadians(pitchRef.current),
          roll: 0,
        },
      });
    };

    const tick = (timestamp) => {
      if (!$panorama.active) {
        return;
      }

      if (lastFrameRef.current === null) {
        lastFrameRef.current = timestamp;
      }

      const elapsedSeconds = (timestamp - lastFrameRef.current) / MILLIS;
      lastFrameRef.current = timestamp;
      headingRef.current =
        (headingRef.current +
          rpmRef.current * directionRef.current * 6 * elapsedSeconds) %
        360;
      renderFrame();
      animationRef.current = window.requestAnimationFrame(tick);
    };

    void setPoiAnimated(true);

    let flightEnded = false;
    let cameraPathCancel = null;
    const endFlight = () => {
      if (!flightEnded) {
        flightEnded = true;
        __.ui.cameraManager.endFlight?.();
      }
    };
    /**
     * Stop the panorama transfer and its continuous rotation without waiting
     * for React to run the effect cleanup after the active state changes.
     *
     * @returns {void}
     */
    const cancelPanoramaMotion = () => {
      cameraPathCancel?.();
      cameraPathCancel = null;
      if (animationRef.current) {
        window.cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      endFlight();
    };
    const unregisterPanoramicCancel =
      __.ui.cameraManager.setPanoramicCancel?.(cancelPanoramaMotion);
    const startPanoramaRotation = () => {
      endFlight();
      if (!$panorama.active) {
        return;
      }
      renderFrame();
      animationRef.current = window.requestAnimationFrame(tick);
    };
    const cameraWorldPosition = lgs.camera?.positionWC ?? lgs.camera?.position;
    const cameraDestination = Cartesian3.fromDegrees(
      target.longitude,
      target.latitude,
      (target.simulatedHeight ?? target.height ?? 0) + heightOffsetRef.current
    );
    const transferThresholdKm =
      lgs.settings?.camera?.transferDistanceThresholdKm ?? 50;
    const transferDistance = cameraWorldPosition
      ? Cartesian3.distance(cameraWorldPosition, cameraDestination)
      : null;
    const transferMode = selectCameraTransferMode(
      transferDistance,
      transferThresholdKm
    );
    const cameraPath = cameraWorldPosition
      ? buildCameraTransferPath({
          start: cameraWorldPosition,
          end: cameraDestination,
          mode: transferMode,
          sampleCount: transferMode === "blur-jump-refocus" ? 64 : 48,
          liftMeters: Math.max(
            120,
            lgs.settings?.camera?.pitchAdjustHeight ?? 500
          ),
        })
      : null;

    __.ui.cameraManager.beginFlight?.();
    try {
      if (cameraPath) {
        cameraPathCancel = cameraPath.flyTo({
          camera: lgs.camera,
          orientation: {
            heading: M.toRadians(headingRef.current),
            pitch: M.toRadians(pitchRef.current),
            roll: 0,
          },
          duration: 0.8,
          complete: () => {
            cameraPathCancel = null;
            startPanoramaRotation();
          },
          cancel: () => {
            cameraPathCancel = null;
            endFlight();
          },
        });
      } else {
        lgs.camera.setView({
          destination: cameraDestination,
          orientation: {
            heading: M.toRadians(headingRef.current),
            pitch: M.toRadians(pitchRef.current),
            roll: 0,
          },
        });
        startPanoramaRotation();
      }
    } catch (error) {
      cameraPathCancel = null;
      endFlight();
      throw error;
    }

    return () => {
      unregisterPanoramicCancel?.();
      cancelPanoramaMotion();

      const nextController = lgs.scene?.screenSpaceCameraController;
      if (nextController && controllerStateRef.current) {
        Object.assign(nextController, controllerStateRef.current);
      }
      controllerStateRef.current = null;
      hideAdjustmentOverlay();
      __.ui.cameraManager.restoreContinuousCameraRender();
      void __.ui.cameraManager.raiseUpdateEvent();
      void setPoiAnimated(false);
    };
  }, [
    panorama.active,
    panorama.target,
    panorama.heading,
    $panorama,
    hideAdjustmentOverlay,
    setPoiAnimated,
  ]);

  const directionIsAntiClockwise = panorama.direction < 0;
  const directionTooltip = "Change direction";
  const directionIcon = directionIsAntiClockwise
    ? "arrow-rotate-right"
    : "arrow-rotate-left";
  const directionAnimation = directionIsAntiClockwise ? "spin" : "spin-reverse";
  const directionAnimationStyle = {
    "--animation-duration": `${30 / normalizeOrbitRPM(panorama.rpm)}s`,
  };
  const hasSingleSlider = !showDirectPanoramaControls;
  const rpmGaugeIcon = getOrbitRPMGaugeIcon(panorama.rpm);

  return (
    <div className="orbit-mode-widgets">
      <Widget
        isVisible={panorama.active && panorama.visible !== false}
        config={config}
        className="orbit-widget-shell"
      >
        <WaCard
          appearance="plain"
          className="orbit-widget panorama-widget lgs-card wa-theme-lgs1920-on-map"
          onWheel={stopPropagation}
        >
          <div
            className={`orbit-widget-header${
              hasSingleSlider ? " orbit-widget-header-end" : ""
            }`}
          >
            <WaTooltip for="panorama-direction-toggle" placement="top">
              {directionTooltip}
            </WaTooltip>
            <WaButton
              id="panorama-direction-toggle"
              aria-label={directionTooltip}
              appearance="outlined"
              className="orbit-widget-header-button orbit-direction-button lgs-widget-no-drag"
              size="s"
              variant="brand"
              onClick={toggleDirection}
              onPointerDownCapture={blockWidgetDrag}
            >
              <WaIcon
                name={directionIcon}
                animation={directionAnimation}
                variant="regular"
                style={directionAnimationStyle}
              />
            </WaButton>
            {!hasSingleSlider && (
              <>
                <OrbitInteractionHintsToggleButton
                  id="panorama-interaction-hints-toggle-header"
                  className="orbit-widget-header-button orbit-widget-hints-button lgs-widget-no-drag"
                  onPointerDownCapture={blockWidgetDrag}
                />
                <WaButton
                  aria-label="Stop panorama"
                  appearance="outlined"
                  className="orbit-widget-header-button orbit-widget-stop-button lgs-widget-no-drag"
                  size="s"
                  variant="brand"
                  onClick={closePanorama}
                  onPointerDownCapture={blockWidgetDrag}
                >
                  <WaIcon name="xmark" variant="regular" />
                </WaButton>
              </>
            )}
          </div>

          {!hasSingleSlider && <div className="orbit-widget-divider" />}

          <div className="panorama-widget-body">
            {showDirectPanoramaControls && (
              <>
                <div className="panorama-widget-slider">
                  <span className="panorama-widget-slider-label">
                    <WaIcon name="mountains" variant="regular" label="Height" />
                  </span>
                  <WaSlider
                    aria-label="Height"
                    className="panorama-widget-range lgs-widget-no-drag"
                    orientation="vertical"
                    size="s"
                    min={PANORAMA_HEIGHT_OFFSET_MIN}
                    max={PANORAMA_HEIGHT_OFFSET_MAX}
                    step={PANORAMA_HEIGHT_OFFSET_STEP}
                    value={panorama.heightOffset}
                    onInput={updateHeight}
                    onChange={persistHeight}
                  />
                  <strong>{Math.round(panorama.heightOffset)}</strong>
                </div>

                <div className="orbit-widget-drag-lane" aria-hidden="true" />

                <div className="panorama-widget-slider">
                  <span className="panorama-widget-slider-label">
                    <WaIcon name="angle" variant="regular" label="Angle" />
                  </span>
                  <WaSlider
                    aria-label="Angle"
                    className="panorama-widget-range lgs-widget-no-drag"
                    orientation="vertical"
                    size="s"
                    min={PANORAMA_PITCH_MIN}
                    max={PANORAMA_PITCH_MAX}
                    step={PANORAMA_PITCH_STEP}
                    value={panorama.pitch}
                    onInput={updatePitch}
                    onChange={persistPitch}
                  />
                  <strong>{Math.round(panorama.pitch)}</strong>
                </div>

                <div className="orbit-widget-drag-lane" aria-hidden="true" />
              </>
            )}

            <div className="panorama-widget-slider">
              <span className="panorama-widget-slider-label">
                <WaIcon name={rpmGaugeIcon} variant="regular" label="RPM" />
              </span>
              <WaSlider
                aria-label="RPM"
                className="panorama-widget-range lgs-widget-no-drag"
                orientation="vertical"
                size="s"
                min={ORBIT_RPM_MIN}
                max={ORBIT_RPM_MAX}
                step={ORBIT_RPM_STEP}
                value={panorama.rpm}
                onInput={updateRPM}
                onChange={persistRPM}
              />
              <strong>{panorama.rpm.toFixed(1)}</strong>
            </div>
          </div>

          {hasSingleSlider && (
            <div className="orbit-widget-footer orbit-widget-footer-centered orbit-widget-footer-stack">
              <OrbitInteractionHintsToggleButton
                id="panorama-interaction-hints-toggle-footer"
                className="orbit-widget-footer-button orbit-widget-hints-button lgs-widget-no-drag"
                onPointerDownCapture={blockWidgetDrag}
              />
              <WaButton
                aria-label="Stop panorama"
                appearance="outlined"
                className="orbit-widget-footer-button orbit-widget-stop-button lgs-widget-no-drag"
                size="s"
                variant="brand"
                onClick={closePanorama}
                onPointerDownCapture={blockWidgetDrag}
              >
                <WaIcon name="xmark" variant="regular" />
              </WaButton>
            </div>
          )}
        </WaCard>
      </Widget>

      <Widget
        isVisible={adjustmentWidgetMounted}
        config={adjustmentConfig}
        className={`panorama-adjustment-widget-shell${
          adjustmentVisible ? " adjustment-visible" : ""
        }`}
      >
        <div
          className="panorama-adjustment-overlay"
          onWheel={handleAdjustmentWheel}
        >
          <span className="panorama-adjustment-metric">
            <sl-icon library="fa" name={FA2SL.set(faVideo)} />
            <strong>{adjustmentValues.height}</strong>
          </span>
          <span className="panorama-adjustment-metric">
            <sl-icon library="fa" name={FA2SL.set(faAngle)} />
            <strong>{adjustmentValues.pitch}</strong>
          </span>
          {adjustmentValues.level !== null && (
            <span className="panorama-adjustment-metric">
              <sl-icon library="fa" name={FA2SL.set(faMagnifyingGlassLocation)} />
              <strong>{adjustmentValues.level}</strong>
            </span>
          )}
        </div>
      </Widget>
    </div>
  );
});
