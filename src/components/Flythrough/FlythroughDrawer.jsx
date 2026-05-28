/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughDrawer.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-28
 * Last modified: 2026-05-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import DrawerFooter from '@Components/DrawerFooter'
import { FlythroughProgressBar } from '@Components/Flythrough/FlythroughProgressBar'
import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import { formatSliderPercent } from '@Components/MainUI/widgets/editor/elements/sliderUtils'
import PanelActions from '@Components/PanelsActions'
import WaDrawer     from '@Components/WaDrawerNonModal'
import { FLYTHROUGH_DRAWER } from '@Core/constants'
import {
    clampFlythroughNumber, DEFAULT_FLYTHROUGH_SCOPE, ensureFlythroughSettings, FLYTHROUGH_CAMERA_ALTITUDE_CONSTANT,
    FLYTHROUGH_CAMERA_ALTITUDE_GROUND_OFFSET, FLYTHROUGH_LABEL, FLYTHROUGH_MARKER_MODE_HYSTERESIS,
    FLYTHROUGH_MARKER_MODE_NAVIGATION, FLYTHROUGH_MARKER_MODE_TRACE, FLYTHROUGH_PROFILE_MARKER_BORDER_MAX_WIDTH,
    FLYTHROUGH_PROFILE_MARKER_BORDER_MIN_WIDTH, FLYTHROUGH_PROFILE_MARKER_FILL_MAX_SIZE,
    FLYTHROUGH_PROFILE_MARKER_FILL_MIN_SIZE, FLYTHROUGH_PROGRESSION_BORDER_MAX_WIDTH,
    FLYTHROUGH_PROGRESSION_BORDER_MIN_WIDTH, FLYTHROUGH_PROGRESSION_FILL_MAX_WIDTH,
    FLYTHROUGH_PROGRESSION_FILL_MIN_WIDTH, FLYTHROUGH_TRACE_MODE_FULL, FLYTHROUGH_TRACE_MODE_PROGRESSIVE,
    normalizeFlythroughCamera, normalizeFlythroughMarker, normalizeFlythroughProfileInfo,
    normalizeFlythroughProgressionStyle, normalizeFlythroughTrace,
}                 from '@Core/ui/flythrough/FlythroughProgressionStyle'
import {
    WaCard, WaColorPicker, WaDivider, WaIcon, WaNumberInput, WaOption, WaSelect, WaSlider, WaSwitch, WaTab, WaTabGroup,
    WaTabPanel,
}                 from '@web.awesome.me/webawesome-pro/dist/react'
import { colord } from 'colord'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { createPortal }      from 'react-dom'
import { useSnapshot }       from 'valtio'
import './style.css'

const clampDuration = value => {
    const duration = Number(value)
    return Number.isFinite(duration) && duration > 0 ? duration : 60
}

const toOpaqueColorValue = value => {
    const color = colord(value ?? '#ffffff')
    return color.isValid() ? color.alpha(1).toHex() : '#ffffff'
}

const FlythroughStyleField = ({label, children}) => (
    <div className="flythrough-style-field">
        {label && <span className="flythrough-style-label">{label}</span>}
        {children}
    </div>
)

const mergeProgressionStyle = (current, updates) => normalizeFlythroughProgressionStyle({
                                                                                            ...current,
                                                                                            ...updates,
                                                                                            fill:   {
                                                                                                ...(current?.fill ?? {}),
                                                                                                ...(updates?.fill ?? {}),
                                                                                            },
                                                                                            border: {
                                                                                                ...(current?.border ?? {}),
                                                                                                ...(updates?.border ?? {}),
                                                                                            },
                                                                                        })

const mergeTrace = (current, updates) => normalizeFlythroughTrace({
                                                                      ...current,
                                                                      ...updates,
                                                                      remaining: {
                                                                          ...current?.remaining,
                                                                          ...updates?.remaining,
                                                                      },
                                                                  })

const mergeCamera = (current, updates) => normalizeFlythroughCamera({
                                                                        ...current,
                                                                        ...updates,
                                                                        hysteresis: {
                                                                            ...(current?.hysteresis ?? {}),
                                                                            ...(updates?.hysteresis ?? {}),
                                                                        },
                                                                    })

