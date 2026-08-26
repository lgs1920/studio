/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayDrawer.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-04
 * Last modified: 2026-08-04
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import DrawerFooter from '@Components/DrawerFooter'
import { JourneyReplayProgressBar } from '@Components/JourneyReplay/JourneyReplayProgressBar'
import { JourneyReplayClipsTab } from '@Components/JourneyReplay/JourneyReplayClipsTab'
import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import { openPOIEditor }                  from '@Components/MainUI/MapPOI/openPOIEditor'
import { VideoButton } from '@Components/MainUI/video/VideoButton'
import { formatSliderPercent } from '@Components/MainUI/widgets/editor/elements/sliderUtils'
import PanelActions from '@Components/PanelsActions'
import { PopupAnchor } from '@Components/PopupAnchor'
import { PopupDrawer } from '@Components/PopupDrawer'
import WaDrawer     from '@Components/WaDrawerNonModal'
import { REPLAY_DRAWER } from '@Core/constants'
import classNames from 'classnames'
import { getJourneyReplayHideOtherJourneys } from '@Core/ui/JourneyVisibility'
import {
    clampJourneyReplayNumber, DEFAULT_REPLAY_CAMERA, DEFAULT_REPLAY_SCOPE, ensureJourneyReplaySettings, REPLAY_CAMERA_ALTITUDE_CONSTANT,
    REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET, REPLAY_CAMERA_POSITION_AHEAD, REPLAY_CAMERA_POSITION_BEHIND,
    REPLAY_CAMERA_HEADING_OFFSET_MAX, REPLAY_CAMERA_HEADING_OFFSET_MIN, REPLAY_CAMERA_POSITION_SYSTEM,
    REPLAY_LABEL, REPLAY_MARKER_MODE_HYSTERESIS,
    REPLAY_MARKER_MODE_NAVIGATION, REPLAY_MARKER_MODE_TRACE, REPLAY_PROFILE_MARKER_BORDER_MAX_WIDTH,
    REPLAY_PROFILE_MARKER_BORDER_MIN_WIDTH, REPLAY_PROFILE_MARKER_FILL_MAX_SIZE,
    REPLAY_PROFILE_MARKER_FILL_MIN_SIZE, REPLAY_PROGRESSION_BORDER_MAX_WIDTH,
    REPLAY_PROGRESSION_BORDER_MIN_WIDTH, REPLAY_PROGRESSION_FILL_MAX_WIDTH,
    REPLAY_PROGRESSION_FILL_MIN_WIDTH, REPLAY_TRACE_MODE_FULL, REPLAY_TRACE_MODE_PROGRESSIVE,
    REPLAY_CAMERA_PRESET_CUSTOM, REPLAY_CAMERA_PRESETS, REPLAY_HYSTERESIS_EASING_MAX,
    REPLAY_HYSTERESIS_EASING_MIN,
    REPLAY_HYSTERESIS_MARGIN_RATIO_MAX, REPLAY_HYSTERESIS_MARGIN_RATIO_MIN,
    REPLAY_CAMERA_SENSITIVITY_MAX, REPLAY_CAMERA_SENSITIVITY_MIN,
    REPLAY_CAMERA_TILE_PRELOAD_HORIZON_MAX_MS, REPLAY_CAMERA_TILE_PRELOAD_HORIZON_MIN_MS,
    REPLAY_READINESS_POLICY_ADAPTIVE, REPLAY_READINESS_POLICY_CUSTOM, REPLAY_READINESS_POLICY_OFF,
    REPLAY_READINESS_POLICY_STRICT,
    REPLAY_EFFECT_GLOW, REPLAY_EFFECT_NEON, REPLAY_EFFECT_NONE,
    REPLAY_SMOOTHING_MAX_STEP, REPLAY_SMOOTHING_MIN_STEP,
    getJourneyReplayCameraPresetKey, getJourneyReplayCameraPresetUpdates, normalizeJourneyReplayCamera, normalizeJourneyReplayMarker, normalizeJourneyReplayProfileInfo,
    normalizeJourneyReplayProgressionStyle, normalizeJourneyReplaySmoothing, normalizeJourneyReplayTrace,
    normalizeJourneyReplayReadiness,
}                 from '@Core/ui/replay/JourneyReplayProgressionStyle'
import { normalizeJourneyReplayClips } from '@Core/ui/replay/JourneyReplayClips'
import { normalizeJourneyReplayPOISettings } from '@Core/ui/replay/JourneyReplayPOISettings'
import { isJourneyReplayCameraActive } from '@Core/ui/replay/JourneyReplayRuntime'
import { FA_CAMERA_SLIDERS_SRC } from '@Utils/FA2WA'
import { ELEVATION_UNITS, UnitUtils } from '@Utils/UnitUtils'
import {
    WaBadge, WaButton, WaCard, WaColorPicker, WaDetails, WaDivider, WaIcon, WaNumberInput, WaOption, WaSelect, WaSlider,
    WaSwitch, WaTab, WaTooltip,
    WaTabGroup,
    WaTabPanel,
}                 from '@web.awesome.me/webawesome-pro/dist/react'
import { colord } from 'colord'
import { Cartographic } from 'cesium'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal }      from 'react-dom'
import { useSnapshot }       from 'valtio'
import { useOptionalSnapshot } from '@Utils/ValtioUtils'
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

/**
 * Captures the current Cesium canvas for the effect preview background.
 *
 * @returns {string|null} A compact data URL, or null when the scene is unavailable.
 */
const buildReplayPreviewBackground = () => {
    try {
        const source = lgs.canvas
        if (!source?.width || !source?.height) {
            return null
        }

        lgs.scene?.render?.()
        const width = Math.min(source.width, 1024)
        const height = Math.max(1, Math.round(width * source.height / source.width))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) {
            return null
        }

        context.drawImage(source, 0, 0, source.width, source.height, 0, 0, width, height)
        return canvas.toDataURL('image/webp', 0.8)
    }
    catch {
        return null
    }
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

const JourneyReplayStyleField = ({children}) => (
    <div className="replay-style-field">
        {children}
    </div>
)

const mergeProgressionStyle = (current, updates) => normalizeJourneyReplayProgressionStyle({
                                                                                            ...current,
                                                                                            ...updates,
                                                                                            effect: {
                                                                                                ...(current?.effect ?? {}),
                                                                                                ...(updates?.effect ?? {}),
                                                                                            },
                                                                                            fill:   {
                                                                                                ...(current?.fill ?? {}),
                                                                                                ...(updates?.fill ?? {}),
                                                                                            },
                                                                                            border: {
                                                                                                ...(current?.border ?? {}),
                                                                                                ...(updates?.border ?? {}),
                                                                                            },
                                                                                        })

const mergeTrace = (current, updates) => normalizeJourneyReplayTrace({
                                                                      ...current,
                                                                      ...updates,
                                                                      remaining: {
                                                                          ...current?.remaining,
                                                                          ...updates?.remaining,
                                                                      },
                                                                  })

const mergeSmoothing = (current, updates) => normalizeJourneyReplaySmoothing({
                                                                                ...current,
                                                                                ...updates,
                                                                            })

const mergeCamera = (current, updates) => normalizeJourneyReplayCamera({
                                                                        ...current,
                                                                        ...updates,
                                                                        playback: {
                                                                            ...(current?.playback ?? {}),
                                                                            ...(updates?.playback ?? {}),
                                                                        },
                                                                        hysteresis: {
                                                                            ...(current?.hysteresis ?? {}),
                                                                            ...(updates?.hysteresis ?? {}),
                                                                            zone: {
                                                                                ...(current?.hysteresis?.zone ?? {}),
                                                                                ...(updates?.hysteresis?.zone ?? {}),
                                                                            },
                                                                        },
                                                                    })

const mergeMarker = (current, updates) => normalizeJourneyReplayMarker({
                                                                        ...current,
                                                                        ...updates,
                                                                        position: updates?.position === null
                                                                                  ? null
                                                                                  : {
                                                                                ...(current?.position ?? {}),
                                                                                ...(updates?.position ?? {}),
                                                                            },
                                                                    })

const JourneyReplayColorField = ({
                                  label,
                                  ariaLabel = label || 'Color',
                                  color,
                                  opacity,
                                  swatches,
                                  onColorInput,
                                  onOpacityInput,
                              }) => (
    <JourneyReplayStyleField>
        <div className="replay-color-control">
            <WaColorPicker
                className="replay-color-picker"
                size="s"
                aria-label={ariaLabel}
                value={color}
                swatches={swatches}
                onInput={onColorInput}
            />
            <WaSlider
                className="replay-opacity-slider half-width"
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
    </JourneyReplayStyleField>
)

const JourneyReplayWidthField = ({label, unit = 'm', value, min, max, step, onInput}) => (
    <JourneyReplayStyleField>
        <WaNumberInput
            label={`${label} (${unit})`}
            className="replay-width-input half-width"
            size="s"
            appearance="filled"
            min={min}
            max={max}
            step={step}
            value={value}
            onInput={onInput}
            label-at-start/>
    </JourneyReplayStyleField>
)

/**
 * Renders a compact map-like preview of the selected replay effect.
 *
 * @param {object} props - Preview mode, opacity, and replay colors.
 * @returns {JSX.Element} The visual effect preview.
 */
const toPreviewRem = value => `${Math.max(0.04, Number(value).toFixed(2))}rem`

/**
 * Converts Cesium replay dimensions into compact preview dimensions while preserving their ratios.
 *
 * @param {number} fillWidth - Replay trace and marker width in meters.
 * @param {number} borderWidth - Replay border width in meters.
 * @returns {{routeCoreWidth: string, routeBorderWidth: string, routeInnerWidth: string, markerSize: string, markerBorderWidth: string}}
 */
const resolveReplayEffectPreviewSizing = (fillWidth, borderWidth) => {
    const routeCoreWidth = Math.max(0.1, fillWidth * 0.12)
    const routeBorderWidth = routeCoreWidth + Math.max(0.08, borderWidth * 0.12)
    const routeInnerWidth = routeCoreWidth + Math.max(0.12, borderWidth * 0.16)

    return {
        routeCoreWidth:   toPreviewRem(routeCoreWidth),
        routeBorderWidth: toPreviewRem(routeBorderWidth),
        routeInnerWidth:  toPreviewRem(routeInnerWidth),
        markerSize:       toPreviewRem(0.58 + (fillWidth * 0.18)),
        markerBorderWidth: borderWidth > 0 ? toPreviewRem(borderWidth * 0.1) : '0rem',
    }
}

