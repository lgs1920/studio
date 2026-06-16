/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughDrawer.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-11
 * Last modified: 2026-06-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import DrawerFooter from '@Components/DrawerFooter'
import { FlythroughProgressBar } from '@Components/Flythrough/FlythroughProgressBar'
import { FlythroughClipsTab } from '@Components/Flythrough/FlythroughClipsTab'
import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import { openPOIEditor }                  from '@Components/MainUI/MapPOI/openPOIEditor'
import { VideoButton } from '@Components/MainUI/video/VideoButton'
import { formatSliderPercent } from '@Components/MainUI/widgets/editor/elements/sliderUtils'
import PanelActions from '@Components/PanelsActions'
import WaDrawer     from '@Components/WaDrawerNonModal'
import { FLYTHROUGH_DRAWER } from '@Core/constants'
import {
    clampFlythroughNumber, DEFAULT_FLYTHROUGH_SCOPE, ensureFlythroughSettings, FLYTHROUGH_CAMERA_ALTITUDE_CONSTANT,
    FLYTHROUGH_CAMERA_ALTITUDE_GROUND_OFFSET, FLYTHROUGH_CAMERA_POSITION_AHEAD, FLYTHROUGH_CAMERA_POSITION_BEHIND,
    FLYTHROUGH_CAMERA_POSITION_SYSTEM, FLYTHROUGH_LABEL, FLYTHROUGH_MARKER_MODE_HYSTERESIS,
    FLYTHROUGH_MARKER_MODE_NAVIGATION, FLYTHROUGH_MARKER_MODE_TRACE, FLYTHROUGH_PROFILE_MARKER_BORDER_MAX_WIDTH,
    FLYTHROUGH_PROFILE_MARKER_BORDER_MIN_WIDTH, FLYTHROUGH_PROFILE_MARKER_FILL_MAX_SIZE,
    FLYTHROUGH_PROFILE_MARKER_FILL_MIN_SIZE, FLYTHROUGH_PROGRESSION_BORDER_MAX_WIDTH,
    FLYTHROUGH_PROGRESSION_BORDER_MIN_WIDTH, FLYTHROUGH_PROGRESSION_FILL_MAX_WIDTH,
    FLYTHROUGH_PROGRESSION_FILL_MIN_WIDTH, FLYTHROUGH_TRACE_MODE_FULL, FLYTHROUGH_TRACE_MODE_PROGRESSIVE,
    FLYTHROUGH_CAMERA_PRESET_CUSTOM, FLYTHROUGH_CAMERA_PRESETS,
    FLYTHROUGH_HYSTERESIS_EASING_MAX, FLYTHROUGH_HYSTERESIS_EASING_MIN,
    FLYTHROUGH_HYSTERESIS_MARGIN_RATIO_MAX, FLYTHROUGH_HYSTERESIS_MARGIN_RATIO_MIN,
    FLYTHROUGH_HYSTERESIS_STOP_THRESHOLD_MAX, FLYTHROUGH_HYSTERESIS_STOP_THRESHOLD_MIN,
    getFlythroughCameraPresetKey, getFlythroughCameraPresetUpdates, normalizeFlythroughCamera, normalizeFlythroughMarker, normalizeFlythroughProfileInfo,
    normalizeFlythroughProgressionStyle, normalizeFlythroughTrace,
}                 from '@Core/ui/flythrough/FlythroughProgressionStyle'
import { normalizeFlythroughClips } from '@Core/ui/flythrough/FlythroughClips'
import { normalizeFlythroughPOISettings } from '@Core/ui/flythrough/FlythroughPOISettings'
import { ELEVATION_UNITS, UnitUtils } from '@Utils/UnitUtils'
import {
    WaButton, WaCard, WaColorPicker, WaDetails, WaDivider, WaIcon, WaNumberInput, WaOption, WaSelect, WaSlider,
    WaSwitch, WaTab, WaTooltip,
    WaTabGroup,
    WaTabPanel,
}                 from '@web.awesome.me/webawesome-pro/dist/react'
import { colord } from 'colord'
import { Cartographic } from 'cesium'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal }      from 'react-dom'
import { useSnapshot }       from 'valtio'
import './style.css'


const clampDuration = value => {
    const duration = Number(value)
    return Number.isFinite(duration) && duration > 0 ? duration : 60
}

const terrainHeightAt = ({longitude, latitude, radians = false}) => {
    const lon = Number(longitude)
    const lat = Number(latitude)
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
        return null
    }

    const cartographic = radians ? Cartographic.fromRadians(lon, lat) : Cartographic.fromDegrees(lon, lat)
    const height = lgs.scene?.globe?.getHeight?.(cartographic)
    const numericHeight = Number(height)
    return Number.isFinite(numericHeight) ? numericHeight : null
}

const toOpaqueColorValue = value => {
    const color = colord(value ?? '#ffffff')
    return color.isValid() ? color.alpha(1).toHex() : '#ffffff'
}

const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const formatSeconds = value => {
    const seconds = Math.max(0, finiteNumber(value) ?? 0)
    return `${Math.round(seconds)}`
}

const getChecked = event => Boolean(event?.target?.checked ?? event?.currentTarget?.checked)

const FlythroughStyleField = ({children}) => (
    <div className="flythrough-style-field">
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
                                                                            zone: {
                                                                                ...(current?.hysteresis?.zone ?? {}),
                                                                                ...(updates?.hysteresis?.zone ?? {}),
                                                                            },
                                                                        },
                                                                    })