const FlythroughColorField = ({
                                  label,
                                  ariaLabel = label || 'Color',
                                  color,
                                  opacity,
                                  swatches,
                                  onColorInput,
                                  onOpacityInput,
                              }) => (
    <FlythroughStyleField label={label}>
        <div className="flythrough-color-control">
            <WaColorPicker
                className="flythrough-color-picker"
                size="s"
                aria-label={ariaLabel}
                value={color}
                swatches={swatches}
                onInput={onColorInput}
            />
            <WaSlider
                className="flythrough-opacity-slider"
                size="s"
                label="Opacity"
                min="0"
                max="1"
                step="0.05"
                label-at-start
                width-auto
                withTooltip
                placement="top"
                value={opacity}
                valueFormatter={formatSliderPercent}
                onInput={onOpacityInput}
            />
        </div>
    </FlythroughStyleField>
)

const FlythroughWidthField = ({label, unit = 'm', value, min, max, step, onInput}) => (
    <FlythroughStyleField label={`${label} (${unit})`}>
        <WaNumberInput
            className="flythrough-width-input"
            size="s"
            appearance="filled"
            min={min}
            max={max}
            step={step}
            value={value}
            onInput={onInput}
        />
    </FlythroughStyleField>
)

const FlythroughProgressionGroup = ({
                                        title,
                                        color,
                                        opacity,
                                        width,
                                        widthMin,
                                        widthMax,
                                        swatches,
                                        onColorInput,
                                        onOpacityInput,
                                        onWidthInput,
                                    }) => (
    <section className="flythrough-style-subsection">
        <h4 className="flythrough-style-subtitle">{title}</h4>
        <div className="flythrough-style-control-group">
            <FlythroughColorField
                label=""
                ariaLabel={`${title} color`}
                color={color}
                opacity={opacity}
                swatches={swatches}
                onColorInput={onColorInput}
                onOpacityInput={onOpacityInput}
            />
            <div className="flythrough-style-field-grid is-single flythrough-progression-width-grid">
                <FlythroughWidthField
                    label="Width"
                    value={width}
                    min={widthMin}
                    max={widthMax}
                    step="0.5"
                    onInput={onWidthInput}
                />
            </div>
        </div>
    </section>
)