const JourneyReplayEffectPreview = ({mode, fillColor, borderColor, backgroundImage, fillWidth, borderWidth, fillOpacity, borderOpacity}) => {
    const sizing = resolveReplayEffectPreviewSizing(fillWidth, borderWidth)

    return (
        <div
            className={`replay-effect-preview replay-effect-preview-${mode}`}
            data-testid="replay-effect-preview"
            data-preview-fill-width={fillWidth}
            data-preview-border-width={borderWidth}
            style={{
                '--replay-effect-preview-fill':             fillColor,
                '--replay-effect-preview-border':           borderColor,
                '--replay-effect-preview-fill-opacity':     `${fillOpacity * 100}%`,
                '--replay-effect-preview-border-opacity':   `${borderOpacity * 100}%`,
                '--replay-effect-preview-background':       backgroundImage ? `url(${backgroundImage})` : 'none',
                '--replay-effect-preview-route-core-width': sizing.routeCoreWidth,
                '--replay-effect-preview-route-border-width': sizing.routeBorderWidth,
                '--replay-effect-preview-route-inner-width': sizing.routeInnerWidth,
                '--replay-effect-preview-marker-size':      sizing.markerSize,
                '--replay-effect-preview-marker-border-width': sizing.markerBorderWidth,
            }}
        >
            <div className="replay-effect-preview-map" aria-hidden="true">
                <svg
                    className="replay-effect-preview-route"
                    viewBox="0 0 160 80"
                    preserveAspectRatio="none"
                >
                    <path
                        className="replay-effect-preview-route-border"
                        d="M -10 40 H 170"
                    />
                    <path
                        className="replay-effect-preview-route-inner"
                        d="M -10 40 H 170"
                    />
                    <path
                        className="replay-effect-preview-route-core"
                        d="M -10 40 H 170"
                    />
                </svg>
                <span className="replay-effect-preview-marker">
                    <span className="replay-effect-preview-marker-outer"/>
                    <span className="replay-effect-preview-marker-inner"/>
                    <span className="replay-effect-preview-marker-core"/>
                </span>
            </div>
        </div>
    )
}

const JourneyReplayTabLabelWithBadge = ({icon, label, count, ariaLabel}) => (
    <span className="lgs-tab-with-badge">
        <span className="lgs-tab-with-badge-label">
            <WaIcon name={icon} variant="regular"/>
            {label}
        </span>
        {count > 0 && (
            <WaBadge
                className="lgs-tab-selection-count"
                variant="brand"
                appearance="filled"
                pill
                aria-label={ariaLabel}
            >
                {count}
            </WaBadge>
        )}
    </span>
)