const mergeMarker = (current, updates) => normalizeFlythroughMarker({
                                                                        ...current,
                                                                        ...updates,
                                                                        position: updates?.position === null
                                                                                  ? null
                                                                                  : {
                                                                                ...(current?.position ?? {}),
                                                                                ...(updates?.position ?? {}),
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
    <FlythroughStyleField>
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
                className="flythrough-opacity-slider half-width"
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
    <FlythroughStyleField>
        <WaNumberInput
            label={`${label} (${unit})`}
            className="flythrough-width-input half-width"
            size="s"
            appearance="filled"
            min={min}
            max={max}
            step={step}
            value={value}
            onInput={onInput}
            label-at-start/>
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
                <FlythroughWidthField
                    label="Width"
                    value={width}
                    min={widthMin}
                    max={widthMax}
                    step="0.5"
                    onInput={onWidthInput}
                />
        </div>
    </section>
)

const FLYTHROUGH_POI_HIDDEN_FIELDS = [
    {key: 'location', label: 'Hide location'},
    {key: 'category', label: 'Hide category'},
    {key: 'altitude', label: 'Hide altitude'},
    {key: 'coordinates', label: 'Hide coordinates'},
]

export const FlythroughDrawer = memo(() => {
    const {drawers: {open: drawerOpen}} = useSnapshot(lgs.stores.ui)
    const {theJourney: currentJourney} = useSnapshot(lgs.stores.main)
    const poiList = useSnapshot(lgs.stores.main.components.pois.list)
    const flythroughState = useSnapshot(lgs.stores.flythrough)
    ensureFlythroughSettings()
    const flythroughSettings = useSnapshot(lgs.settings.ui.flythrough)
    const {current: unitSystem} = useSnapshot(lgs.settings.unitSystem)
    const {drawer: drawerPlacement} = useSnapshot(lgs.editorSettingsProxy.menu)
    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])
    const altitudeUnit = ELEVATION_UNITS[unitSystem] ?? ELEVATION_UNITS[0]
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
    const clips = normalizeFlythroughClips({
                                                   catalog: flythroughSettings.clips?.catalog ?? flythroughSettings.clips?.definitions ?? {},
                                                   start:   Array.isArray(currentJourney?.flythrough?.start)
                                                            ? currentJourney.flythrough.start
                                                            : flythroughSettings.clips?.start ?? [],
                                                   stop:    Array.isArray(currentJourney?.flythrough?.stop)
                                                            ? currentJourney.flythrough.stop
                                                            : flythroughSettings.clips?.stop ?? [],
                                               })
    const remainingUseDefinedTrackStyle = trace.remaining.useDefinedTrackStyle !== false
    const remainingColor = toOpaqueColorValue(trace.remaining.color)
    const camera = normalizeFlythroughCamera(flythroughSettings.camera)
    const nearbyPOIs = Array.isArray(flythroughState.nearbyPois) ? flythroughState.nearbyPois : []
    const cameraPresetKey = getFlythroughCameraPresetKey(camera)
    const marker = normalizeFlythroughMarker(flythroughSettings.marker)
    const hideOtherJourneys = flythroughState.hideOtherJourneys === true
    const durationLocked = flythroughState.active || flythroughState.playing || flythroughState.paused
    const syncWithVideo = flythroughState.recordingSync === true
    const [poiVisibilityOverrides, setPoiVisibilityOverrides] = useState({})
    const [cameraDrafts, setCameraDrafts] = useState({
        altitude: null,
        heading:  null,
        pitch:    null,
    })
    const cameraDraftValues = useRef({
        altitude: null,
        heading:  null,
        pitch:    null,
    })
    const cameraDraftBaseline = useRef(null)
    const cameraDraftField = useRef(null)
    const cameraUpdateSourceClearTimer = useRef(null)
    const totalVideoDurationSeconds = useMemo(() => {
        const clipDurationSeconds = [...(clips.start ?? []), ...(clips.stop ?? [])]
            .reduce((total, clip) => total + Math.max(0, finiteNumber(clip?.params?.duration) ?? 0), 0)

        return Math.max(0, finiteNumber(flythroughSettings.duration) ?? 0) + clipDurationSeconds
    }, [clips.start, clips.stop, flythroughSettings.duration])

    useEffect(() => {
        const flythroughRuntime = lgs.stores.flythrough
        const journeyChanged = previousJourneySlug.current !== journeySlug
        previousJourneySlug.current = journeySlug

        if (journeyChanged && (flythroughRuntime.active || flythroughRuntime.playing || flythroughRuntime.paused)) {
            __.ui.flythrough?.stop?.()
        }

        flythroughRuntime.journeySlug = journeySlug
        flythroughRuntime.duration = flythroughSettings.duration
        flythroughRuntime.poiDistance = flythroughSettings.poiDistance
        lgs.settings.ui.flythrough.direction = 1
        flythroughRuntime.direction = 1
        flythroughRuntime.scope = DEFAULT_FLYTHROUGH_SCOPE
        flythroughRuntime.progression = normalizeFlythroughProgressionStyle(flythroughSettings.progression)
        flythroughRuntime.profileInfo = normalizeFlythroughProfileInfo(flythroughSettings.profileInfo)
        flythroughRuntime.trace = normalizeFlythroughTrace(flythroughSettings.trace)
        flythroughRuntime.marker = normalizeFlythroughMarker(flythroughSettings.marker)
        flythroughRuntime.camera = normalizeFlythroughCamera(flythroughSettings.camera)
        flythroughRuntime.clips = clips
        flythroughRuntime.hideOtherJourneys = flythroughState.hideOtherJourneys === true

        if (journeyChanged) {
            flythroughRuntime.progress = 0
            flythroughRuntime.sample = null
            flythroughRuntime.elapsedMillis = null
            flythroughRuntime.durationMillis = null
            flythroughRuntime.totalDistance = 0
            flythroughRuntime.nearbyPois = []
        }
    }, [
        flythroughSettings.duration,
                  flythroughSettings.poiDistance,
        flythroughSettings.profileInfo,
        flythroughSettings.progression,
        flythroughSettings.trace,
        flythroughSettings.marker,
        flythroughSettings.camera,
        flythroughSettings.clips,
        flythroughState.hideOtherJourneys,
        clips,
        currentJourney?.flythrough?.start,
        currentJourney?.flythrough?.stop,
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
    }, [drawerOpen, flythroughSettings.duration, hasJourney, journeySlug])

    useEffect(() => {
        if (drawerOpen !== FLYTHROUGH_DRAWER) {
            return
        }

        if (!hasJourney) {
            lgs.stores.flythrough.nearbyPois = []
            return
        }

        lgs.stores.flythrough.nearbyPois = __.ui.poiManager?.getFlythroughPOIsForJourney?.(
            currentJourney,
            flythroughSettings.poiDistance,
        ) ?? []
    }, [currentJourney, drawerOpen, flythroughSettings.poiDistance, hasJourney, journeySlug])

    const refreshFlythrough = useCallback((camera = true) => {
        __.ui.flythrough?.refresh?.({camera})
        lgs.scene?.requestRender?.()
    }, [])

    const stopRotateIfNeeded = useCallback(async (mode = null) => {
        const flythroughMarker = normalizeFlythroughMarker(lgs.settings.ui.flythrough.marker)
        const rotationRunning = lgs.stores.ui?.mainUI?.rotate?.running === true
        const effectiveMode = mode ?? flythroughMarker.mode
        if (rotationRunning && effectiveMode !== FLYTHROUGH_MARKER_MODE_TRACE) {
            await __.ui.cameraManager?.stopRotate?.()
        }
    }, [])

    const updateProgression = useCallback((updates) => {
        const nextProgression = mergeProgressionStyle(lgs.settings.ui.flythrough.progression, updates)
        lgs.settings.ui.flythrough.progression = nextProgression
        lgs.stores.flythrough.progression = nextProgression
        refreshFlythrough(false)
    }, [refreshFlythrough])

    const updateTrace = useCallback((updates) => {
        const nextTrace = mergeTrace(lgs.settings.ui.flythrough.trace, updates)
        lgs.settings.ui.flythrough.trace = nextTrace
        lgs.stores.flythrough.trace = nextTrace
        refreshFlythrough(false)
    }, [refreshFlythrough])

    const updateMarker = useCallback(async (event) => {
        await stopRotateIfNeeded(event.target.value)
        const nextMarker = mergeMarker(lgs.settings.ui.flythrough.marker, {mode: event.target.value})
        lgs.settings.ui.flythrough.marker = nextMarker
        lgs.stores.flythrough.marker = nextMarker
        refreshFlythrough(true)
    }, [refreshFlythrough, stopRotateIfNeeded])

    const updateCamera = useCallback(async (updates, {syncCamera = true} = {}) => {
        await stopRotateIfNeeded()
        const nextCamera = mergeCamera(lgs.settings.ui.flythrough.camera, updates)
        lgs.settings.ui.flythrough.camera = nextCamera
        lgs.stores.flythrough.camera = nextCamera
        lgs.stores.flythrough.cameraUpdateSource = 'drawer'
        if (cameraUpdateSourceClearTimer.current !== null) {
            clearTimeout(cameraUpdateSourceClearTimer.current)
        }
        if (cameraDraftField.current === null) {
            cameraUpdateSourceClearTimer.current = setTimeout(() => {
                if (lgs.stores.flythrough.cameraUpdateSource === 'drawer') {
                    lgs.stores.flythrough.cameraUpdateSource = null
                }
                cameraUpdateSourceClearTimer.current = null
            }, 120)
        }
        if (flythroughState.active || flythroughState.playing || flythroughState.paused) {
            lgs.stores.flythrough.cameraUserAdjusted = true
        }
        refreshFlythrough(syncCamera)
        if (syncCamera) {
            __.ui.flythrough?.refreshCamera?.({
                sample:             flythroughState.sample ?? null,
                suppressMoveEvents: true,
                source:             'drawer',
            })
        }
    }, [flythroughState.active, flythroughState.paused, flythroughState.playing, flythroughState.sample, refreshFlythrough, stopRotateIfNeeded])

    useEffect(() => () => {
        if (cameraUpdateSourceClearTimer.current !== null) {
            clearTimeout(cameraUpdateSourceClearTimer.current)
            cameraUpdateSourceClearTimer.current = null
        }
    }, [])

    const beginCameraDraft = useCallback((field, value) => {
        cameraDraftField.current = field
        lgs.stores.flythrough.cameraUpdateSource = 'drawer'
        if (cameraUpdateSourceClearTimer.current !== null) {
            clearTimeout(cameraUpdateSourceClearTimer.current)
            cameraUpdateSourceClearTimer.current = null
        }
        cameraDraftValues.current[field] = String(value)
        cameraDraftBaseline.current = {
            field,
            altitude: camera.altitude,
            heading:  camera.heading ?? 0,
            pitch:    camera.pitch,
        }
        setCameraDrafts(current => ({
            ...current,
            [field]: String(value),
        }))
    }, [camera.altitude, camera.heading, camera.pitch])

    const updateCameraDraft = useCallback((field, value) => {
        if (cameraDraftField.current !== field) {
            beginCameraDraft(field, value)
            return
        }

        lgs.stores.flythrough.cameraUpdateSource = 'drawer'
        if (cameraUpdateSourceClearTimer.current !== null) {
            clearTimeout(cameraUpdateSourceClearTimer.current)
            cameraUpdateSourceClearTimer.current = null
        }
        cameraDraftValues.current[field] = String(value)
        setCameraDrafts(current => ({
            ...current,
            [field]: String(value),
        }))
    }, [beginCameraDraft])

    const clearCameraDraft = useCallback((field) => {
        if (cameraDraftField.current === field) {
            cameraDraftField.current = null
            cameraDraftValues.current[field] = null
            if (lgs.stores.flythrough.cameraUpdateSource === 'drawer') {
                if (cameraUpdateSourceClearTimer.current !== null) {
                    clearTimeout(cameraUpdateSourceClearTimer.current)
                }
                cameraUpdateSourceClearTimer.current = setTimeout(() => {
                    if (lgs.stores.flythrough.cameraUpdateSource === 'drawer') {
                        lgs.stores.flythrough.cameraUpdateSource = null
                    }
                    cameraUpdateSourceClearTimer.current = null
                }, 120)
            }
        }
        setCameraDrafts(current => ({
            ...current,
            [field]: null,
        }))
    }, [])

    const commitCameraAltitude = useCallback((rawValue, options) => {
        if (String(rawValue ?? '').trim() === '') {
            return false
        }
        const altitude = UnitUtils.revert(rawValue, altitudeUnit)
        if (!Number.isFinite(altitude) || altitude < 10) {
            return false
        }

        const nextAltitude = clampFlythroughNumber(altitude, camera.altitude, 10, 100000)
        if (nextAltitude === camera.altitude) {
            return true
        }

        updateCamera({altitude: nextAltitude}, options)
        return true
    }, [altitudeUnit, camera.altitude, updateCamera])

    const commitCameraPitch = useCallback((rawValue) => {
        if (String(rawValue ?? '').trim() === '') {
            return false
        }
        const parsedPitch = Number(rawValue)
        if (!Number.isFinite(parsedPitch) || parsedPitch < -89 || parsedPitch > -5) {
            return false
        }
        const nextPitch = clampFlythroughNumber(parsedPitch, camera.pitch, -89, -5)
        if (nextPitch === camera.pitch) {
            return false
        }

        updateCamera({pitch: nextPitch})
        return true
    }, [camera.pitch, updateCamera])

    const commitCameraHeading = useCallback((rawValue) => {
        if (String(rawValue ?? '').trim() === '') {
            return false
        }
        const currentHeading = camera.heading ?? 0
        const parsedHeading = Number(rawValue)
        if (!Number.isFinite(parsedHeading) || parsedHeading < -180 || parsedHeading > 180) {
            return false
        }
        const nextHeading = clampFlythroughNumber(parsedHeading, currentHeading, -180, 180)
        if (nextHeading === currentHeading) {
            return false
        }

        updateCamera({heading: nextHeading})
        return true
    }, [camera.heading, updateCamera])

    const updateDuration = useCallback((event) => {
        if (durationLocked) {
            return
        }
        const duration = clampDuration(event.target.value)
        lgs.settings.ui.flythrough.duration = duration
        lgs.stores.flythrough.duration = duration
    }, [durationLocked])

    const updatePOIDistance = useCallback((event) => {
        const distance = clampFlythroughNumber(event.target.value, flythroughSettings.poiDistance, 1, 100000, true)
        lgs.settings.ui.flythrough.poiDistance = distance
        lgs.stores.flythrough.poiDistance = distance
    }, [flythroughSettings.poiDistance])

    const updatePOIFlythroughSettings = useCallback(async (poiId, updates) => {
        const poi = lgs.stores.main.components.pois.list.get(poiId)
        if (!poi?.id) {
            return
        }

        const next = normalizeFlythroughPOISettings({
                                                        ...poi.flythrough,
                                                        ...updates,
                                                        hiddenFields: {
                                                            ...(poi.flythrough?.hiddenFields ?? {}),
                                                            ...(updates?.hiddenFields ?? {}),
                                                        },
                                                    })

        await __.ui.poiManager.updatePOI(poiId, {flythrough: next}, {immediate: true})
        if (drawerOpen === FLYTHROUGH_DRAWER && hasJourney) {
            lgs.stores.flythrough.nearbyPois = __.ui.poiManager?.getFlythroughPOIsForJourney?.(
                currentJourney,
                flythroughSettings.poiDistance,
            ) ?? []
        }
    }, [currentJourney, drawerOpen, flythroughSettings.poiDistance, hasJourney])

    const updatePOIFlythroughVisibility = useCallback((poiId, event) => {
        const visible = getChecked(event)
        setPoiVisibilityOverrides(current => ({
            ...current,
            [poiId]: visible,
        }))
        void updatePOIFlythroughSettings(poiId, {visible})
    }, [updatePOIFlythroughSettings])

    const activePoiVisibilityOverrides = useMemo(() => {
        const next = {}

        Object.entries(poiVisibilityOverrides).forEach(([poiId, visible]) => {
            const poi = poiList.get(poiId)
            if (!poi?.id) {
                return
            }

            if (normalizeFlythroughPOISettings(poi.flythrough).visible !== visible) {
                next[poiId] = visible
            }
        })

        return next
    }, [poiList, poiVisibilityOverrides])

    const editFlythroughPOI = useCallback(async (poiId) => {
        await openPOIEditor(poiId, {stacked: true})
    }, [])

    const altitudeDisplayValue = cameraDrafts.altitude ?? String(Math.round(UnitUtils.convert(camera.altitude).to(altitudeUnit)))
    const pitchDisplayValue = cameraDrafts.pitch ?? String(camera.pitch)
    const headingDisplayValue = cameraDrafts.heading ?? String(camera.heading ?? 0)

    const updateSyncWithVideo = useCallback((event) => {
        const enabled = Boolean(event?.target?.checked)
        if (enabled) {
            __.ui.flythroughVideoSync?.arm({
                autoStopRecording: true,
                resetToStart:      true,
            })
        }
        else {
            __.ui.flythroughVideoSync?.disarm()
        }
    }, [])

    const updateHideOtherJourneys = useCallback((event) => {
        const enabled = Boolean(event?.target?.checked)
        lgs.settings.ui.flythrough.hideOtherJourneys = enabled
        lgs.stores.flythrough.hideOtherJourneys = enabled
        __.ui.flythrough?.setHideOtherJourneys?.(enabled)
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

    const updateAltitudeMode = useCallback((event) => {
        const nextMode = event.target.value
        if (nextMode === camera.altitudeMode) {
            updateCamera({altitudeMode: nextMode})
            return
        }
        // Keep the same visual camera height by converting the single altitude value
        // between absolute altitude and terrain offset when the mode changes.
        const currentCameraHeight = Number(lgs.viewer?.camera?.positionCartographic?.height)
        const fallbackAbsoluteHeight = Number.isFinite(currentCameraHeight) ? currentCameraHeight : camera.altitude
        const currentTerrainHeight = flythroughState.sample
                                     ? terrainHeightAt(flythroughState.sample)
                                     : terrainHeightAt({
                                           ...(lgs.viewer?.camera?.positionCartographic ?? {}),
                                           radians: true,
                                       })
        const nextAltitude = nextMode === FLYTHROUGH_CAMERA_ALTITUDE_GROUND_OFFSET
                             ? currentTerrainHeight === null
                               ? fallbackAbsoluteHeight
                               : clampFlythroughNumber(fallbackAbsoluteHeight - currentTerrainHeight, fallbackAbsoluteHeight, 10, 100000)
                             : currentTerrainHeight === null
                               ? fallbackAbsoluteHeight
                               : clampFlythroughNumber(fallbackAbsoluteHeight + currentTerrainHeight, fallbackAbsoluteHeight, 10, 100000)

        updateCamera({
            altitudeMode: nextMode,
            altitude:     nextAltitude,
        })
    }, [camera.altitude, camera.altitudeMode, flythroughState.sample, updateCamera])

    const updateCameraPositionMode = useCallback((event) => {
        updateCamera({positionMode: event.target.value})
    }, [updateCamera])

    const updateCameraPreset = useCallback((event) => {
        const presetKey = event.target.value
        if (presetKey === FLYTHROUGH_CAMERA_PRESET_CUSTOM) {
            return
        }

        const presetUpdates = getFlythroughCameraPresetUpdates(presetKey)
        if (!presetUpdates) {
            return
        }

        updateCamera(presetUpdates)
    }, [updateCamera])

    const altitudeFieldLabel = camera.altitudeMode === FLYTHROUGH_CAMERA_ALTITUDE_GROUND_OFFSET
        ? `Ground offset (${altitudeUnit})`
        : `Altitude (${altitudeUnit})`

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
        __.ui.flythrough?.restoreJourneyToolbarVisibility?.()
        __.ui.drawerManager.close()
    }, [])

    const closeDrawer = useCallback((event) => {
        if (window.isOK(event) && __.ui.drawerManager.isCurrent(FLYTHROUGH_DRAWER)) {
            __.ui.flythrough?.restoreJourneyToolbarVisibility?.()
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
                                 <div className="flythrough-sync-row">
                                     <WaSwitch
                                         label-at-start
                                         size="xs"
                                         className="flythrough-sync-switch half-width"
                                         checked={syncWithVideo}
                                         onChange={updateSyncWithVideo}
                                     >
                                         {'Sync with Video'}
                                     </WaSwitch>
                                     {syncWithVideo &&
                                         <VideoButton
                                             id="launch-the-video-editor-flythrough"
                                             tooltip="left"
                                             className="flythrough-sync-video-button square-button"
                                             variant="brand"
                                             appearance="Filled"
                                         />
                                     }
                                 </div>
                                 <WaSwitch
                                     label-at-start
                                     size="xs"
                                     className="flythrough-hide-other-journeys-switch half-width"
                                     checked={hideOtherJourneys}
                                     onChange={updateHideOtherJourneys}
                                 >
                                     {'Hide other journeys'}
                                 </WaSwitch>
                                 <div className="flythrough-total-duration-row" aria-live="polite">
                                     <span className="flythrough-total-duration-label">{'Total duration (s)'}</span>
                                     <strong className="flythrough-total-duration-value">{formatSeconds(totalVideoDurationSeconds)}</strong>
                                 </div>
                                 <WaSelect
                                     className="flythrough-progression-select half-width"
                                     label="Show"
                                     label-at-start
                                     size="s"
                                     value={trace.mode}
                                     onChange={updateTraceMode}
                                 >
                                     <WaOption value={FLYTHROUGH_TRACE_MODE_PROGRESSIVE}>{'Progress'}</WaOption>
                                     <WaOption value={FLYTHROUGH_TRACE_MODE_FULL}>{'Progress - Remain'}</WaOption>
                                 </WaSelect>
                                 <WaSelect
                                     label="Tracking"
                                     label-at-start
                                     size="s"
                                     value={marker.mode}
                                     onChange={updateMarker}
                                     className="half-width">
                                     <WaOption
                                         value={FLYTHROUGH_MARKER_MODE_TRACE}>{'Passive'}</WaOption>
                                     <WaOption
                                         value={FLYTHROUGH_MARKER_MODE_NAVIGATION}>{'Navigation'}</WaOption>
                                     <WaOption
                                         value={FLYTHROUGH_MARKER_MODE_HYSTERESIS}>{'Dynamic'}</WaOption>
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
                                     <WaTab slot="nav" panel="clips">
                                         <WaIcon name="sparkles" variant="regular"/>
                                         {'Clips'}
                                     </WaTab>
                                     <WaTab slot="nav" panel="pois">
                                         <WaIcon name="location-dot" variant="regular"/>
                                         {'POIs'}
                                     </WaTab>

                                     <WaTabPanel name="runner">
                                         <LGSScrollbars>
                                             <div className="flythrough-tab-panel">
                                                 <div className="flythrough-fieldset">
                                                     <WaNumberInput
                                                         className="flythrough-duration-input half-width"
                                                         label="Duration (s)"
                                                         size="s"
                                                         appearance="filled"
                                                         min="1"
                                                         step="1"
                                                         value={flythroughSettings.duration}
                                                         disabled={durationLocked}
                                                         onInput={updateDuration}
                                                         label-at-start/>
                                                     <WaNumberInput
                                                         className="flythrough-poi-distance-input half-width"
                                                         label="Nearby POIs (m)"
                                                         size="s"
                                                         appearance="filled"
                                                         min="1"
                                                         max="100000"
                                                         step="100"
                                                         value={flythroughSettings.poiDistance}
                                                         onInput={updatePOIDistance}
                                                         label-at-start/>
                                                     {marker.mode !== FLYTHROUGH_MARKER_MODE_TRACE &&
                                                         <WaSelect
                                                             label="Camera position"
                                                             label-at-start
                                                             size="s"
                                                             value={camera.positionMode}
                                                             onChange={updateCameraPositionMode}
                                                             className="half-width">
                                                             <WaOption
                                                                 value={FLYTHROUGH_CAMERA_POSITION_SYSTEM}>{'Fixed'}</WaOption>
                                                             <WaOption
                                                                 value={FLYTHROUGH_CAMERA_POSITION_BEHIND}>{'Behind'}</WaOption>
                                                             <WaOption
                                                                 value={FLYTHROUGH_CAMERA_POSITION_AHEAD}>{'Ahead'}</WaOption>
                                                         </WaSelect>
                                                     }
                                                 </div>
                                                 <div className="flythrough-fieldset">
                                                     <WaSelect
                                                         label="Camera altitude"
                                                         label-at-start
                                                         size="s"
                                                         value={camera.altitudeMode}
                                                         onChange={updateAltitudeMode}
                                                         className="half-width">
                                                         <WaOption
                                                             value={FLYTHROUGH_CAMERA_ALTITUDE_CONSTANT}>{'Fixed'}</WaOption>
                                                         <WaOption
                                                             value={FLYTHROUGH_CAMERA_ALTITUDE_GROUND_OFFSET}>{'Ground offset'}</WaOption>
                                                     </WaSelect>
                                                     <div className="flythrough-style-field-grid is-single">
                                                         <WaNumberInput
                                                             label={altitudeFieldLabel}
                                                             size="s"
                                                             appearance="filled"
                                                             min={Math.round(UnitUtils.convert(10).to(altitudeUnit))}
                                                             step={Math.max(1, Math.round(UnitUtils.convert(50).to(altitudeUnit)))}
                                                             value={altitudeDisplayValue}
                                                             onFocus={() => beginCameraDraft('altitude', altitudeDisplayValue)}
                                                             onInput={event => {
                                                                 updateCameraDraft('altitude', event.target.value)
                                                             }}
                                                             onChange={event => {
                                                                 updateCameraDraft('altitude', event.target.value)
                                                                 commitCameraAltitude(event.target.value, {syncCamera: false})
                                                             }}
                                                             onBlur={event => {
                                                                 const currentValue = cameraDraftValues.current.altitude ?? event.target.value
                                                                 const committed = commitCameraAltitude(currentValue, {syncCamera: false})
                                                                 if (!committed && cameraDraftBaseline.current?.field === 'altitude') {
                                                                     setCameraDrafts(current => ({
                                                                         ...current,
                                                                         altitude: String(Math.round(UnitUtils.convert(cameraDraftBaseline.current.altitude).to(altitudeUnit))),
                                                                     }))
                                                                 }
                                                                 clearCameraDraft('altitude')
                                                             }}
                                                             label-at-start className="half-width"/>
                                                         <WaNumberInput
                                                             label="Pitch (deg)"
                                                             size="s"
                                                             appearance="filled"
                                                             min="-89"
                                                             max="-5"
                                                             step="1"
                                                             value={pitchDisplayValue}
                                                             onFocus={() => beginCameraDraft('pitch', pitchDisplayValue)}
                                                             onInput={event => {
                                                                 const nextValue = event.target.value
                                                                 cameraDraftValues.current.pitch = nextValue
                                                                 setCameraDrafts(current => ({
                                                                     ...current,
                                                                     pitch: nextValue,
                                                                 }))
                                                                 commitCameraPitch(nextValue)
                                                             }}
                                                             onBlur={event => {
                                                                 const currentValue = cameraDraftValues.current.pitch ?? event.target.value
                                                                 const committed = commitCameraPitch(currentValue)
                                                                 if (!committed && cameraDraftBaseline.current?.field === 'pitch') {
                                                                     setCameraDrafts(current => ({
                                                                         ...current,
                                                                         pitch: String(cameraDraftBaseline.current.pitch),
                                                                     }))
                                                                 }
                                                                 clearCameraDraft('pitch')
                                                             }}
                                                             label-at-start className="half-width"/>
                                                         {marker.mode !== FLYTHROUGH_MARKER_MODE_TRACE && camera.positionMode === FLYTHROUGH_CAMERA_POSITION_SYSTEM && (
                                                             <WaNumberInput
                                                                 label="Heading (deg)"
                                                                 size="s"
                                                                 appearance="filled"
                                                                 min="-180"
                                                                 max="180"
                                                                 step="1"
                                                                 value={headingDisplayValue}
                                                                 onFocus={() => beginCameraDraft('heading', headingDisplayValue)}
                                                                 onInput={event => {
                                                                     const nextValue = event.target.value
                                                                     cameraDraftValues.current.heading = nextValue
                                                                     setCameraDrafts(current => ({
                                                                         ...current,
                                                                         heading: nextValue,
                                                                     }))
                                                                     commitCameraHeading(nextValue)
                                                                 }}
                                                                 onBlur={event => {
                                                                     const currentValue = cameraDraftValues.current.heading ?? event.target.value
                                                                     const committed = commitCameraHeading(currentValue)
                                                                     if (!committed && cameraDraftBaseline.current?.field === 'heading') {
                                                                         setCameraDrafts(current => ({
                                                                             ...current,
                                                                             heading: String(cameraDraftBaseline.current.heading),
                                                                         }))
                                                                     }
                                                                     clearCameraDraft('heading')
                                                                 }}
                                                                 label-at-start className="half-width"/>
                                                         )}
                                                     </div>
                                                 </div>
                                                {marker.mode === FLYTHROUGH_MARKER_MODE_HYSTERESIS && (
                                                     <div className="flythrough-fieldset">
                                                         <WaSelect
                                                             label="Camera feel"
                                                             label-at-start
                                                             size="s"
                                                             value={cameraPresetKey}
                                                             onChange={updateCameraPreset}
                                                             className="half-width">
                                                             {FLYTHROUGH_CAMERA_PRESETS.map(preset => (
                                                                 <WaOption key={preset.key} value={preset.key}>
                                                                     {preset.label}
                                                                 </WaOption>
                                                             ))}
                                                             <WaOption value={FLYTHROUGH_CAMERA_PRESET_CUSTOM}>{'Custom'}</WaOption>
                                                         </WaSelect>
                                                         <WaNumberInput
                                                             label="Dynamic"
                                                             size="s"
                                                             appearance="filled"
                                                             min={FLYTHROUGH_HYSTERESIS_MARGIN_RATIO_MIN}
                                                             max={FLYTHROUGH_HYSTERESIS_MARGIN_RATIO_MAX}
                                                             step="0.01"
                                                             value={camera.hysteresis.marginRatio}
                                                             onInput={updateHysteresisMarginRatio}
                                                             label-at-start className="half-width"/>
                                                         <WaNumberInput
                                                             label="Recenter easing"
                                                             size="s"
                                                             appearance="filled"
                                                             min={FLYTHROUGH_HYSTERESIS_EASING_MIN}
                                                             max={FLYTHROUGH_HYSTERESIS_EASING_MAX}
                                                             step="0.01"
                                                             value={camera.hysteresis.easing}
                                                             onInput={updateHysteresisEasing}
                                                             label-at-start className="half-width"/>
                                                         <WaNumberInput
                                                             label="Stop threshold"
                                                             size="s"
                                                             appearance="filled"
                                                             min={FLYTHROUGH_HYSTERESIS_STOP_THRESHOLD_MIN}
                                                             max={FLYTHROUGH_HYSTERESIS_STOP_THRESHOLD_MAX}
                                                             step="0.000001"
                                                             value={camera.hysteresis.stopThreshold}
                                                             onInput={updateHysteresisStopThreshold}
                                                             label-at-start className="half-width"/>
                                                     </div>
                                                 )}
                                             </div>
                                         </LGSScrollbars>
                                     </WaTabPanel>

                                     <WaTabPanel name="edit">
                                         <LGSScrollbars>
                                             <div className="flythrough-tab-panel">
                                                 <>
                                                     <section className="flythrough-progression-section">
                                                         {trace.mode === FLYTHROUGH_TRACE_MODE_FULL &&
                                                             <>
                                                                 <h3>{'Remaining trace'}</h3>

                                                                 <WaSwitch
                                                                     className="flythrough-track-style-switch half-width"
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
                                                             </>
                                                         }
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

                                                 <section className="flythrough-progression-section">
                                                     <h3>{'Profile'}</h3>
                                                     <div className="flythrough-style-control-group">
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
                                                 </section>
                                             </div>
                                         </LGSScrollbars>
                                     </WaTabPanel>

                                     <WaTabPanel name="clips">
                                         <LGSScrollbars>
                                             <div className="flythrough-tab-panel">
                                                 <FlythroughClipsTab
                                                     settings={flythroughSettings}
                                                     state={flythroughState}
                                                 />
                                             </div>
                                         </LGSScrollbars>
                                     </WaTabPanel>
                                     <WaTabPanel name="pois">
                                         <LGSScrollbars>
                                             <div className="flythrough-tab-panel">
                                                 {nearbyPOIs.length === 0 ? (
                                                     <p className="flythrough-empty-state">{'No flythrough POI matches for the current journey.'}</p>
                                                 ) : (
                                                      <div className="lgs--details-list">
                                                          {nearbyPOIs.map(entry => {
                                                              const poi = poiList.get(entry?.poi?.id) ?? entry?.poi
                                                              if (!poi?.id) {
                                                                  return null
                                                              }

                                                              const settings = normalizeFlythroughPOISettings(poi.flythrough)
                                                              const flythroughEnabled = activePoiVisibilityOverrides[poi.id] ?? settings.visible !== false
                                                              const animated = settings.animated !== false
                                                              const visibilityButtonId = `flythrough-poi-visibility-${poi.id}`
                                                              const animationButtonId = `flythrough-poi-animation-${poi.id}`
                                                              const toggleVisibility = event => {
                                                                  event.preventDefault()
                                                                  event.stopPropagation()
                                                                  updatePOIFlythroughVisibility(poi.id, {
                                                                      target: {
                                                                          checked: !flythroughEnabled,
                                                                      },
                                                                  })
                                                              }
                                                              const toggleAnimation = event => {
                                                                  event.preventDefault()
                                                                  event.stopPropagation()
                                                                  void updatePOIFlythroughSettings(poi.id, {
                                                                      animated: !animated,
                                                                  })
                                                              }

                                                              return (
                                                                  <WaDetails key={poi.id}
                                                                             className="flythrough-poi-details lgs--details-hoverable">
                                                                      <span slot="summary"
                                                                            className="flythrough-poi-summary">
                                                                          <span className="flythrough-poi-summary-title">
                                                                              <WaIcon variant="regular"
                                                                                      className="poi-duotone-icon"
                                                                                      name={entry?.source === 'journey-poi' ? 'route' : 'location-dot'}/>
                                                                              <strong>{poi.title ?? poi.id}</strong>
                                                                          </span>
                                                                          <span
                                                                              className="flythrough-poi-summary-actions">
                                                                              <WaTooltip for={visibilityButtonId}
                                                                                         placement="top">
                                                                                  {flythroughEnabled ? 'Hide POI during flythrough' : 'Show POI during flythrough'}
                                                                              </WaTooltip>
                                                                              <WaButton
                                                                                  id={visibilityButtonId}
                                                                                  className="flythrough-poi-summary-button"
                                                                                  appearance="plain"
                                                                                  variant="brand"
                                                                                  size="s"
                                                                                  aria-label={flythroughEnabled ? 'Hide POI during flythrough' : 'Show POI during flythrough'}
                                                                                  aria-pressed={flythroughEnabled}
                                                                                  onClick={toggleVisibility}
                                                                              >
                                                                                  <WaIcon
                                                                                      name={flythroughEnabled ? 'eye-slash' : 'eye'}
                                                                                      variant="regular"/>
                                                                              </WaButton>
                                                                              <WaTooltip for={animationButtonId}
                                                                                         placement="top">
                                                                                  {animated ? 'Disable POI animation during flythrough' : 'Enable POI animation during flythrough'}
                                                                              </WaTooltip>
                                                                              <WaButton
                                                                                  id={animationButtonId}
                                                                                  className="flythrough-poi-summary-button"
                                                                                  appearance="plain"
                                                                                  variant="brand"
                                                                                  size="s"
                                                                                  aria-label={animated ? 'Disable POI animation during flythrough' : 'Enable POI animation during flythrough'}
                                                                                  aria-pressed={animated}
                                                                                  onClick={toggleAnimation}
                                                                              >
                                                                                  <WaIcon
                                                                                      name={animated ? 'expand' : 'compress'}
                                                                                  variant="regular"/>
                                                                              </WaButton>
                                                                          </span>
                                                                      </span>
                                                                      <div className="flythrough-poi-details-body">
                                                                          <div className="flythrough-poi-switches">
                                                                              <WaSwitch
                                                                                  size="xs"
                                                                                  label-at-start
                                                                                  checked={flythroughEnabled}
                                                                                  onInput={event => updatePOIFlythroughVisibility(poi.id, event)}
                                                                              >
                                                                                  {'Show during flythrough'}
                                                                              </WaSwitch>
                                                                          </div>
                                                                          {flythroughEnabled && (
                                                                              <div
                                                                                  key={`flythrough-poi-options-${poi.id}`}
                                                                                  className="flythrough-poi-options">
                                                                                  <div
                                                                                      className="flythrough-poi-animated-switch">
                                                                                      <WaSwitch
                                                                                          size="xs"
                                                                                          label-at-start
                                                                                          checked={settings.animated !== false}
                                                                                          onInput={event => updatePOIFlythroughSettings(poi.id, {
                                                                                              animated: getChecked(event),
                                                                                          })}
                                                                                      >
                                                                                          {'Animate during flythrough'}
                                                                                      </WaSwitch>
                                                                                  </div>
                                                                                  <div className="flythrough-fieldset">
                                                                                      <WaNumberInput
                                                                                          className="half-width"
                                                                                          label="Duration (s)"
                                                                                          size="s"
                                                                                          appearance="filled"
                                                                                          min="0"
                                                                                          max="60"
                                                                                          step="1"
                                                                                          value={settings.displayDurationSeconds}
                                                                                          onInput={event => updatePOIFlythroughSettings(poi.id, {
                                                                                              displayDurationSeconds: Math.round(clampFlythroughNumber(
                                                                                                  event.target.value,
                                                                                                  settings.displayDurationSeconds,
                                                                                                  0,
                                                                                                  60,
                                                                                              )),
                                                                                          })}
                                                                                          label-at-start
                                                                                      />
                                                                                  </div>
                                                                                  <div
                                                                                      className="flythrough-poi-hidden-fields">
                                                                                      {FLYTHROUGH_POI_HIDDEN_FIELDS.map(field => (
                                                                                          <WaSwitch
                                                                                              key={`${poi.id}-${field.key}`}
                                                                                              size="xs"
                                                                                              label-at-start
                                                                                              checked={settings.hiddenFields[field.key] === true}
                                                                                              onInput={event => updatePOIFlythroughSettings(poi.id, {
                                                                                                  hiddenFields: {
                                                                                                      [field.key]: getChecked(event),
                                                                                                  },
                                                                                              })}
                                                                                          >
                                                                                              {field.label}
                                                                                          </WaSwitch>
                                                                                      ))}
                                                                                  </div>
                                                                              </div>
                                                                          )}
                                                                          <div className="flythrough-poi-actions">
                                                                              <WaButton size="s" appearance="outlined"
                                                                                        onClick={() => editFlythroughPOI(poi.id)}>
                                                                                  {'Edit POI'}
                                                                              </WaButton>
                                                                          </div>
                                                                      </div>
                                                                  </WaDetails>
                                                              )
                                                          })}
                                                      </div>
                                                  )}
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