export const FlythroughDrawer = memo(() => {
    const {drawers: {open: drawerOpen}} = useSnapshot(lgs.stores.ui)
    const {theJourney: currentJourney} = useSnapshot(lgs.stores.main)
    const flythroughState = useSnapshot(lgs.stores.flythrough)
    ensureFlythroughSettings()
    const flythroughSettings = useSnapshot(lgs.settings.ui.flythrough)
    const {drawer: drawerPlacement} = useSnapshot(lgs.editorSettingsProxy.menu)
    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])
    const journeySlug = currentJourney?.slug
    const hasJourney = Boolean(journeySlug)
    const previousJourneySlug = useRef(journeySlug)
    const progression = normalizeFlythroughProgressionStyle(flythroughSettings.progression)
    const fillColor = toOpaqueColorValue(progression.fill.color)
    const borderColor = toOpaqueColorValue(progression.border.color)
    const fillOpacity = progression.fill.opacity
    const borderOpacity = progression.border.opacity
    const fillWidth = progression.fill.width
    const borderWidth = progression.border.width
    const fillProfileMarker = progression.fill.profileMarker
    const borderProfileMarker = progression.border.profileMarker
    const trace = normalizeFlythroughTrace(flythroughSettings.trace)
    const remainingUseDefinedTrackStyle = trace.remaining.useDefinedTrackStyle !== false
    const remainingColor = toOpaqueColorValue(trace.remaining.color)
    const camera = normalizeFlythroughCamera(flythroughSettings.camera)
    const marker = normalizeFlythroughMarker(flythroughSettings.marker)
    const durationLocked = flythroughState.active || flythroughState.playing || flythroughState.paused

    useEffect(() => {
        const flythroughRuntime = lgs.stores.flythrough
        const journeyChanged = previousJourneySlug.current !== journeySlug
        previousJourneySlug.current = journeySlug

        if (journeyChanged && (flythroughRuntime.active || flythroughRuntime.playing || flythroughRuntime.paused)) {
            __.ui.flythrough?.stop?.()
        }

        flythroughRuntime.journeySlug = journeySlug
        flythroughRuntime.duration = flythroughSettings.duration
        lgs.settings.ui.flythrough.direction = 1
        flythroughRuntime.direction = 1
        flythroughRuntime.loop = flythroughSettings.loop
        flythroughRuntime.scope = DEFAULT_FLYTHROUGH_SCOPE
        flythroughRuntime.progression = normalizeFlythroughProgressionStyle(flythroughSettings.progression)
        flythroughRuntime.profileInfo = normalizeFlythroughProfileInfo(flythroughSettings.profileInfo)
        flythroughRuntime.trace = normalizeFlythroughTrace(flythroughSettings.trace)
        flythroughRuntime.marker = normalizeFlythroughMarker(flythroughSettings.marker)
        flythroughRuntime.camera = normalizeFlythroughCamera(flythroughSettings.camera)

        if (journeyChanged) {
            flythroughRuntime.progress = 0
            flythroughRuntime.sample = null
            flythroughRuntime.elapsedMillis = null
            flythroughRuntime.durationMillis = null
            flythroughRuntime.totalDistance = 0
        }
    }, [
        flythroughSettings.duration,
        flythroughSettings.loop,
        flythroughSettings.profileInfo,
        flythroughSettings.progression,
        flythroughSettings.trace,
        flythroughSettings.marker,
        flythroughSettings.camera,
        journeySlug,
    ])

    useEffect(() => {
        if (drawerOpen !== FLYTHROUGH_DRAWER || !hasJourney) {
            return
        }

        const flythroughRuntime = lgs.stores.flythrough
        flythroughRuntime.toolbarVisible = true

        if (!flythroughRuntime.active && !flythroughRuntime.playing && !flythroughRuntime.paused) {
            __.ui.flythrough?.configure?.({progress: flythroughRuntime.progress ?? 0})
        }
    }, [drawerOpen, flythroughSettings.duration, flythroughSettings.loop, hasJourney, journeySlug])

    const refreshFlythrough = useCallback(() => {
        __.ui.flythrough?.refresh?.()
        lgs.scene?.requestRender?.()
    }, [])

    const updateProgression = useCallback((updates) => {
        const nextProgression = mergeProgressionStyle(lgs.settings.ui.flythrough.progression, updates)
        lgs.settings.ui.flythrough.progression = nextProgression
        lgs.stores.flythrough.progression = nextProgression
        refreshFlythrough()
    }, [refreshFlythrough])

    const updateTrace = useCallback((updates) => {
        const nextTrace = mergeTrace(lgs.settings.ui.flythrough.trace, updates)
        lgs.settings.ui.flythrough.trace = nextTrace
        lgs.stores.flythrough.trace = nextTrace
        refreshFlythrough()
    }, [refreshFlythrough])

    const updateMarker = useCallback((event) => {
        const nextMarker = normalizeFlythroughMarker({mode: event.target.value})
        lgs.settings.ui.flythrough.marker = nextMarker
        lgs.stores.flythrough.marker = nextMarker
        refreshFlythrough()
    }, [refreshFlythrough])

    const updateCamera = useCallback((updates) => {
        const nextCamera = mergeCamera(lgs.settings.ui.flythrough.camera, updates)
        lgs.settings.ui.flythrough.camera = nextCamera
        lgs.stores.flythrough.camera = nextCamera
        refreshFlythrough()
    }, [refreshFlythrough])

    const updateDuration = useCallback((event) => {
        if (durationLocked) {
            return
        }
        const duration = clampDuration(event.target.value)
        lgs.settings.ui.flythrough.duration = duration
        lgs.stores.flythrough.duration = duration
    }, [durationLocked])

    const updateLoop = useCallback((event) => {
        const loop = event.target.checked
        lgs.settings.ui.flythrough.loop = loop
        lgs.stores.flythrough.loop = loop
        __.ui.flythrough?.setLoop?.(loop)
    }, [])

    const updateFillColor = useCallback((event) => {
        updateProgression({fill: {color: toOpaqueColorValue(event.target.value)}})
    }, [updateProgression])

    const updateFillOpacity = useCallback((event) => {
        updateProgression({fill: {opacity: clampFlythroughNumber(event.target.value, progression.fill.opacity, 0, 1)}})
    }, [progression.fill.opacity, updateProgression])

    const updateFillWidth = useCallback((event) => {
        updateProgression({
                              fill: {
                                  width: clampFlythroughNumber(
                                      event.target.value,
                                      progression.fill.width,
                                      FLYTHROUGH_PROGRESSION_FILL_MIN_WIDTH,
                                      FLYTHROUGH_PROGRESSION_FILL_MAX_WIDTH,
                                  ),
                              },
                          })
    }, [progression.fill.width, updateProgression])

    const updateFillProfileMarker = useCallback((event) => {
        updateProgression({
                              fill: {
                                  profileMarker: clampFlythroughNumber(
                                      event.target.value,
                                      progression.fill.profileMarker,
                                      FLYTHROUGH_PROFILE_MARKER_FILL_MIN_SIZE,
                                      FLYTHROUGH_PROFILE_MARKER_FILL_MAX_SIZE,
                                  ),
                              },
                          })
    }, [progression.fill.profileMarker, updateProgression])

    const updateBorderColor = useCallback((event) => {
        updateProgression({border: {color: toOpaqueColorValue(event.target.value)}})
    }, [updateProgression])

    const updateBorderOpacity = useCallback((event) => {
        updateProgression({border: {opacity: clampFlythroughNumber(event.target.value, progression.border.opacity, 0, 1)}})
    }, [progression.border.opacity, updateProgression])

    const updateBorderWidth = useCallback((event) => {
        updateProgression({
                              border: {
                                  width: clampFlythroughNumber(
                                      event.target.value,
                                      progression.border.width,
                                      FLYTHROUGH_PROGRESSION_BORDER_MIN_WIDTH,
                                      FLYTHROUGH_PROGRESSION_BORDER_MAX_WIDTH,
                                  ),
                              },
                          })
    }, [progression.border.width, updateProgression])

    const updateBorderProfileMarker = useCallback((event) => {
        updateProgression({
                              border: {
                                  profileMarker: clampFlythroughNumber(
                                      event.target.value,
                                      progression.border.profileMarker,
                                      FLYTHROUGH_PROFILE_MARKER_BORDER_MIN_WIDTH,
                                      FLYTHROUGH_PROFILE_MARKER_BORDER_MAX_WIDTH,
                                  ),
                              },
                          })
    }, [progression.border.profileMarker, updateProgression])

    const updateTraceMode = useCallback((event) => {
        updateTrace({mode: event.target.value})
    }, [updateTrace])

    const updateRemainingColor = useCallback((event) => {
        updateTrace({remaining: {color: toOpaqueColorValue(event.target.value)}})
    }, [updateTrace])

    const updateRemainingOpacity = useCallback((event) => {
        updateTrace({remaining: {opacity: clampFlythroughNumber(event.target.value, trace.remaining.opacity, 0, 1)}})
    }, [trace.remaining.opacity, updateTrace])

    const updateRemainingUseDefinedTrackStyle = useCallback((event) => {
        updateTrace({remaining: {useDefinedTrackStyle: event.target.checked}})
    }, [updateTrace])

    const updateKeepNorth = useCallback((event) => {
        updateCamera({keepNorth: event.target.checked})
    }, [updateCamera])

    const updateAltitudeMode = useCallback((event) => {
        updateCamera({altitudeMode: event.target.value})
    }, [updateCamera])

    const updateCameraAltitude = useCallback((event) => {
        updateCamera({altitude: clampFlythroughNumber(event.target.value, camera.altitude, 50, 100000)})
    }, [camera.altitude, updateCamera])

    const updateCameraGroundOffset = useCallback((event) => {
        updateCamera({groundOffset: clampFlythroughNumber(event.target.value, camera.groundOffset, 10, 100000)})
    }, [camera.groundOffset, updateCamera])

    const updateHysteresisMarginRatio = useCallback((event) => {
        updateCamera({
                         hysteresis: {
                             marginRatio: clampFlythroughNumber(
                                 event.target.value,
                                 camera.hysteresis.marginRatio,
                                 0.05,
                                 0.45,
                             ),
                         },
                     })
    }, [camera.hysteresis.marginRatio, updateCamera])

    const updateHysteresisEasing = useCallback((event) => {
        updateCamera({
                         hysteresis: {
                             easing: clampFlythroughNumber(
                                 event.target.value,
                                 camera.hysteresis.easing,
                                 0.02,
                                 0.5,
                             ),
                         },
                     })
    }, [camera.hysteresis.easing, updateCamera])

    const updateHysteresisStopThreshold = useCallback((event) => {
        updateCamera({
                         hysteresis: {
                             stopThreshold: clampFlythroughNumber(
                                 event.target.value,
                                 camera.hysteresis.stopThreshold,
                                 0.000001,
                                 0.001,
                             ),
                         },
                     })
    }, [camera.hysteresis.stopThreshold, updateCamera])

    const handleRequestClose = useCallback((event) => {
        if (event.target.tagName !== 'WA-DRAWER') {
            event.preventDefault()
            return
        }
        __.ui.drawerManager.close()
    }, [])

    const closeDrawer = useCallback((event) => {
        if (window.isOK(event) && __.ui.drawerManager.isCurrent(FLYTHROUGH_DRAWER)) {
            __.ui.drawerManager.close()
        }
    }, [])

    const drawerRoot = __.ui.drawerManager.drawerRoot
    const content = (
        <>
            {drawerOpen === FLYTHROUGH_DRAWER &&
                <WaDrawer
                    id={FLYTHROUGH_DRAWER}
                    open={true}
                    onWaAfterHide={handleRequestClose}
                    onSlAfterHide={closeDrawer}
                    placement={drawerPlacement}
                    className="flythrough-drawer"
                >
                    <span slot="label" className="flythrough-drawer-title">
                        <WaIcon name="video-arrow-up-right" variant="regular"/>
                        {FLYTHROUGH_LABEL}
                    </span>
                    <PanelActions/>

                    <div className="flythrough-drawer-content">
                        {!hasJourney ? (
                            <p className="flythrough-empty-state">{`Import or select a journey to use ${FLYTHROUGH_LABEL}.`}</p>
                        ) : (
                             <>
                                 <WaCard appearance="outlined" className="flythrough-progress-card-in-drawer">
                                     <FlythroughProgressBar className="flythrough-progress-bar-in-drawer"/>
                                 </WaCard>
                                 <WaSwitch label-at-start size="xs">
                                     {'Export to video'}
                                     <span slot="hint">
                                        {'You can configure your video before viewing it, and then save/share it.'}
                                    </span>
                                 </WaSwitch>
                                 <WaSelect
                                     className="flythrough-progression-select"
                                     label="Progression"
                                     label-at-start
                                     size="s"
                                     value={trace.mode}
                                     onChange={updateTraceMode}
                                 >
                                     <WaOption value={FLYTHROUGH_TRACE_MODE_PROGRESSIVE}>{'Progressive'}</WaOption>
                                     <WaOption value={FLYTHROUGH_TRACE_MODE_FULL}>{'Full trace'}</WaOption>
                                 </WaSelect>
                                 <WaSelect
                                     label="Tracking"
                                     label-at-start
                                     size="s"
                                     value={marker.mode}
                                     onChange={updateMarker}
                                 >
                                     <WaOption
                                         value={FLYTHROUGH_MARKER_MODE_TRACE}>{'Passive'}</WaOption>
                                     <WaOption
                                         value={FLYTHROUGH_MARKER_MODE_NAVIGATION}>{'Navigation'}</WaOption>
                                     <WaOption
                                         value={FLYTHROUGH_MARKER_MODE_HYSTERESIS}>{'Tolerance zone'}</WaOption>
                                 </WaSelect>
                                 <WaTabGroup className="flythrough-tabs">
                                     <WaTab slot="nav" panel="runner">
                                         <WaIcon name="clock" variant="regular"/>
                                         {'Playback'}
                                     </WaTab>
                                     <WaTab slot="nav" panel="edit">
                                         <WaIcon name="paintbrush-pencil" variant="regular"/>
                                         {'Edit'}
                                     </WaTab>

                                     <WaTabPanel name="runner">
                                         <LGSScrollbars>
                                             <div className="flythrough-tab-panel">
                                                 <div className="flythrough-fieldset">
                                                     <WaNumberInput
                                                         className="flythrough-duration-input"
                                                         label="Duration (s)"
                                                         size="s"
                                                         appearance="filled"
                                                         min="1"
                                                         step="1"
                                                         value={flythroughSettings.duration}
                                                         disabled={durationLocked}
                                                         onInput={updateDuration}
                                                     />

                                                     <WaSwitch size="xs" label-at-start
                                                               checked={flythroughSettings.loop}
                                                               onInput={updateLoop}>
                                                         {'Loop'}
                                                     </WaSwitch>
                                                     <WaSwitch size="xs" label-at-start
                                                               checked={camera.keepNorth}
                                                               onInput={updateKeepNorth}>
                                                         {'Keep north'}
                                                     </WaSwitch>
                                                 </div>
                                                 {marker.mode !== FLYTHROUGH_MARKER_MODE_TRACE && (
                                                     <div className="flythrough-fieldset">
                                                         <WaSelect
                                                             label="Camera altitude"
                                                             label-at-start
                                                             size="s"
                                                             value={camera.altitudeMode}
                                                             onChange={updateAltitudeMode}
                                                         >
                                                             <WaOption
                                                                 value={FLYTHROUGH_CAMERA_ALTITUDE_CONSTANT}>{'Constant'}</WaOption>
                                                             <WaOption
                                                                 value={FLYTHROUGH_CAMERA_ALTITUDE_GROUND_OFFSET}>{'Ground offset'}</WaOption>
                                                         </WaSelect>
                                                         {camera.altitudeMode === FLYTHROUGH_CAMERA_ALTITUDE_CONSTANT ? (
                                                             <WaNumberInput
                                                                 label="Altitude (m)"
                                                                 size="s"
                                                                 appearance="filled"
                                                                 min="50"
                                                                 step="50"
                                                                 value={camera.altitude}
                                                                 onInput={updateCameraAltitude}
                                                             />
                                                         ) : (
                                                              <WaNumberInput
                                                                  label="Ground offset (m)"
                                                                  size="s"
                                                                  appearance="filled"
                                                                  min="10"
                                                                  step="25"
                                                                  value={camera.groundOffset}
                                                                  onInput={updateCameraGroundOffset}
                                                              />
                                                          )}
                                                         <WaNumberInput
                                                             label="Pitch (deg)"
                                                             size="s"
                                                             appearance="filled"
                                                             min="-89"
                                                             max="-5"
                                                             step="1"
                                                             value={camera.pitch}
                                                             onInput={event => updateCamera({
                                                                                                pitch: clampFlythroughNumber(event.target.value, camera.pitch, -89, -5),
                                                                                            })}
                                                         />
                                                     </div>
                                                 )}
                                                 {marker.mode === FLYTHROUGH_MARKER_MODE_HYSTERESIS && (
                                                     <div className="flythrough-fieldset">
                                                         <WaNumberInput
                                                             label="Tolerance zone"
                                                             size="s"
                                                             appearance="filled"
                                                             min="0.05"
                                                             max="0.45"
                                                             step="0.01"
                                                             value={camera.hysteresis.marginRatio}
                                                             onInput={updateHysteresisMarginRatio}
                                                         />
                                                         <WaNumberInput
                                                             label="Recenter easing"
                                                             size="s"
                                                             appearance="filled"
                                                             min="0.02"
                                                             max="0.5"
                                                             step="0.01"
                                                             value={camera.hysteresis.easing}
                                                             onInput={updateHysteresisEasing}
                                                         />
                                                         <WaNumberInput
                                                             label="Stop threshold"
                                                             size="s"
                                                             appearance="filled"
                                                             min="0.000001"
                                                             max="0.001"
                                                             step="0.000001"
                                                             value={camera.hysteresis.stopThreshold}
                                                             onInput={updateHysteresisStopThreshold}
                                                         />
                                                     </div>
                                                 )}
                                             </div>
                                         </LGSScrollbars>
                                     </WaTabPanel>

                                     <WaTabPanel name="edit">
                                         <LGSScrollbars>
                                             <div className="flythrough-tab-panel">
                                                 {trace.mode === FLYTHROUGH_TRACE_MODE_FULL &&
                                                     <>
                                                         <section className="flythrough-progression-section">
                                                             <h3>{'Remaining trace'}</h3>

                                                             <WaSwitch
                                                                 className="flythrough-track-style-switch"
                                                                 size="xs"
                                                                 label-at-start
                                                                 checked={remainingUseDefinedTrackStyle}
                                                                 onChange={updateRemainingUseDefinedTrackStyle}
                                                             >
                                                                 {'Use defined track style'}
                                                             </WaSwitch>

                                                             <div className="flythrough-style-control-group">
                                                                 {!remainingUseDefinedTrackStyle && (
                                                                     <FlythroughColorField
                                                                         color={remainingColor}
                                                                         opacity={trace.remaining.opacity}
                                                                         swatches={swatches}
                                                                         onColorInput={updateRemainingColor}
                                                                         onOpacityInput={updateRemainingOpacity}
                                                                     />
                                                                 )}
                                                             </div>

                                                             <WaDivider/>
                                                             <FlythroughProgressionGroup
                                                                 title="Trace and Marker"
                                                                 color={fillColor}
                                                                 opacity={fillOpacity}
                                                                 width={fillWidth}
                                                                 widthMin={FLYTHROUGH_PROGRESSION_FILL_MIN_WIDTH}
                                                                 widthMax={FLYTHROUGH_PROGRESSION_FILL_MAX_WIDTH}
                                                                 swatches={swatches}
                                                                 onColorInput={updateFillColor}
                                                                 onOpacityInput={updateFillOpacity}
                                                                 onWidthInput={updateFillWidth}
                                                             />
                                                             <FlythroughProgressionGroup
                                                                 title="Border"
                                                                 color={borderColor}
                                                                 opacity={borderOpacity}
                                                                 width={borderWidth}
                                                                 widthMin={FLYTHROUGH_PROGRESSION_BORDER_MIN_WIDTH}
                                                                 widthMax={FLYTHROUGH_PROGRESSION_BORDER_MAX_WIDTH}
                                                                 swatches={swatches}
                                                                 onColorInput={updateBorderColor}
                                                                 onOpacityInput={updateBorderOpacity}
                                                                 onWidthInput={updateBorderWidth}
                                                             />
                                                         </section>
                                                         <WaDivider/>
                                                     </>
                                                 }
                                                 <section className="flythrough-progression-section">
                                                     <h3>{'Profile'}</h3>
                                                     <div className="flythrough-style-control-group">
                                                         <div className="flythrough-style-field-grid">
                                                             <FlythroughWidthField
                                                                 label="Marker Size"
                                                                 unit="px"
                                                                 value={fillProfileMarker}
                                                                 min={FLYTHROUGH_PROFILE_MARKER_FILL_MIN_SIZE}
                                                                 max={FLYTHROUGH_PROFILE_MARKER_FILL_MAX_SIZE}
                                                                 step="0.5"
                                                                 onInput={updateFillProfileMarker}
                                                             />
                                                             <FlythroughWidthField
                                                                 label="Marker Border"
                                                                 unit="px"
                                                                 value={borderProfileMarker}
                                                                 min={FLYTHROUGH_PROFILE_MARKER_BORDER_MIN_WIDTH}
                                                                 max={FLYTHROUGH_PROFILE_MARKER_BORDER_MAX_WIDTH}
                                                                 step="0.5"
                                                                 onInput={updateBorderProfileMarker}
                                                             />
                                                         </div>
                                                     </div>
                                                 </section>
                                             </div>
                                         </LGSScrollbars>
                                     </WaTabPanel>
                                 </WaTabGroup>
                             </>
                         )}
                    </div>
                    <DrawerFooter/>
                </WaDrawer>
            }
        </>
    )

    return drawerRoot ? createPortal(content, drawerRoot) : content
})
