/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: OrbitInteractionHintsWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-13
 * Last modified: 2026-07-13
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Widget } from "@Components/MainUI/widgets/Widget";
import {
  LGS_WIDGET,
  SCENE_WIDGETS,
  SCENE_WIDGETS_BOARD,
} from "@Core/constants";
import { WaIcon } from "@web.awesome.me/webawesome-pro/dist/react";
import { memo, useEffect, useMemo, useState } from "react";
import { useSnapshot } from "valtio";

export const ORBIT_INTERACTION_HINTS_WIDGET = "orbit-interaction-hints-widget";

const SHORTCUT_ICONS = {
  cameraRotate: "camera-rotate",
  mouseButtonLeft: "computer-mouse-button-left",
  mouseButtonRight: "computer-mouse-button-right",
  scrollwheel: "computer-mouse-scrollwheel",
  sliders: "sliders",
};

const hasFinePointer = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(any-pointer: fine)").matches ?? false);
const isAppleOS = () => {
  if (typeof navigator === "undefined") {
    return false;
  }

  const platform =
    navigator.userAgentData?.platform ?? navigator.platform ?? "";
  return (
    /mac|iphone|ipad|ipod/i.test(platform) ||
    (/mac/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
};

const Icon = ({ icon, className = "orbit-shortcut-icon" }) => (
  <WaIcon className={className} name={icon} variant="regular" />
);

const KeyTag = ({ children, icon = null }) => (
  <span className="orbit-key-tag">
    {icon && <Icon className="orbit-shortcut-key-icon" icon={icon} />}
    {children}
  </span>
);

const Gesture = ({ icon, label }) => (
  <span className="orbit-shortcut-gesture">
    <Icon icon={icon} />
    <span>{label}</span>
  </span>
);

const LeftClickDrag = () => (
  <Gesture icon={SHORTCUT_ICONS.mouseButtonLeft} label="Left click + drag" />
);

const RightClickDrag = () => (
  <Gesture icon={SHORTCUT_ICONS.mouseButtonRight} label="Right click + drag" />
);

const MiddleClickDrag = () => (
    <Gesture icon={SHORTCUT_ICONS.scrollwheel} label="Middle click + drag"/>
)

const Shortcut = ({ gesture, action }) => (
  <span className="orbit-shortcut-row">
    <span className="orbit-shortcut-combo">{gesture}</span>
    <span className="orbit-shortcut-label">{action}</span>
  </span>
);

const Plus = () => <span className="orbit-shortcut-plus">{"+"}</span>;
const Or = () => <span className="orbit-shortcut-plus">{"/"}</span>;
const ArrowUpDown = () => (
    <>
        <KeyTag>{"↑"}</KeyTag>
        <Or/>
        <KeyTag>{"↓"}</KeyTag>
    </>
);

export const OrbitInteractionHintsWidget = memo(() => {
  const rotate = useSnapshot(lgs.stores.ui.mainUI.rotate);
  const panorama = useSnapshot(lgs.stores.ui.mainUI.panorama);
  const device = useSnapshot(lgs.stores.ui.device);
  const widgetList = useSnapshot(lgs.stores.ui.widget.list);
  const [finePointer, setFinePointer] = useState(hasFinePointer);
  const active = (rotate.running || panorama.active) && !device.mobile;

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(any-pointer: fine)");
    if (!mediaQuery) {
      return;
    }

    const updatePointerMode = () => setFinePointer(mediaQuery.matches);
    updatePointerMode();
    mediaQuery.addEventListener("change", updatePointerMode);

    return () => mediaQuery.removeEventListener("change", updatePointerMode);
  }, []);

  useEffect(() => {
    if (
      !active ||
      lgs.stores.ui.widget.list.has(ORBIT_INTERACTION_HINTS_WIDGET)
    ) {
      return;
    }

    lgs.stores.ui.widget.list.set(ORBIT_INTERACTION_HINTS_WIDGET, {
      widgetsBoard: SCENE_WIDGETS_BOARD,
      zIndex: 11850,
    });
  }, [active]);

  const config = useMemo(
    () => ({
      attachTo: "bottom-left",
      contextMenu: {
        canRemove: true,
      },
      draggable: true,
      dynamic: true,
      group: SCENE_WIDGETS,
      id: ORBIT_INTERACTION_HINTS_WIDGET,
      left: "0px",
      margin: lgs.gutter.s,
      opacity: 1,
      persist: false,
      resizable: false,
      rotatable: false,
      scalable: false,
      showControlBox: false,
      snappable: false,
      stopPropagation: true,
      top: "100%",
      transient: true,
      type: LGS_WIDGET,
      widgetsBoard: SCENE_WIDGETS_BOARD,
      zIndex: 11850,
    }),
    []
  );

  const appleOS = useMemo(() => isAppleOS(), []);
  const altKey = useMemo(
    () =>
      appleOS ? (
        <KeyTag>{"Option"}</KeyTag>
      ) : (
        <KeyTag>{"Alt"}</KeyTag>
      ),
    [appleOS]
  );
  const shiftKey = useMemo(() => <KeyTag>{"Shift"}</KeyTag>, []);
    const ctrlKey = useMemo(() => <KeyTag>{'Ctrl'}</KeyTag>, [])
  const fastHeightGesture = useMemo(
    () => (
      <Gesture
        icon={SHORTCUT_ICONS.scrollwheel}
        label={appleOS ? "Shift + trackpad scroll" : "Shift + wheel"}
      />
    ),
    [appleOS]
  );
  const fineHeightGesture = useMemo(
    () => (
      <Gesture
        icon={SHORTCUT_ICONS.scrollwheel}
        label={
          appleOS ? "Option + Shift + trackpad scroll" : "Alt + Shift + wheel"
        }
      />
    ),
    [appleOS]
  );
    const orbitFineHeightGesture = useMemo(
        () => (
            <Gesture
                icon={SHORTCUT_ICONS.scrollwheel}
                label={appleOS ? 'Ctrl + trackpad scroll' : 'Ctrl + wheel'}
            />
        ),
        [appleOS],
    )
    const panoramaFinePointerShortcuts = (
    <>
      <Shortcut
        gesture={
          <Gesture icon={SHORTCUT_ICONS.scrollwheel} label="Wheel / trackpad" />
        }
        action="Height"
      />
      <Shortcut gesture={fastHeightGesture} action="Height (+10 m)" />
      <Shortcut gesture={fineHeightGesture} action="Height (+1 m)" />
      <Shortcut
        gesture={
          <>
            {altKey}
            <Plus />
            <LeftClickDrag />
          </>
        }
        action="Height"
      />
      <Shortcut
        gesture={
          <>
            {shiftKey}
            <Plus />
            <LeftClickDrag />
          </>
        }
        action="Height"
      />
      <Shortcut gesture={<RightClickDrag />} action="Height" />
      <Shortcut gesture={<LeftClickDrag />} action="Angle" />
    </>
  );
    const orbitFinePointerShortcuts = (
        <>
            <Shortcut gesture={<LeftClickDrag/>} action="Angle"/>

            <Shortcut
                gesture={
                    <Gesture icon={SHORTCUT_ICONS.scrollwheel} label="Wheel / trackpad"/>
                }
                action="Height"
            />
            <Shortcut gesture={fastHeightGesture} action="Height (+10 m)"/>
            <Shortcut gesture={orbitFineHeightGesture} action="Height (+1 m)"/>
            <Shortcut gesture={<ArrowUpDown/>} action="Height (+100 m)"/>
            <Shortcut
                gesture={
                    <>
                        {shiftKey}
                        <Plus/>
                        <ArrowUpDown/>
                    </>
                }
                action="Height (+10 m)"
            />
            <Shortcut
                gesture={
                    <>
                        {ctrlKey}
                        <Plus/>
                        <ArrowUpDown/>
                    </>
                }
                action="Height (+1 m)"
            />
            <Shortcut gesture={<RightClickDrag/>} action="Height"/>
        </>
    )

  if (!active || !widgetList.has(ORBIT_INTERACTION_HINTS_WIDGET)) {
    return null;
  }

  return (
    <Widget
      isVisible={true}
      config={config}
      className="orbit-interaction-hints-shell"
    >
      <div className="orbit-interaction-hints lgs-card wa-theme-lgs1920-on-map">
        {panorama.active ? (
          finePointer ? (
              panoramaFinePointerShortcuts
          ) : (
            <>
              <Shortcut
                gesture={
                  <Gesture icon={SHORTCUT_ICONS.sliders} label="Sliders" />
                }
                action="Height / angle"
              />
              <Shortcut
                gesture={
                  <Gesture icon={SHORTCUT_ICONS.cameraRotate} label="Sliders" />
                }
                action="RPM / sense"
              />
            </>
          )
        ) : (
             orbitFinePointerShortcuts
        )}
      </div>
    </Widget>
  );
});