const JourneyReplayProgressionGroup = ({
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
    <section className="replay-style-subsection">
        <h4 className="replay-style-subtitle">{title}</h4>
        <div className="replay-style-control-group">
            <JourneyReplayColorField
                label=""
                ariaLabel={`${title} color`}
                color={color}
                opacity={opacity}
                swatches={swatches}
                onColorInput={onColorInput}
                onOpacityInput={onOpacityInput}
            />
                <JourneyReplayWidthField
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

const REPLAY_POI_HIDDEN_FIELDS = [
    {key: 'location', label: 'Hide location'},
    {key: 'category', label: 'Hide category'},
    {key: 'altitude', label: 'Hide altitude'},
    {key: 'coordinates', label: 'Hide coordinates'},
]
const REPLAY_TAB_RUNNER = 'runner'
const REPLAY_TAB_STYLE = 'style'
const REPLAY_TAB_POIS = 'pois'
const REPLAY_ADVANCED_CAMERA_POPUP_ANCHOR_ID = 'replay-advanced-camera-popup-anchor'
const REPLAY_ADVANCED_CAMERA_SETUP_BUTTON_ID = 'replay-advanced-camera-setup-button'

export const JourneyReplayDrawer = memo(() => {
    const {drawers: {open: drawerOpen}} = useSnapshot(lgs.stores.ui)
    const {theJourney: currentJourney} = useSnapshot(lgs.stores.main)
    const poiList = lgs.stores.main.components.pois.list
    const replayState = useSnapshot(lgs.stores.replay)
    ensureJourneyReplaySettings()
    const replaySettings = useSnapshot(lgs.settings.ui.replay)
    useOptionalSnapshot(lgs.settings.journey)
    const {current: unitSystem} = useSnapshot(lgs.settings.unitSystem)
    const {drawer: drawerPlacement} = useSnapshot(lgs.editorSettingsProxy.menu)
    const swatches = useOptionalSnapshot(lgs.settings.swatches, {list: []}).list.join(';')
    const altitudeUnit = ELEVATION_UNITS[unitSystem] ?? ELEVATION_UNITS[0]
    const journeySlug = currentJourney?.slug
    const hasJourney = Boolean(journeySlug)
    const previousJourneySlug = useRef(journeySlug)
    const drawerRef = useRef(null)
    const progression = normalizeJourneyReplayProgressionStyle(replaySettings.progression)
    const effectMode = progression.effect.mode
    const fillColor = toOpaqueColorValue(progression.fill.color)
    const borderColor = toOpaqueColorValue(progression.border.color)
    const fillOpacity = progression.fill.opacity
    const borderOpacity = progression.border.opacity
    const fillWidth = progression.fill.width
    const borderWidth = progression.border.width
    const fillProfileMarker = progression.fill.profileMarker
    const borderProfileMarker = progression.border.profileMarker
    const trace = normalizeJourneyReplayTrace(replaySettings.trace)
    const smoothing = normalizeJourneyReplaySmoothing(replaySettings.smoothing)
    const clips = useMemo(() => normalizeJourneyReplayClips({
                                                             catalog: replaySettings.clips?.catalog ?? replaySettings.clips?.definitions ?? {},
                                                             start:   Array.isArray(currentJourney?.replay?.start)
                                                                      ? currentJourney.replay.start
                                                                      : replaySettings.clips?.start ?? [],
                                                             stop:    Array.isArray(currentJourney?.replay?.stop)
                                                                      ? currentJourney.replay.stop
                                                                      : replaySettings.clips?.stop ?? [],
                                                         }), [currentJourney, replaySettings.clips])
    const selectedClipCount = useMemo(() => [...(clips.start ?? []), ...(clips.stop ?? [])]
        .length, [clips.start, clips.stop])
    const remainingUseDefinedTrackStyle = trace.remaining.useDefinedTrackStyle !== false
    const remainingColor = toOpaqueColorValue(trace.remaining.color)
    const camera = normalizeJourneyReplayCamera(replaySettings.camera)
    const readiness = normalizeJourneyReplayReadiness(replaySettings.readiness)
    const [activeTab, setActiveTab] = useState(REPLAY_TAB_RUNNER)
    const [advancedCameraPopupOpen, setAdvancedCameraPopupOpen] = useState(false)
    const advancedCameraSetupLabel = advancedCameraPopupOpen ? 'Close advanced camera setup' : 'Advanced camera setup'
    const [effectPreviewBackground, setEffectPreviewBackground] = useState(null)
    const nearbyPOIs = useMemo(() => {
        if (activeTab !== REPLAY_TAB_POIS) {
            return []
        }

        const entries = Array.isArray(replayState.nearbyPois)
            ? replayState.nearbyPois.filter(entry => {
                const poi = poiList.get(entry?.poi?.id) ?? entry?.poi
                return poi?.tooClose !== true
            })
            : []
        return entries.sort((left, right) => {
            const leftDistance = finiteNumber(left?.projectedAbscissa)
            const rightDistance = finiteNumber(right?.projectedAbscissa)
            if (leftDistance === null && rightDistance === null) {
                return 0
            }
            if (leftDistance === null) {
                return 1
            }
            if (rightDistance === null) {
                return -1
            }
            return leftDistance - rightDistance
        })
    }, [activeTab, replayState.nearbyPois, poiList])
    const hideAllPoisDuringJourneyReplay = replaySettings.hideAllPoisDuringJourneyReplay === true
    const animateAllPoisDuringJourneyReplay = replaySettings.animateAllPoisDuringJourneyReplay === true
    const cameraPresetKey = getJourneyReplayCameraPresetKey(camera)
    const marker = normalizeJourneyReplayMarker(replaySettings.marker)
    const hideOtherJourneys = getJourneyReplayHideOtherJourneys()
    const durationLocked = replayState.active || replayState.playing || replayState.paused
    const syncWithVideo = replayState.recordingSync === true
    const [poiVisibilityOverrides, setPoiVisibilityOverrides] = useState({})
    const [, setPoiRevision] = useState(0)
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
    const nearbyPoisRefreshTimer = useRef(null)
    const totalVideoDurationSeconds = useMemo(() => {
        const clipDurationSeconds = [...(clips.start ?? []), ...(clips.stop ?? [])]
            .reduce((total, clip) => total + Math.max(0, finiteNumber(clip?.params?.duration) ?? 0), 0)

        return Math.max(0, finiteNumber(replaySettings.duration) ?? 0) + clipDurationSeconds
    }, [clips.start, clips.stop, replaySettings.duration])

    useEffect(() => {
        const replayRuntime = lgs.stores.replay
        const journeyChanged = previousJourneySlug.current !== journeySlug
        previousJourneySlug.current = journeySlug

        if (journeyChanged && (replayRuntime.active || replayRuntime.playing || replayRuntime.paused)) {
            __.ui.replay?.stop?.()
        }

        replayRuntime.journeySlug = journeySlug
        replayRuntime.duration = replaySettings.duration
        replayRuntime.poiDistance = replaySettings.poiDistance
        lgs.settings.ui.replay.direction = 1
        replayRuntime.direction = 1
        replayRuntime.scope = DEFAULT_REPLAY_SCOPE
        replayRuntime.progression = normalizeJourneyReplayProgressionStyle(replaySettings.progression)
        replayRuntime.profileInfo = normalizeJourneyReplayProfileInfo(replaySettings.profileInfo)
        replayRuntime.trace = normalizeJourneyReplayTrace(replaySettings.trace)
        replayRuntime.smoothing = normalizeJourneyReplaySmoothing(replaySettings.smoothing)
        replayRuntime.marker = normalizeJourneyReplayMarker(replaySettings.marker)
        replayRuntime.camera = normalizeJourneyReplayCamera(replaySettings.camera)
        replayRuntime.readiness = normalizeJourneyReplayReadiness(replaySettings.readiness)
        replayRuntime.hideAllPoisDuringJourneyReplay = replaySettings.hideAllPoisDuringJourneyReplay === true
        replayRuntime.animateAllPoisDuringJourneyReplay = replaySettings.animateAllPoisDuringJourneyReplay === true
        replayRuntime.clips = clips
        replayRuntime.hideOtherJourneys = replayState.hideOtherJourneys === true
        replayRuntime.inheritHideOtherJourneys = replayState.inheritHideOtherJourneys !== false

        if (journeyChanged) {
            replayRuntime.progress = 0
            replayRuntime.sample = null
            replayRuntime.elapsedMillis = null
            replayRuntime.durationMillis = null
            replayRuntime.totalDistance = 0
            replayRuntime.nearbyPois = []
        }
    }, [
        replaySettings.duration,
                  replaySettings.poiDistance,
        replaySettings.profileInfo,
        replaySettings.progression,
        replaySettings.smoothing,
        replaySettings.trace,
        replaySettings.marker,
        replaySettings.camera,
        replaySettings.readiness,
        replaySettings.hideAllPoisDuringJourneyReplay,
        replaySettings.animateAllPoisDuringJourneyReplay,
        replaySettings.clips,
        replayState.hideOtherJourneys,
        replayState.inheritHideOtherJourneys,
        clips,
        currentJourney?.replay?.start,
        currentJourney?.replay?.stop,
        journeySlug,
    ])

    useEffect(() => {
        if (drawerOpen !== REPLAY_DRAWER || !hasJourney) {
            return
        }

        const replayRuntime = lgs.stores.replay
        replayRuntime.toolbarVisible = true
    }, [drawerOpen, hasJourney])

    useEffect(() => {
        if (drawerOpen === REPLAY_DRAWER) {
            setActiveTab(REPLAY_TAB_RUNNER)
        }
    }, [drawerOpen, journeySlug])

    useEffect(() => {
        if (drawerOpen !== REPLAY_DRAWER || activeTab !== REPLAY_TAB_RUNNER) {
            setAdvancedCameraPopupOpen(false)
        }
    }, [activeTab, drawerOpen])

    useEffect(() => {
        if (drawerOpen !== REPLAY_DRAWER || activeTab !== REPLAY_TAB_STYLE) {
            return
        }

        const frame = requestAnimationFrame(() => {
            setEffectPreviewBackground(buildReplayPreviewBackground())
        })

        return () => cancelAnimationFrame(frame)
    }, [activeTab, drawerOpen, journeySlug])

    useEffect(() => {
        if (drawerOpen === REPLAY_DRAWER) {
            __.ui.drawerManager.restoreDrawerUiState?.(drawerRef.current)
        }
    }, [drawerOpen])

    useEffect(() => {
        if (drawerOpen !== REPLAY_DRAWER || activeTab !== REPLAY_TAB_POIS) {
            return
        }

        if (!hasJourney) {
            if (Array.isArray(lgs.stores.replay.nearbyPois) && lgs.stores.replay.nearbyPois.length > 0) {
                lgs.stores.replay.nearbyPois = []
            }
            return
        }

        if (nearbyPoisRefreshTimer.current !== null) {
            clearTimeout(nearbyPoisRefreshTimer.current)
            nearbyPoisRefreshTimer.current = null
        }

        nearbyPoisRefreshTimer.current = setTimeout(() => {
            nearbyPoisRefreshTimer.current = null
            if (__.ui.drawerManager?.isCurrent?.(REPLAY_DRAWER) !== true) {
                return
            }

            const nextNearbyPois = __.ui.poiManager?.getJourneyReplayPOIsForJourney?.(
                currentJourney,
                replaySettings.poiDistance,
            ) ?? []
            const currentNearbyPois = Array.isArray(lgs.stores.replay.nearbyPois) ? lgs.stores.replay.nearbyPois : []
            const sameLength = currentNearbyPois.length === nextNearbyPois.length
            const sameEntries = sameLength && currentNearbyPois.every((entry, index) => {
                const nextEntry = nextNearbyPois[index]
                return entry?.poi?.id === nextEntry?.poi?.id
                    && entry?.projectedAbscissa === nextEntry?.projectedAbscissa
                    && entry?.distanceToJourneyMeters === nextEntry?.distanceToJourneyMeters
                    && entry?.source === nextEntry?.source
            })

            if (!sameEntries) {
                lgs.stores.replay.nearbyPois = nextNearbyPois
            }
        }, 0)
    }, [activeTab, currentJourney, drawerOpen, replaySettings.poiDistance, hasJourney, journeySlug])

    const refreshJourneyReplay = useCallback((camera = true, rebuildSampler = false) => {
        const replayRuntime = lgs.stores.replay
        const replayVisible = replayRuntime.active
            || replayRuntime.playing
            || replayRuntime.paused
            || replayRuntime.clipSequenceActive
            || Boolean(replayRuntime.sample)
        if (rebuildSampler && !replayVisible) {
            return
        }
        __.ui.replay?.refresh?.(rebuildSampler ? {camera, rebuildSampler} : {camera})
        lgs.scene?.requestRender?.()
    }, [])

    const stopRotateIfNeeded = useCallback(async (mode = null) => {
        const replayMarker = normalizeJourneyReplayMarker(lgs.settings.ui.replay.marker)
        const rotationRunning = lgs.stores.ui?.mainUI?.rotate?.running === true
        const effectiveMode = mode ?? replayMarker.mode
        if (rotationRunning && (mode === null || effectiveMode !== REPLAY_MARKER_MODE_TRACE)) {
            await __.ui.cameraManager?.stopRotate?.()
        }
    }, [])

    const updateProgression = useCallback((updates) => {
        const nextProgression = mergeProgressionStyle(lgs.settings.ui.replay.progression, updates)
        lgs.settings.ui.replay.progression = nextProgression
        lgs.stores.replay.progression = nextProgression
        refreshJourneyReplay(false)
    }, [refreshJourneyReplay])

    const updateTrace = useCallback((updates) => {
        const nextTrace = mergeTrace(lgs.settings.ui.replay.trace, updates)
        lgs.settings.ui.replay.trace = nextTrace
        lgs.stores.replay.trace = nextTrace
        refreshJourneyReplay(false)
    }, [refreshJourneyReplay])

    const updateSmoothing = useCallback((updates) => {
        const nextSmoothing = mergeSmoothing(lgs.settings.ui.replay.smoothing, updates)
        lgs.settings.ui.replay.smoothing = nextSmoothing
        lgs.stores.replay.smoothing = nextSmoothing
        refreshJourneyReplay(false, true)
    }, [refreshJourneyReplay])

    const updateMarker = useCallback(async (event) => {
        await stopRotateIfNeeded(event.target.value)
        const nextMarker = mergeMarker(lgs.settings.ui.replay.marker, {mode: event.target.value})
        lgs.settings.ui.replay.marker = nextMarker
        lgs.stores.replay.marker = nextMarker
        refreshJourneyReplay(isJourneyReplayCameraActive(replayState))
    }, [
        refreshJourneyReplay,
        replayState.active,
        replayState.clipSequenceActive,
        replayState.paused,
        replayState.playing,
        stopRotateIfNeeded,
    ])

    const updateCamera = useCallback(async (updates, {syncCamera = true, immediate = false} = {}) => {
        if (!immediate || lgs.stores.ui?.mainUI?.rotate?.running === true) {
            await stopRotateIfNeeded()
        }
        const nextCamera = mergeCamera(lgs.settings.ui.replay.camera, updates)
        lgs.settings.ui.replay.camera = nextCamera
        lgs.stores.replay.camera = nextCamera
        lgs.stores.replay.cameraUpdateSource = 'drawer'
        if (cameraUpdateSourceClearTimer.current !== null) {
            clearTimeout(cameraUpdateSourceClearTimer.current)
        }
        if (cameraDraftField.current === null) {
            cameraUpdateSourceClearTimer.current = setTimeout(() => {
                if (lgs.stores.replay.cameraUpdateSource === 'drawer') {
                    lgs.stores.replay.cameraUpdateSource = null
                }
                cameraUpdateSourceClearTimer.current = null
            }, 120)
        }
        if (replayState.active || replayState.playing || replayState.paused) {
            lgs.stores.replay.cameraUserAdjusted = true
        }
        refreshJourneyReplay(syncCamera)
        if (syncCamera) {
            __.ui.replay?.refreshCamera?.({
                sample:             replayState.sample ?? null,
                suppressMoveEvents: true,
                source:             'drawer',
            })
            __.ui.replay?.showCameraAnglePreview?.({
                displayOffset: -nextCamera.headingOffset,
                positionMode:  nextCamera.positionMode,
            })
        }
    }, [replayState.active, replayState.paused, replayState.playing, replayState.sample, refreshJourneyReplay, stopRotateIfNeeded])

    const updateReadiness = useCallback((updates, {refresh = false} = {}) => {
        const currentReadiness = normalizeJourneyReplayReadiness(lgs.settings.ui.replay.readiness)
        const currentPreloadHorizon = Number(normalizeJourneyReplayCamera(lgs.settings.ui.replay.camera).playback.tilePreloadHorizonMs)
        const enablingWithNoActivePolicy = updates.enabled === true
            && currentReadiness.policy === REPLAY_READINESS_POLICY_OFF
            && currentPreloadHorizon <= REPLAY_CAMERA_TILE_PRELOAD_HORIZON_MIN_MS
        const requestedReadiness = enablingWithNoActivePolicy
            ? {
                ...updates,
                enabled: true,
                policy: REPLAY_READINESS_POLICY_ADAPTIVE,
            }
            : updates
        const nextReadiness = mergeReadiness(currentReadiness, requestedReadiness)
        if (updates.enabled !== true
            && nextReadiness.policy === REPLAY_READINESS_POLICY_OFF
            && currentPreloadHorizon <= REPLAY_CAMERA_TILE_PRELOAD_HORIZON_MIN_MS) {
            nextReadiness.enabled = false
        }
        lgs.settings.ui.replay.readiness = nextReadiness
        lgs.stores.replay.readiness = nextReadiness
        if (enablingWithNoActivePolicy) {
            void updateCamera({
                playback: {
                    tilePreloadHorizonMs: DEFAULT_REPLAY_CAMERA.playback.tilePreloadHorizonMs,
                },
            }, {syncCamera: false})
        }
        if (refresh) {
            refreshJourneyReplay(false)
        }
    }, [refreshJourneyReplay, updateCamera])

    const updateCameraTilePreloadHorizon = useCallback(event => {
        const nextHorizon = Number(event.target.value)
        const currentReadiness = normalizeJourneyReplayReadiness(lgs.settings.ui.replay.readiness)
        if (nextHorizon <= REPLAY_CAMERA_TILE_PRELOAD_HORIZON_MIN_MS
            && currentReadiness.policy === REPLAY_READINESS_POLICY_OFF) {
            updateReadiness({enabled: false})
        }
        updateCamera({
            playback: {
                tilePreloadHorizonMs: nextHorizon,
            },
            }, {syncCamera: false})
    }, [updateCamera, updateReadiness])

    const updateReadinessEnabled = useCallback(event => {
        updateReadiness({enabled: getChecked(event)})
    }, [updateReadiness])

    const updateDebugCamera = useCallback(event => {
        updateCamera({debug: getChecked(event)})
    }, [updateCamera])

    useEffect(() => () => {
        if (cameraUpdateSourceClearTimer.current !== null) {
            clearTimeout(cameraUpdateSourceClearTimer.current)
            cameraUpdateSourceClearTimer.current = null
        }
        if (nearbyPoisRefreshTimer.current !== null) {
            clearTimeout(nearbyPoisRefreshTimer.current)
            nearbyPoisRefreshTimer.current = null
        }
    }, [])

    const beginCameraDraft = useCallback((field, value) => {
        cameraDraftField.current = field
        lgs.stores.replay.cameraUpdateSource = 'drawer'
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

        lgs.stores.replay.cameraUpdateSource = 'drawer'
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
            if (lgs.stores.replay.cameraUpdateSource === 'drawer') {
                if (cameraUpdateSourceClearTimer.current !== null) {
                    clearTimeout(cameraUpdateSourceClearTimer.current)
                }
                cameraUpdateSourceClearTimer.current = setTimeout(() => {
                    if (lgs.stores.replay.cameraUpdateSource === 'drawer') {
                        lgs.stores.replay.cameraUpdateSource = null
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

        const nextAltitude = clampJourneyReplayNumber(altitude, camera.altitude, 10, 100000)
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
        const nextPitch = clampJourneyReplayNumber(parsedPitch, camera.pitch, -89, -5)
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
        const nextHeading = clampJourneyReplayNumber(parsedHeading, currentHeading, -180, 180)
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
        lgs.settings.ui.replay.duration = duration
        lgs.stores.replay.duration = duration
    }, [durationLocked])

    const updatePOIDistance = useCallback((event) => {
        const distance = clampJourneyReplayNumber(event.target.value, replaySettings.poiDistance, 1, 100000, true)
        lgs.settings.ui.replay.poiDistance = distance
        lgs.stores.replay.poiDistance = distance
    }, [replaySettings.poiDistance])

    const updatePOIJourneyReplaySettings = useCallback(async (poiId, updates) => {
        const poi = lgs.stores.main.components.pois.list.get(poiId)
        if (!poi?.id) {
            return
        }

        const next = normalizeJourneyReplayPOISettings({
                                                        ...poi.replay,
                                                        ...updates,
                                                        hiddenFields: {
                                                            ...(poi.replay?.hiddenFields ?? {}),
                                                            ...(updates?.hiddenFields ?? {}),
                                                        },
                                                    })

        await __.ui.poiManager.updatePOI(poiId, {replay: next}, {immediate: true})
        setPoiRevision(current => current + 1)
        if (drawerOpen === REPLAY_DRAWER && hasJourney) {
            lgs.stores.replay.nearbyPois = __.ui.poiManager?.getJourneyReplayPOIsForJourney?.(
                currentJourney,
                replaySettings.poiDistance,
            ) ?? []
        }
    }, [currentJourney, drawerOpen, replaySettings.poiDistance, hasJourney])

    const updatePOIJourneyReplayVisibility = useCallback((poiId, event) => {
        const visible = getChecked(event)
        setPoiVisibilityOverrides(current => ({
            ...current,
            [poiId]: visible,
        }))
        void updatePOIJourneyReplaySettings(poiId, {visible})
    }, [updatePOIJourneyReplaySettings])

    const activePoiVisibilityOverrides = useMemo(() => {
        const next = {}

        Object.entries(poiVisibilityOverrides).forEach(([poiId, visible]) => {
            const poi = poiList.get(poiId)
            if (!poi?.id) {
                return
            }

            if (normalizeJourneyReplayPOISettings(poi.replay).visible !== visible) {
                next[poiId] = visible
            }
        })

        return next
    }, [poiList, poiVisibilityOverrides])

    const nearbyPOIsForBadge = useMemo(() => {
        if (!hasJourney) {
            return []
        }

        const cachedNearbyPois = Array.isArray(replayState.nearbyPois) ? replayState.nearbyPois : []
        if (cachedNearbyPois.length > 0) {
            return cachedNearbyPois.filter(entry => {
                const poi = poiList.get(entry?.poi?.id) ?? entry?.poi
                return poi?.tooClose !== true
            })
        }

        return __.ui.poiManager?.getJourneyReplayPOIsForJourney?.(
            currentJourney,
            replaySettings.poiDistance,
        ) ?? []
    }, [currentJourney, hasJourney, replaySettings.poiDistance, replayState.nearbyPois, poiList])

    const visibleOrAnimatedNearbyPOICount = useMemo(() => nearbyPOIsForBadge.reduce((count, entry) => {
        const poi = poiList.get(entry?.poi?.id) ?? entry?.poi
        if (!poi?.id) {
            return count
        }

        const settings = normalizeJourneyReplayPOISettings(poi.replay)
        const replayEnabled = hideAllPoisDuringJourneyReplay
            ? false
            : activePoiVisibilityOverrides[poi.id] ?? settings.visible !== false
        const animated = hideAllPoisDuringJourneyReplay
            ? false
            : animateAllPoisDuringJourneyReplay || settings.animated !== false

        return count + (replayEnabled || animated ? 1 : 0)
    }, 0), [
        animateAllPoisDuringJourneyReplay,
        hideAllPoisDuringJourneyReplay,
        nearbyPOIsForBadge,
        poiList,
        activePoiVisibilityOverrides,
    ])

    const editJourneyReplayPOI = useCallback(async (poiId) => {
        await openPOIEditor(poiId, {stacked: true})
    }, [])

    const isStacked = __.ui.drawerManager.isStacked(REPLAY_DRAWER)
    const closeDrawerWithManager = useCallback(() => {
        window.dispatchEvent(new Event('resize'))
        if (__.ui.drawerManager.isCurrent(REPLAY_DRAWER)) {
            __.ui.drawerManager.close()
        }
    }, [])

    const altitudeDisplayValue = cameraDrafts.altitude ?? String(Math.round(UnitUtils.convert(camera.altitude).to(altitudeUnit)))
    const pitchDisplayValue = cameraDrafts.pitch ?? String(camera.pitch)
    const headingDisplayValue = cameraDrafts.heading ?? String(camera.heading ?? 0)

    const updateSyncWithVideo = useCallback((event) => {
        const enabled = Boolean(event?.target?.checked)
        if (enabled) {
            __.ui.replayVideoSync?.arm({
                autoStopRecording: true,
                resetToStart:      true,
            })
        }
        else {
            __.ui.replayVideoSync?.disarm()
        }
    }, [])

    const updateActiveTab = useCallback((event) => {
        setActiveTab(event?.detail?.name ?? REPLAY_TAB_RUNNER)
    }, [])

    const setReplayTab = useCallback(tab => () => {
        setActiveTab(tab)
    }, [])

    const updateHideOtherJourneys = useCallback((event) => {
        const enabled = Boolean(event?.target?.checked)
        lgs.settings.ui.replay.hideOtherJourneys = enabled
        lgs.settings.ui.replay.inheritHideOtherJourneys = false
        lgs.stores.replay.hideOtherJourneys = enabled
        lgs.stores.replay.inheritHideOtherJourneys = false
        __.ui.replay?.setHideOtherJourneys?.(enabled)
    }, [])

    const updateHideAllPoisDuringJourneyReplay = useCallback((event) => {
        const enabled = Boolean(event?.target?.checked)
        lgs.settings.ui.replay.hideAllPoisDuringJourneyReplay = enabled
        lgs.stores.replay.hideAllPoisDuringJourneyReplay = enabled
        __.ui.replay?.setHideAllPoisDuringJourneyReplay?.(enabled)
    }, [])

    const updateAnimateAllPoisDuringJourneyReplay = useCallback((event) => {
        const enabled = Boolean(event?.target?.checked)
        lgs.settings.ui.replay.animateAllPoisDuringJourneyReplay = enabled
        lgs.stores.replay.animateAllPoisDuringJourneyReplay = enabled
        __.ui.replay?.setAnimateAllPoisDuringJourneyReplay?.(enabled)
    }, [])

    const updateFillColor = useCallback((event) => {
        updateProgression({fill: {color: toOpaqueColorValue(event.target.value)}})
    }, [updateProgression])

    const updateFillOpacity = useCallback((event) => {
        updateProgression({fill: {opacity: clampJourneyReplayNumber(event.target.value, progression.fill.opacity, 0, 1)}})
    }, [progression.fill.opacity, updateProgression])

    const updateFillWidth = useCallback((event) => {
        updateProgression({
                              fill: {
                                  width: clampJourneyReplayNumber(
                                      event.target.value,
                                      progression.fill.width,
                                      REPLAY_PROGRESSION_FILL_MIN_WIDTH,
                                      REPLAY_PROGRESSION_FILL_MAX_WIDTH,
                                  ),
                              },
                          })
    }, [progression.fill.width, updateProgression])

    const updateFillProfileMarker = useCallback((event) => {
        updateProgression({
                              fill: {
                                  profileMarker: clampJourneyReplayNumber(
                                      event.target.value,
                                      progression.fill.profileMarker,
                                      REPLAY_PROFILE_MARKER_FILL_MIN_SIZE,
                                      REPLAY_PROFILE_MARKER_FILL_MAX_SIZE,
                                  ),
                              },
                          })
    }, [progression.fill.profileMarker, updateProgression])

    const updateBorderColor = useCallback((event) => {
        updateProgression({border: {color: toOpaqueColorValue(event.target.value)}})
    }, [updateProgression])

    const updateBorderOpacity = useCallback((event) => {
        updateProgression({border: {opacity: clampJourneyReplayNumber(event.target.value, progression.border.opacity, 0, 1)}})
    }, [progression.border.opacity, updateProgression])

    const updateBorderWidth = useCallback((event) => {
        updateProgression({
                              border: {
                                  width: clampJourneyReplayNumber(
                                      event.target.value,
                                      progression.border.width,
                                      REPLAY_PROGRESSION_BORDER_MIN_WIDTH,
                                      REPLAY_PROGRESSION_BORDER_MAX_WIDTH,
                                  ),
                              },
                          })
    }, [progression.border.width, updateProgression])

    const updateBorderProfileMarker = useCallback((event) => {
        updateProgression({
                              border: {
                                  profileMarker: clampJourneyReplayNumber(
                                      event.target.value,
                                      progression.border.profileMarker,
                                      REPLAY_PROFILE_MARKER_BORDER_MIN_WIDTH,
                                      REPLAY_PROFILE_MARKER_BORDER_MAX_WIDTH,
                                  ),
                              },
                          })
    }, [progression.border.profileMarker, updateProgression])

    const updateEffectMode = useCallback((event) => {
        updateProgression({effect: {mode: event.target.value}})
    }, [updateProgression])

    const updateTraceMode = useCallback((event) => {
        updateTrace({mode: event.target.value})
    }, [updateTrace])

    const updateSmoothingEnabled = useCallback((event) => {
        updateSmoothing({enabled: getChecked(event)})
    }, [updateSmoothing])

    const updateSmoothingStep = useCallback((event) => {
        updateSmoothing({
                            step: clampJourneyReplayNumber(
                                event.target.value,
                                smoothing.step,
                                REPLAY_SMOOTHING_MIN_STEP,
                                REPLAY_SMOOTHING_MAX_STEP,
                                true,
                            ),
                        })
    }, [smoothing.step, updateSmoothing])

    const updateRemainingColor = useCallback((event) => {
        updateTrace({remaining: {color: toOpaqueColorValue(event.target.value)}})
    }, [updateTrace])

    const updateRemainingOpacity = useCallback((event) => {
        updateTrace({remaining: {opacity: clampJourneyReplayNumber(event.target.value, trace.remaining.opacity, 0, 1)}})
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
        const currentTerrainHeight = replayState.sample
                                     ? terrainHeightAt(replayState.sample)
                                     : terrainHeightAt({
                                           ...(lgs.viewer?.camera?.positionCartographic ?? {}),
                                           radians: true,
                                       })
        const nextAltitude = nextMode === REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET
                             ? currentTerrainHeight === null
                               ? fallbackAbsoluteHeight
                               : clampJourneyReplayNumber(fallbackAbsoluteHeight - currentTerrainHeight, fallbackAbsoluteHeight, 10, 100000)
                             : currentTerrainHeight === null
                               ? fallbackAbsoluteHeight
                               : clampJourneyReplayNumber(fallbackAbsoluteHeight + currentTerrainHeight, fallbackAbsoluteHeight, 10, 100000)

        updateCamera({
            altitudeMode: nextMode,
            altitude:     nextAltitude,
        })
    }, [camera.altitude, camera.altitudeMode, replayState.sample, updateCamera])

    const cameraAngleDisplayOffset = -camera.headingOffset

    const updateCameraPositionMode = useCallback((event) => {
        updateCamera({positionMode: event.target.value})
    }, [updateCamera])

    const updateCameraHeadingOffset = useCallback((event) => {
        const sliderValue = Number(event.target.value)
        const nextHeadingOffset = Number.isFinite(sliderValue) ? -sliderValue : camera.headingOffset
        updateCamera({
                         headingOffset: clampJourneyReplayNumber(
                             nextHeadingOffset,
                             camera.headingOffset,
                             REPLAY_CAMERA_HEADING_OFFSET_MIN,
                             REPLAY_CAMERA_HEADING_OFFSET_MAX,
                         ),
                     }, {immediate: true})
    }, [camera.headingOffset, updateCamera])

    const updateCameraPreset = useCallback((event) => {
        const presetKey = event.target.value
        if (presetKey === REPLAY_CAMERA_PRESET_CUSTOM) {
            return
        }

        const presetUpdates = getJourneyReplayCameraPresetUpdates(presetKey)
        if (!presetUpdates) {
            return
        }

        updateCamera(presetUpdates)
    }, [updateCamera])

    const altitudeFieldLabel = camera.altitudeMode === REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET
        ? `Ground offset (${altitudeUnit})`
        : `Altitude (${altitudeUnit})`

    const updateHysteresisMarginRatio = useCallback((event) => {
        updateCamera({
                         hysteresis: {
                             marginRatio: clampJourneyReplayNumber(
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
                             easing: clampJourneyReplayNumber(
                                 event.target.value,
                                 camera.hysteresis.easing,
                                 0.02,
                                 0.5,
                             ),
                         },
                     })
    }, [camera.hysteresis.easing, updateCamera])

    /**
     * Update one replay camera sensitivity while preserving the normalized range.
     *
     * @param {string} field - Camera sensitivity field to update.
     * @param {Event} event - Slider input event.
     * @returns {void}
     */
    const updateCameraSensitivity = useCallback((field, event) => {
        updateCamera({
                         [field]: clampJourneyReplayNumber(
                             event.target.value,
                             camera[field],
                             REPLAY_CAMERA_SENSITIVITY_MIN,
                             REPLAY_CAMERA_SENSITIVITY_MAX,
                         ),
                     })
    }, [camera, updateCamera])

    const handleRequestClose = useCallback((event) => {
        if (event.target.tagName !== 'WA-DRAWER') {
            event.preventDefault()
            return
        }
        if (!__.ui.drawerManager.isCurrent(REPLAY_DRAWER)) {
            return
        }
        __.ui.replay?.restoreJourneyToolbarVisibility?.()
        __.ui.drawerManager.close()
    }, [])

    const closeDrawer = useCallback((event) => {
        if (window.isOK(event) && __.ui.drawerManager.isCurrent(REPLAY_DRAWER)) {
            __.ui.replay?.restoreJourneyToolbarVisibility?.()
            __.ui.drawerManager.close()
        }
    }, [])

    const drawerRoot = __.ui.drawerManager.drawerRoot
    const content = (
        <>
            {drawerOpen === REPLAY_DRAWER &&
                <WaDrawer
                    ref={drawerRef}
                    id={REPLAY_DRAWER}
                    open={true}
                    onWaAfterHide={handleRequestClose}
                    onSlAfterHide={closeDrawer}
                    placement={drawerPlacement}
                    className={classNames('replay-drawer', {'drawer-is-stacked': isStacked})}
                >
                    <span slot="label" className="replay-drawer-title">
                        <WaIcon name="drone" variant="regular"/>
                        {REPLAY_LABEL}
                    </span>
                    <PanelActions stackedPanel={isStacked} onBack={isStacked ? closeDrawerWithManager : null}>
                        {hasJourney && (
                            <>
                                <WaTooltip for={REPLAY_ADVANCED_CAMERA_SETUP_BUTTON_ID} placement="bottom">
                                    {advancedCameraSetupLabel}
                                </WaTooltip>
                                <WaButton
                                    id={REPLAY_ADVANCED_CAMERA_SETUP_BUTTON_ID}
                                    className="replay-advanced-camera-button"
                                    size="l"
                                    appearance="plain"
                                    variant="brand"
                                    aria-label={advancedCameraSetupLabel}
                                    onClick={() => setAdvancedCameraPopupOpen(!advancedCameraPopupOpen)}
                                >
                                    <WaIcon size="l" src={FA_CAMERA_SLIDERS_SRC}/>
                                </WaButton>
                            </>
                        )}
                    </PanelActions>

                    <div className="replay-drawer-content">
                        <PopupAnchor id={REPLAY_ADVANCED_CAMERA_POPUP_ANCHOR_ID}/>
                        {!hasJourney ? (
                            <p className="replay-empty-state">{`Import or select a journey to use ${REPLAY_LABEL}.`}</p>
                        ) : (
                             <>
                                 <WaCard appearance="outlined" className="replay-progress-card-in-drawer">
                                     <JourneyReplayProgressBar
                                         className="replay-progress-bar-in-drawer"
                                         disabled={syncWithVideo}
                                     />
                                 </WaCard>
                                 <div className="replay-sync-row">
                                     <WaSwitch
                                         label-at-start
                                         size="xs"
                                         className="replay-sync-switch half-width"
                                         checked={syncWithVideo}
                                         onChange={updateSyncWithVideo}
                                     >
                                         {'Sync with Video'}
                                     </WaSwitch>
                                     {syncWithVideo &&
                                         <VideoButton
                                             id="launch-the-video-editor-replay"
                                             tooltip="left"
                                             className="replay-sync-video-button square-button"
                                             variant="brand"
                                             appearance="plain"
                                         />
                                     }
                                 </div>
                                 <WaSwitch
                                     label-at-start
                                     size="xs"
                                     className="replay-hide-other-journeys-switch half-width"
                                     checked={hideOtherJourneys}
                                     onChange={updateHideOtherJourneys}
                                 >
                                     {'Hide other journeys'}
                                 </WaSwitch>
                                 <div className="replay-total-duration-row" aria-live="polite">
                                     <span className="replay-total-duration-label">{'Total duration (s)'}</span>
                                     <strong className="replay-total-duration-value">{formatSeconds(totalVideoDurationSeconds)}</strong>
                                 </div>
                                 <WaSelect appearance="filled"
                                     className="replay-progression-select half-width"
                                     label="Show"
                                     label-at-start
                                     size="s"
                                     value={trace.mode}
                                     onChange={updateTraceMode}
                                 >
                                     <WaOption value={REPLAY_TRACE_MODE_PROGRESSIVE}>{'Progress'}</WaOption>
                                     <WaOption value={REPLAY_TRACE_MODE_FULL}>{'Progress - Remain'}</WaOption>
                                 </WaSelect>
                                 <WaSelect appearance="filled"
                                     label="Tracking"
                                     label-at-start
                                     size="s"
                                     value={marker.mode}
                                     onChange={updateMarker}
                                     className="half-width">
                                     <WaOption
                                         value={REPLAY_MARKER_MODE_TRACE}>{'Passive'}</WaOption>
                                     <WaOption
                                         value={REPLAY_MARKER_MODE_NAVIGATION}>{'Navigation'}</WaOption>
                                     <WaOption
                                         value={REPLAY_MARKER_MODE_HYSTERESIS}>{'Dynamic'}</WaOption>
                                 </WaSelect>
                                 <WaTabGroup className="replay-tabs" onWaTabShow={updateActiveTab}>
                                    <WaTab slot="nav" panel="runner" onClick={setReplayTab(REPLAY_TAB_RUNNER)}>
                                        <JourneyReplayTabLabelWithBadge icon="clock" label="Playback" count={0}/>
                                    </WaTab>
                                     <WaTab slot="nav" panel={REPLAY_TAB_STYLE} onClick={setReplayTab(REPLAY_TAB_STYLE)}>
                                        <WaIcon name="paintbrush-pencil" variant="regular"/>
                                        {'Style'}
                                    </WaTab>
                                    <WaTab slot="nav" panel="clips" onClick={setReplayTab('clips')}>
                                        <JourneyReplayTabLabelWithBadge
                                            icon="sparkles"
                                            label="Clips"
                                            count={selectedClipCount}
                                            ariaLabel={`${selectedClipCount} selected clip${selectedClipCount > 1 ? 's' : ''}`}
                                        />
                                    </WaTab>
                                    <WaTab slot="nav" panel="pois" onClick={setReplayTab(REPLAY_TAB_POIS)}>
                                        <JourneyReplayTabLabelWithBadge
                                            icon="location-dot"
                                            label="POIs"
                                            count={visibleOrAnimatedNearbyPOICount}
                                            ariaLabel={`${visibleOrAnimatedNearbyPOICount} visible or animated POI${visibleOrAnimatedNearbyPOICount > 1 ? 's' : ''}`}
                                        />
                                    </WaTab>

                                     <WaTabPanel name="runner">
                                         <LGSScrollbars>
                                             <div className="replay-tab-panel">
                                                <div className="replay-fieldset">
                                                    <WaNumberInput
                                                        className="replay-duration-input half-width"
                                                        label="Duration (s)"
                                                        size="s"
                                                         appearance="filled"
                                                         min="1"
                                                         step="1"
                                                         value={replaySettings.duration}
                                                         disabled={durationLocked}
                                                         onInput={updateDuration}
                                                         label-at-start/>
                                                     <WaNumberInput
                                                         className="replay-poi-distance-input half-width"
                                                         label="Nearby POIs (m)"
                                                         size="s"
                                                         appearance="filled"
                                                         min="1"
                                                         max="100000"
                                                         step="100"
                                                        value={replaySettings.poiDistance}
                                                        onInput={updatePOIDistance}
                                                        label-at-start/>
                                                </div>
                                                <section className="replay-style-subsection">
                                                    <h4 className="replay-style-subtitle">{'Position'}</h4>
                                                    <div className="replay-fieldset">
                                                    <WaSelect appearance="filled"
                                                        label="Camera position"
                                                        label-at-start
                                                        size="s"
                                                        value={camera.positionMode}
                                                        onChange={updateCameraPositionMode}
                                                        className="half-width">
                                                        <WaOption
                                                            value={REPLAY_CAMERA_POSITION_SYSTEM}>{'Fixed'}</WaOption>
                                                    <WaOption
                                                            value={REPLAY_CAMERA_POSITION_BEHIND}>{'Behind'}</WaOption>
                                                        <WaOption
                                                            value={REPLAY_CAMERA_POSITION_AHEAD}>{'Ahead'}</WaOption>
                                                    </WaSelect>
                                                    {camera.positionMode !== REPLAY_CAMERA_POSITION_SYSTEM &&
                                                       <JourneyReplayStyleField>
                                                            <WaSlider
                                                                label="Camera angle"
                                                                size="s"
                                                                min={REPLAY_CAMERA_HEADING_OFFSET_MIN}
                                                                max={REPLAY_CAMERA_HEADING_OFFSET_MAX}
                                                                step="1"
                                                                value={cameraAngleDisplayOffset}
                                                                withTooltip
                                                                label-at-start half-width
                                                                valueFormatter={value => `${Math.round(Number(value) || 0)}°`}
                                                                onInput={updateCameraHeadingOffset}
                                                            />
                                                        </JourneyReplayStyleField>
                                                    }
                                                    </div>
                                                </section>
                                                <WaDivider/>
                                                <section className="replay-style-subsection">
                                                    <h4 className="replay-style-subtitle">{'Framing'}</h4>
                                                    <div className="replay-fieldset">
                                                    <WaSelect appearance="filled"
                                                        label="Camera altitude"
                                                        label-at-start
                                                        size="s"
                                                        value={camera.altitudeMode}
                                                        onChange={updateAltitudeMode}
                                                        className="half-width">
                                                        <WaOption
                                                            value={REPLAY_CAMERA_ALTITUDE_CONSTANT}>{'Fixed'}</WaOption>
                                                        <WaOption
                                                            value={REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET}>{'Ground offset'}</WaOption>
                                                    </WaSelect>
                                                    <div className="replay-style-field-grid is-single">
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
                                                    </div>
                                                </div>
                                                </section>
                                                 {advancedCameraPopupOpen && (
                                                     <PopupDrawer
                                                         active={advancedCameraPopupOpen}
                                                         anchor={REPLAY_ADVANCED_CAMERA_POPUP_ANCHOR_ID}
                                                         outsideAnchors={[REPLAY_ADVANCED_CAMERA_SETUP_BUTTON_ID]}
                                                         onRequestClose={() => setAdvancedCameraPopupOpen(false)}
                                                         popupProps={{
                                                             placement:       'bottom',
                                                             distance:        0,
                                                             flip:            false,
                                                             shift:           false,
                                                             boundary:        'scroll',
                                                             autoSize:        'vertical',
                                                             autoSizePadding: 0,
                                                         }}
                                                         header={(
                                                             <>
                                                                 <WaIcon name="sliders" variant="regular"/>
                                                                 <span>{'Advanced camera setup'}</span>
                                                             </>
                                                         )}
                                                         headerActions={(
                                                             <WaButton
                                                                 appearance="plain"
                                                                 aria-label="Close advanced camera setup"
                                                                 slot="header-actions"
                                                                 onClick={() => setAdvancedCameraPopupOpen(false)}
                                                             >
                                                                 <WaIcon size="s" name="xmark" variant="regular"/>
                                                             </WaButton>
                                                         )}
                                                         appearance="filled"
                                                         className="replay-advanced-camera-popup"
                                                     >
                                                         <div className="replay-advanced-camera-scrollbars">
                                                             <LGSScrollbars autoHide={false}>
                                                                 <div className="replay-fieldset">
                                                        <WaDivider/>
                                                        <h4 className="replay-style-subtitle">{'Diagnostics'}</h4>
                                                        {syncWithVideo && (
                                                            <WaSwitch
                                                                className="replay-debug-camera-switch half-width"
                                                                size="xs"
                                                                label-at-start
                                                                checked={camera.debug === true}
                                                                onChange={updateDebugCamera}
                                                            >
                                                                {'Debug camera'}
                                                            </WaSwitch>
                                                        )}
                                                        <WaDivider/>
                                                        <h4 className="replay-style-subtitle">{'Tile readiness'}</h4>
                                                        <WaSwitch
                                                            className="replay-readiness-switch half-width"
                                                            size="xs"
                                                            label-at-start
                                                            checked={readiness.enabled}
                                                            onChange={updateReadinessEnabled}
                                                        >
                                                            {'Wait for visible tiles'}
                                                        </WaSwitch>
                                                        {readiness.enabled && (
                                                            <>
                                                                <WaSelect
                                                                    appearance="filled"
                                                                    label="Readiness policy"
                                                                    hint="Adaptive uses shorter budgets while the camera is moving."
                                                                    label-at-start
                                                                    size="s"
                                                                    value={String(readiness.policy)}
                                                                    onChange={event => updateReadiness({policy: event.target.value})}
                                                                    className="half-width"
                                                                >
                                                                    <WaOption value={REPLAY_READINESS_POLICY_ADAPTIVE}>{'Adaptive'}</WaOption>
                                                                    <WaOption value={REPLAY_READINESS_POLICY_STRICT}>{'Strict'}</WaOption>
                                                                    <WaOption value={REPLAY_READINESS_POLICY_CUSTOM}>{'Custom'}</WaOption>
                                                                    <WaOption value={REPLAY_READINESS_POLICY_OFF}>{'Off'}</WaOption>
                                                                </WaSelect>
                                                                {readiness.policy === REPLAY_READINESS_POLICY_CUSTOM && (
                                                                    <div className="replay-style-field-grid is-single">
                                                                        <WaNumberInput
                                                                            label="Moving wait (ms)"
                                                                            hint="Maximum tile wait while the camera is moving."
                                                                            className="half-width"
                                                                            size="s"
                                                                            appearance="filled"
                                                                            min="0"
                                                                            max="5000"
                                                                            step="50"
                                                                            value={readiness.movingTimeoutMs}
                                                                            onInput={event => updateReadiness({movingTimeoutMs: event.target.value})}
                                                                            label-at-start
                                                                        />
                                                                        <WaNumberInput
                                                                            label="Settled wait (ms)"
                                                                            hint="Maximum tile wait after the camera settles."
                                                                            className="half-width"
                                                                            size="s"
                                                                            appearance="filled"
                                                                            min="0"
                                                                            max="10000"
                                                                            step="100"
                                                                            value={readiness.settledTimeoutMs}
                                                                            onInput={event => updateReadiness({settledTimeoutMs: event.target.value})}
                                                                            label-at-start
                                                                        />
                                                                    </div>
                                                                )}
                                                                <WaSelect
                                                                    appearance="filled"
                                                                    label="Camera tile preloading"
                                                                    hint="Preload initial camera views before HQ export starts."
                                                                    label-at-start
                                                                    size="s"
                                                                    value={String(camera.playback.tilePreloadHorizonMs)}
                                                                    onChange={updateCameraTilePreloadHorizon}
                                                                    className="half-width"
                                                                >
                                                                    <WaOption value={String(REPLAY_CAMERA_TILE_PRELOAD_HORIZON_MIN_MS)}>{'Off'}</WaOption>
                                                                    <WaOption value="500">{'500 ms'}</WaOption>
                                                                    <WaOption value="1000">{'1 s'}</WaOption>
                                                                    <WaOption value="2000">{'2 s'}</WaOption>
                                                                    <WaOption value={String(REPLAY_CAMERA_TILE_PRELOAD_HORIZON_MAX_MS)}>{'3 s'}</WaOption>
                                                                </WaSelect>
                                                            </>
                                                        )}
                                                        <WaDivider/>
                                                        <h4 className="replay-style-subtitle">{'Motion'}</h4>
                                                        <WaSelect appearance="filled"
                                                            label="Camera feel"
                                                            label-at-start
                                                            size="s"
                                                            value={cameraPresetKey}
                                                            onChange={updateCameraPreset}
                                                            className="half-width">
                                                            {REPLAY_CAMERA_PRESETS.map(preset => (
                                                                <WaOption key={preset.key} value={preset.key}>
                                                                    {preset.label}
                                                                </WaOption>
                                                            ))}
                                                            <WaOption value={REPLAY_CAMERA_PRESET_CUSTOM}>{'Custom'}</WaOption>
                                                        </WaSelect>
                                                        <div className="replay-camera-capability-switches">
                                                            <JourneyReplayStyleField>
                                                                <WaSwitch
                                                                    className="replay-camera-capability-switch"
                                                                    size="xs"
                                                                    label-at-start
                                                                    checked={camera.canDrift !== false}
                                                                    onChange={event => updateCamera({canDrift: getChecked(event)})}
                                                                >
                                                                    {'Add drift'}
                                                                </WaSwitch>
                                                                {camera.canDrift && (
                                                                    <WaSlider
                                                                        label="Sensitivity"
                                                                        hint="Lower values reduce turn-based camera drift."
                                                                        size="s"
                                                                        min={REPLAY_CAMERA_SENSITIVITY_MIN}
                                                                        max={REPLAY_CAMERA_SENSITIVITY_MAX}
                                                                        step="0.05"
                                                                        value={camera.driftSensitivity}
                                                                        valueFormatter={formatSliderPercent}
                                                                        withTooltip
                                                                        placement="top"
                                                                        onInput={event => updateCameraSensitivity('driftSensitivity', event)}
                                                                        label-at-start  half-width
                                                                        className="replay-camera-sensitivity-slider"
                                                                    />
                                                                )}
                                                            </JourneyReplayStyleField>
                                                            <JourneyReplayStyleField>
                                                                <WaSwitch
                                                                    className="replay-camera-capability-switch"
                                                                    size="xs"
                                                                    label-at-start
                                                                    checked={camera.canFixHiddenMarker !== false}
                                                                    onChange={event => updateCamera({canFixHiddenMarker: getChecked(event)})}
                                                                >
                                                                    {'Add hidden marker correction'}
                                                                </WaSwitch>
                                                                {camera.canFixHiddenMarker && (
                                                                    <WaSlider
                                                                        label="Sensitivity"
                                                                        hint="Lower values reduce hidden-marker pitch corrections."
                                                                        size="s"
                                                                        min={REPLAY_CAMERA_SENSITIVITY_MIN}
                                                                        max={REPLAY_CAMERA_SENSITIVITY_MAX}
                                                                        step="0.05"
                                                                        value={camera.pitchCorrectionSensitivity}
                                                                        valueFormatter={formatSliderPercent}
                                                                        withTooltip
                                                                        placement="top"
                                                                        onInput={event => updateCameraSensitivity('pitchCorrectionSensitivity', event)}
                                                                        label-at-start half-width
                                                                        className="replay-camera-sensitivity-slider"
                                                                    />
                                                                )}
                                                            </JourneyReplayStyleField>
                                                            <JourneyReplayStyleField>
                                                                <WaSwitch
                                                                    className="replay-camera-capability-switch"
                                                                    size="xs"
                                                                    label-at-start
                                                                    checked={camera.canRoll !== false}
                                                                    onChange={event => updateCamera({canRoll: getChecked(event)})}
                                                                >
                                                                    {'Add roll'}
                                                                </WaSwitch>
                                                                {camera.canRoll && (
                                                                    <WaSlider
                                                                        label="Sensitivity"
                                                                        hint="Lower values reduce camera banking in turns."
                                                                        size="s"
                                                                        min={REPLAY_CAMERA_SENSITIVITY_MIN}
                                                                        max={REPLAY_CAMERA_SENSITIVITY_MAX}
                                                                        step="0.05"
                                                                        value={camera.rollSensitivity}
                                                                        valueFormatter={formatSliderPercent}
                                                                        withTooltip
                                                                        placement="top"
                                                                        onInput={event => updateCameraSensitivity('rollSensitivity', event)}
                                                                        label-at-start half-width
                                                                        className="replay-camera-sensitivity-slider"
                                                                    />
                                                                )}
                                                            </JourneyReplayStyleField>
                                                        </div>
                                                        <WaDivider/>
                                                        <h4 className="replay-style-subtitle">{'Recenter'}</h4>
                                                        <JourneyReplayStyleField>
                                                            <WaNumberInput
                                                                label="Recenter tolerance"
                                                                hint="Lower values make the camera recenter less often."
                                                                size="s"
                                                                appearance="filled"
                                                                min={REPLAY_HYSTERESIS_MARGIN_RATIO_MIN}
                                                                max={REPLAY_HYSTERESIS_MARGIN_RATIO_MAX}
                                                                step="0.01"
                                                                value={camera.hysteresis.marginRatio}
                                                                onInput={updateHysteresisMarginRatio}
                                                                label-at-start className="half-width"/>
                                                        </JourneyReplayStyleField>
                                                        <JourneyReplayStyleField>
                                                            <WaNumberInput
                                                                label="Ease"
                                                                hint="Higher values make the recenter move softer and longer."
                                                                size="s"
                                                                appearance="filled"
                                                                min={REPLAY_HYSTERESIS_EASING_MIN}
                                                                max={REPLAY_HYSTERESIS_EASING_MAX}
                                                                step="0.01"
                                                                value={camera.hysteresis.easing}
                                                                onInput={updateHysteresisEasing}
                                                                label-at-start className="half-width"/>
                                                        </JourneyReplayStyleField>
                                                                 </div>
                                                             </LGSScrollbars>
                                                         </div>
                                                     </PopupDrawer>
                                                 )}
                                             </div>
                                         </LGSScrollbars>
                                     </WaTabPanel>

                                     <WaTabPanel name={REPLAY_TAB_STYLE}>
                                         <LGSScrollbars>
                                             <div className="replay-tab-panel">
                                                 <>
                                                     <section className="replay-progression-section">
                                                         <h3>{'Trace smoothing'}</h3>
                                                         <div className="replay-fieldset">
                                                             <WaSwitch
                                                                 className="replay-smoothing-switch half-width"
                                                                 size="xs"
                                                                 label-at-start
                                                                 checked={smoothing.enabled}
                                                                 onChange={updateSmoothingEnabled}
                                                             >
                                                                 {'Smooth replay trace'}
                                                             </WaSwitch>
                                                             {smoothing.enabled && (
                                                                 <WaNumberInput
                                                                     className="replay-smoothing-step-input half-width"
                                                                     label="Step"
                                                                     size="s"
                                                                     appearance="filled"
                                                                     min={REPLAY_SMOOTHING_MIN_STEP}
                                                                     max={REPLAY_SMOOTHING_MAX_STEP}
                                                                     step="1"
                                                                     value={smoothing.step}
                                                                     onInput={updateSmoothingStep}
                                                                     label-at-start/>
                                                             )}
                                                         </div>
                                                         <WaDivider/>
                                                         {trace.mode === REPLAY_TRACE_MODE_FULL &&
                                                             <>
                                                                 <h3>{'Remaining trace'}</h3>

                                                                 <WaSwitch
                                                                     className="replay-track-style-switch half-width"
                                                                     size="xs"
                                                                     label-at-start
                                                                     checked={remainingUseDefinedTrackStyle}
                                                                     onChange={updateRemainingUseDefinedTrackStyle}
                                                                 >
                                                                     {'Use defined track style'}
                                                                 </WaSwitch>

                                                                 <div className="replay-style-control-group">
                                                                     {!remainingUseDefinedTrackStyle && (
                                                                         <JourneyReplayColorField
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
                                                         <JourneyReplayProgressionGroup
                                                             title="Trace and Marker"
                                                             color={fillColor}
                                                             opacity={fillOpacity}
                                                             width={fillWidth}
                                                             widthMin={REPLAY_PROGRESSION_FILL_MIN_WIDTH}
                                                             widthMax={REPLAY_PROGRESSION_FILL_MAX_WIDTH}
                                                             swatches={swatches}
                                                             onColorInput={updateFillColor}
                                                             onOpacityInput={updateFillOpacity}
                                                             onWidthInput={updateFillWidth}
                                                         />
                                                         <JourneyReplayProgressionGroup
                                                             title="Border"
                                                             color={borderColor}
                                                             opacity={borderOpacity}
                                                             width={borderWidth}
                                                             widthMin={REPLAY_PROGRESSION_BORDER_MIN_WIDTH}
                                                             widthMax={REPLAY_PROGRESSION_BORDER_MAX_WIDTH}
                                                             swatches={swatches}
                                                             onColorInput={updateBorderColor}
                                                             onOpacityInput={updateBorderOpacity}
                                                             onWidthInput={updateBorderWidth}
                                                         />
                                                         <WaSelect
                                                             appearance="filled"
                                                             className="replay-effect-select half-width"
                                                             label="Effect"
                                                             label-at-start
                                                             size="s"
                                                             value={effectMode}
                                                             onChange={updateEffectMode}
                                                         >
                                                             <WaOption value={REPLAY_EFFECT_NONE}>{'No effect'}</WaOption>
                                                             <WaOption value={REPLAY_EFFECT_GLOW}>{'Glow'}</WaOption>
                                                             <WaOption value={REPLAY_EFFECT_NEON}>{'Neon'}</WaOption>
                                                         </WaSelect>
                                                         <JourneyReplayEffectPreview
                                                             mode={effectMode}
                                                             fillColor={fillColor}
                                                             borderColor={borderColor}
                                                             fillOpacity={fillOpacity}
                                                             borderOpacity={borderOpacity}
                                                             backgroundImage={effectPreviewBackground}
                                                             fillWidth={fillWidth}
                                                             borderWidth={borderWidth}
                                                         />
                                                     </section>
                                                     <WaDivider/>
                                                 </>

                                                 <section className="replay-progression-section">
                                                     <h3>{'Profile'}</h3>
                                                     <div className="replay-style-control-group">
                                                             <JourneyReplayWidthField
                                                                 label="Marker Size"
                                                                 unit="px"
                                                                 value={fillProfileMarker}
                                                                 min={REPLAY_PROFILE_MARKER_FILL_MIN_SIZE}
                                                                 max={REPLAY_PROFILE_MARKER_FILL_MAX_SIZE}
                                                                 step="0.5"
                                                                 onInput={updateFillProfileMarker}
                                                             />
                                                             <JourneyReplayWidthField
                                                                 label="Marker Border"
                                                                 unit="px"
                                                                 value={borderProfileMarker}
                                                                 min={REPLAY_PROFILE_MARKER_BORDER_MIN_WIDTH}
                                                                 max={REPLAY_PROFILE_MARKER_BORDER_MAX_WIDTH}
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
                                             <div className="replay-tab-panel">
                                                 <JourneyReplayClipsTab
                                                     settings={replaySettings}
                                                     state={replayState}
                                                 />
                                             </div>
                                         </LGSScrollbars>
                                     </WaTabPanel>
                                     <WaTabPanel name="pois">
                                         {activeTab === REPLAY_TAB_POIS && (
                                             <LGSScrollbars>
                                                <div className="replay-tab-panel">
                                                <div className="replay-poi-switches">
                                                    <WaSwitch
                                                        size="xs"
                                                        label-at-start
                                                        checked={hideAllPoisDuringJourneyReplay}
                                                        onInput={updateHideAllPoisDuringJourneyReplay}
                                                    >
                                                        {'Hide all POIs during replay'}
                                                    </WaSwitch>
                                                    {!hideAllPoisDuringJourneyReplay && (
                                                        <WaSwitch
                                                            size="xs"
                                                            label-at-start
                                                            checked={animateAllPoisDuringJourneyReplay}
                                                            onInput={updateAnimateAllPoisDuringJourneyReplay}
                                                        >
                                                            {'Animate all POIs during replay'}
                                                        </WaSwitch>
                                                    )}
                                                </div>
                                                {nearbyPOIs.length === 0 ? (
                                                    <p className="replay-empty-state">{'No replay POI matches for the current journey.'}</p>
                                                ) : (
                                                      <div className="lgs--details-list">
                                                          {nearbyPOIs.map(entry => {
                                                              const poi = poiList.get(entry?.poi?.id) ?? entry?.poi
                                                              if (!poi?.id) {
                                                                  return null
                                                              }

                                                              const settings = normalizeJourneyReplayPOISettings(poi.replay)
                                                              const replayEnabled = hideAllPoisDuringJourneyReplay
                                                                  ? false
                                                                  : activePoiVisibilityOverrides[poi.id] ?? settings.visible !== false
                                                              const animated = hideAllPoisDuringJourneyReplay
                                                                  ? false
                                                                  : animateAllPoisDuringJourneyReplay || settings.animated !== false
                                                              const visibilityButtonId = `replay-poi-visibility-${poi.id}`
                                                              const animationButtonId = `replay-poi-animation-${poi.id}`
                                                              const toggleVisibility = event => {
                                                                  event.preventDefault()
                                                                  event.stopPropagation()
                                                                  updatePOIJourneyReplayVisibility(poi.id, {
                                                                      target: {
                                                                          checked: !replayEnabled,
                                                                      },
                                                                  })
                                                              }
                                                              const toggleAnimation = event => {
                                                                  event.preventDefault()
                                                                  event.stopPropagation()
                                                                  void updatePOIJourneyReplaySettings(poi.id, {
                                                                      animated: !animated,
                                                                  })
                                                              }

                                                              return (
                                                                  <WaDetails key={poi.id}
                                                                             className="replay-poi-details lgs--details-hoverable">
                                                                      <span slot="summary"
                                                                            className="replay-poi-summary">
                                                                          <span className="replay-poi-summary-title">
                                                                              <WaIcon variant="regular"
                                                                                      className="poi-duotone-icon"
                                                                                      name={entry?.source === 'journey-poi' ? 'route' : 'location-dot'}/>
                                                                              <strong>{poi.title ?? poi.id}</strong>
                                                                          </span>
                                                                          <span
                                                                              className="replay-poi-summary-actions">
                                                                              <WaTooltip for={visibilityButtonId}
                                                                                         placement="top">
                                                                                  {replayEnabled ? 'Hide POI during replay' : 'Show POI during replay'}
                                                                              </WaTooltip>
                                                                              <WaButton
                                                                                  id={visibilityButtonId}
                                                                                  className="replay-poi-summary-button"
                                                                                  appearance="plain"
                                                                                  variant="brand"
                                                                                  size="s"
                                                                                  aria-label={replayEnabled ? 'Hide POI during replay' : 'Show POI during replay'}
                                                                                  aria-pressed={replayEnabled}
                                                                                  disabled={hideAllPoisDuringJourneyReplay}
                                                                                  onClick={toggleVisibility}
                                                                              >
                                                                                  <WaIcon
                                                                                      name={replayEnabled ? 'eye-slash' : 'eye'}
                                                                                      variant="regular"/>
                                                                              </WaButton>
                                                                              <WaTooltip for={animationButtonId}
                                                                                         placement="top">
                                                                                  {animated ? 'Disable POI animation during replay' : 'Enable POI animation during replay'}
                                                                              </WaTooltip>
                                                                              <WaButton
                                                                                  id={animationButtonId}
                                                                                  className="replay-poi-summary-button"
                                                                                  appearance="plain"
                                                                                  variant="brand"
                                                                                  size="s"
                                                                                  aria-label={animated ? 'Disable POI animation during replay' : 'Enable POI animation during replay'}
                                                                                  aria-pressed={animated}
                                                                                  disabled={hideAllPoisDuringJourneyReplay || animateAllPoisDuringJourneyReplay}
                                                                                  onClick={toggleAnimation}
                                                                              >
                                                                                  <WaIcon
                                                                                      name={animated ? 'expand' : 'compress'}
                                                                                  variant="regular"/>
                                                                              </WaButton>
                                                                          </span>
                                                                      </span>
                                                                      <div className="replay-poi-details-body">
                                                                          <div className="replay-poi-switches">
                                                                                <WaSwitch
                                                                                    size="xs"
                                                                                    label-at-start
                                                                                    checked={replayEnabled}
                                                                                    disabled={hideAllPoisDuringJourneyReplay}
                                                                                    onInput={event => updatePOIJourneyReplayVisibility(poi.id, event)}
                                                                                >
                                                                                    {'Show during replay'}
                                                                              </WaSwitch>
                                                                          </div>
                                                                          {replayEnabled && (
                                                                              <div
                                                                                  key={`replay-poi-options-${poi.id}`}
                                                                                  className="replay-poi-options">
                                                                                  <div
                                                                                      className="replay-poi-animated-switch">
                                                                                      <WaSwitch
                                                                                          size="xs"
                                                                                          label-at-start
                                                                                          checked={settings.animated !== false}
                                                                                          disabled={hideAllPoisDuringJourneyReplay || animateAllPoisDuringJourneyReplay}
                                                                                          onInput={event => updatePOIJourneyReplaySettings(poi.id, {
                                                                                              animated: getChecked(event),
                                                                                          })}
                                                                                      >
                                                                                          {'Animate during replay'}
                                                                                      </WaSwitch>
                                                                                  </div>
                                                                                  <div className="replay-fieldset">
                                                                                      <WaNumberInput
                                                                                          className="half-width"
                                                                                          label="Duration (s)"
                                                                                          size="s"
                                                                                          appearance="filled"
                                                                                          min="0"
                                                                                          max="60"
                                                                                          step="1"
                                                                                          value={settings.displayDurationSeconds}
                                                                                          onInput={event => updatePOIJourneyReplaySettings(poi.id, {
                                                                                              displayDurationSeconds: Math.round(clampJourneyReplayNumber(
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
                                                                                      className="replay-poi-hidden-fields">
                                                                                      {REPLAY_POI_HIDDEN_FIELDS.map(field => (
                                                                                          <WaSwitch
                                                                                              key={`${poi.id}-${field.key}`}
                                                                                              size="xs"
                                                                                              label-at-start
                                                                                              checked={settings.hiddenFields[field.key] === true}
                                                                                              onInput={event => updatePOIJourneyReplaySettings(poi.id, {
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
                                                                          <div className="replay-poi-actions">
                                                                              <WaButton size="s" appearance="outlined"
                                                                                        onClick={() => editJourneyReplayPOI(poi.id)}>
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
                                         )}
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

const mergeReadiness = (current, updates) => normalizeJourneyReplayReadiness({
                                                                                    ...current,
                                                                                    ...updates,
                                                                                })
