/**
 * Replay Timeline preview for linked video preparation.
 */

import {WaButton, WaButtonGroup, WaIcon} from '@web.awesome.me/webawesome-pro/dist/react'
import {Timeline} from '@xzdarcy/react-timeline-editor'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useSnapshot} from 'valtio'
import {
    CREDITS_WIDGET,
    JOURNEY_WIDGETS,
    LOGO_WIDGET,
    MULTI_PURPOSE_WIDGETS,
    REPLAY_RECORDING_MONITOR_WIDGET_ID,
    REPLAY_TIMELINE_WIDGET,
    VIDEO_WIDGETS_BOARD,
    WIDGET_LAYER_START,
    WIDGET_LAYER_STEP,
} from '@Core/constants'
import {LGSPopup} from '@Components/LGSPopup'
import {WidgetsPanelContent} from '@Components/MainUI/widgets/WidgetsPanelContent'
import {ToggleStateIcon} from '@Components/ToggleStateIcon'
import {createReplayScrubScheduler} from '@Core/ui/replay/ReplayScrubScheduler'
import {resolveReplayVideoFramePhase} from '@Core/ui/replay/ReplayVideoTimeline'
import {useOptionalSnapshot} from '@Utils/ValtioUtils'
import {
    decorateReplayTimelineEditorData,
    relayReplayTimelineRowDrag,
    REPLAY_TIMELINE_UI,
    resolveReplayTimelineHeight,
    resolveReplayTimelineLegendTransform,
} from './replayTimelineUtils'
import {
    buildReplayPreparationTimeline,
    toReplayTimelineEditorData,
} from '@Core/ui/replay/ReplayPreparationTimeline'
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css'
import './replay-timeline-preview.css'

const DEFAULT_REPLAY_DURATION_MILLIS = 60_000
const REPLAY_CAPTURE_FPS = [30, 45, 60, 15]
const REPLAY_WIDGET_GROUPS = [MULTI_PURPOSE_WIDGETS, JOURNEY_WIDGETS]

/**
 * Resolve the clip configuration used by the Replay runtime before playback.
 *
 * Journey-specific clip instances take precedence over the transient store,
 * while the settings catalogue remains the source of clip definitions.
 *
 * @param {Object} replay - Replay store snapshot.
 * @param {Object|null} journey - Current journey snapshot.
 * @param {Object} settingsClips - Reactive Replay clip settings snapshot.
 * @returns {Object} Clip configuration accepted by the shared timeline builder.
 */
const resolvePreparationClips = (replay, journey, settingsClips = {}) => {
    const replayClips = replay?.clips ?? {}
    const catalog = Object.keys(replayClips.catalog ?? {}).length > 0
        ? replayClips.catalog
        : settingsClips.catalog ?? {}
    const start = Array.isArray(journey?.replay?.start)
        ? journey.replay.start
        : (replayClips.start ?? settingsClips.start ?? [])
    const stop = Array.isArray(journey?.replay?.stop)
        ? journey.replay.stop
        : (replayClips.stop ?? settingsClips.stop ?? [])

    return {catalog, start, stop}
}

/**
 * Resolve the capture frame rate used to build the preparation projection.
 *
 * @param {Object} video - Video store snapshot.
 * @param {Object} replay - Replay store snapshot.
 * @returns {number} Positive capture frame rate.
 */
const resolveCaptureFps = (video, replay) => {
    const candidates = [
        replay?.captureFps,
        REPLAY_CAPTURE_FPS[video?.fps],
        30,
    ]
    return candidates.find(candidate => Number.isFinite(Number(candidate)) && Number(candidate) > 0) ?? 30
}

/**
 * Resolve the replay-only duration for preparation.
 *
 * @param {Object} replay - Replay store snapshot.
 * @param {Object} replaySettings - Reactive Replay settings snapshot.
 * @returns {number} Replay duration in milliseconds.
 */
const resolveReplayDurationMillis = (replay, replaySettings = {}) => {
    const candidates = [
        replay?.deferredExportPlan?.videoTimeline?.replayDurationMillis,
        Number(replay?.duration) * 1000,
        Number(replaySettings?.duration) * 1000,
        DEFAULT_REPLAY_DURATION_MILLIS,
    ]
    return candidates.find(candidate => Number.isFinite(Number(candidate)) && Number(candidate) > 0)
           ?? DEFAULT_REPLAY_DURATION_MILLIS
}

/**
 * Resolve the current logical timeline time from the canonical published frame.
 *
 * @param {Object} replay - Replay store snapshot.
 * @param {Object} projection - Timeline projection.
 * @returns {number} Current logical time in milliseconds.
 */
const resolveCurrentTimeMillis = (replay, projection) => {
    const frame = replay?.dynamicFrameState ?? replay?.resolvedFrameState ?? null
    const timeMillis = Number(frame?.frameTimeMs ?? frame?.phase?.frameTimeMs ?? 0)
    return Math.max(0, Math.min(projection.durationMillis, Number.isFinite(timeMillis) ? timeMillis : 0))
}

/**
 * Format a timeline scale value as a compact elapsed-time label.
 *
 * @param {number} seconds - Elapsed time in seconds.
 * @returns {string} Formatted elapsed-time label.
 */
const formatTimelineTime = seconds => {
    const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0))
    const minutes = Math.floor(totalSeconds / 60)
    const remainder = totalSeconds % 60
    return `${minutes}:${`${remainder}`.padStart(2, '0')}`
}

/**
 * Format a major timeline scale label in elapsed seconds.
 *
 * @param {number} seconds - Elapsed time in seconds.
 * @returns {string} Seconds label.
 */
const formatTimelineScale = seconds => `${Math.max(0, Math.round(Number(seconds) || 0))}`

/**
 * Return the action icon associated with one projected Timeline action.
 *
 * @param {Object} action - Timeline action.
 * @returns {string} FontAwesome icon name.
 */
const actionIcon = action => {
    return action?.icon
        ?? (action?.kind === 'start' ? 'play' : action?.kind === 'stop' ? 'stop' : 'puzzle-piece')
}

/**
 * Resolve the color class for one timeline action.
 *
 * @param {Object} action - Timeline action.
 * @returns {string} Action color class suffix.
 */
const actionColorClass = action => ['start', 'replay', 'stop'].includes(action?.kind)
    ? action.kind
    : 'widget'

/**
 * Resolve the miniature type displayed before a timeline action icon.
 *
 * @param {Object} action - Timeline action.
 * @returns {string} Preview type.
 */
const actionPreviewType = action => ['start', 'replay', 'stop'].includes(action?.kind)
    ? 'map'
    : 'widget'

/**
 * Resolve the text displayed in an action item.
 *
 * Text widget actions already carry their configured text as the label.
 * Other actions carry their phase or clip label.
 *
 * @param {Object} action - Timeline action.
 * @returns {string} Action label.
 */
const actionLabel = action => String(action?.label ?? action?.widgetId ?? action?.kind ?? '')

/**
 * Render the actual visual copy placed before a timeline action icon.
 *
 * @param {Object} props - Component properties.
 * @param {Object} props.action - Timeline action.
 * @returns {JSX.Element} Action visual copy.
 */
function TimelineActionPreview({action}) {
    const previewType = actionPreviewType(action)
    return (
        <span className={`replay-timeline-action__preview replay-timeline-action__preview--${previewType} ${colorClasses(action.colorClasses)}`}
              data-preview-kind={previewType}
              aria-hidden="true">
            <span className="replay-timeline-action__icon-trigger">
                <WaIcon name={actionIcon(action)} variant="solid" label=""/>
            </span>
            <span className="replay-timeline-action__label">{actionLabel(action)}</span>
        </span>
    )
}

const renderActionPreview = action => <TimelineActionPreview action={action}/>

/**
 * Convert a Web Awesome color class list to a DOM class string.
 *
 * @param {Array} classes - Web Awesome variant classes.
 * @returns {string} Space-separated class names.
 */
const colorClasses = classes => Array.isArray(classes) && classes.length > 0
    ? classes.join(' ')
    : 'wa-neutral wa-neutral-blue'

/**
 * Resolve the visual class used by a timeline track legend entry.
 *
 * @param {Object} row - Timeline editor row.
 * @returns {string} Track class suffix.
 */
const trackLegendClass = row => {
    if (row?.id === 'replay') {
        return 'replay'
    }
    return 'widget'
}

/**
 * Resolve the legend icon for one visual timeline row.
 *
 * @param {Object} row - Timeline editor row.
 * @returns {string} FontAwesome icon name.
 */
const trackLegendIcon = row => row?.icon ?? (row?.id === 'replay' ? 'route' : 'puzzle-piece')

/**
 * Resolve the compact legend label for one visual timeline row.
 *
 * @param {Object} row - Timeline editor row.
 * @returns {string} Human-readable row label.
 */
const trackLegendLabel = row => row?.id === 'replay'
    ? 'Replay'
    : row?.label ?? row?.id ?? ''

/**
 * Resolve a widget definition from the loaded settings or registry.
 *
 * @param {string} type - Widget base type.
 * @param {Object} widgetSettings - Snapshot of widget catalogue settings.
 * @returns {Object|null} Widget definition.
 */
const resolveWidgetDefinition = (type, widgetSettings) => widgetSettings?.[type]
    ?? globalThis.__?.widgets?.get?.(type)
    ?? null

/**
 * Resolve the visible label for a widget instance.
 *
 * @param {string} id - Widget instance identifier.
 * @param {string} type - Widget base type.
 * @param {Object} definition - Widget catalog definition.
 * @returns {string} Widget label.
 */
const resolveWidgetLabel = (id, type, definition) => {
    const element = definition?.configuration?.elements?.[id]
        ?? definition?.configuration?.user
        ?? definition?.configuration?.default
    if (type === 'text-widget') {
        return String(element?.text?.content ?? '').trim() || definition?.name || type
    }
    return definition?.name ?? type
}

/**
 * Convert the video widget store into canonical bottom-to-top track order.
 *
 * @param {Map} widgetList - Reactive widget list snapshot.
 * @returns {Array} Video widget track definitions.
 */
const resolveVideoWidgetOrder = (widgetList, widgetSettings) => Array.from(widgetList ?? [])
    .filter(([id, entry]) => {
        const widgetType = id.split('#')[0]
        return entry?.widgetsBoard === VIDEO_WIDGETS_BOARD
            && widgetType !== REPLAY_TIMELINE_WIDGET
            && widgetType !== REPLAY_RECORDING_MONITOR_WIDGET_ID
            && Boolean(resolveWidgetDefinition(widgetType, widgetSettings))
    })
    .sort(([leftId, left], [rightId, right]) => {
        const leftType = leftId.split('#')[0]
        const rightType = rightId.split('#')[0]
        const leftFixed = leftType === CREDITS_WIDGET || leftType === LOGO_WIDGET
        const rightFixed = rightType === CREDITS_WIDGET || rightType === LOGO_WIDGET
        if (leftFixed !== rightFixed) {
            return leftFixed ? 1 : -1
        }
        const leftZ = Number(left?.zIndex)
        const rightZ = Number(right?.zIndex)
        if (Number.isFinite(leftZ) && Number.isFinite(rightZ) && leftZ !== rightZ) {
            return leftZ - rightZ
        }
        if (Number.isFinite(leftZ) !== Number.isFinite(rightZ)) {
            return Number.isFinite(leftZ) ? -1 : 1
        }
        return leftId.localeCompare(rightId)
    })
    .map(([id, entry]) => {
        const widgetType = id.split('#')[0]
        const definition = resolveWidgetDefinition(widgetType, widgetSettings)
        const runtimeConfig = globalThis.__?.ui?.widgetManager?.getWidgetConfig?.(id)
        const canHide = (definition?.canHide === true || runtimeConfig?.canHide === true)
                        && definition?.mandatory !== true
                        && runtimeConfig?.mandatory !== true
        return {
            id,
            type: widgetType,
            label: resolveWidgetLabel(id, widgetType, definition),
            icon: definition?.icon ?? 'puzzle-piece',
            timelineColor: definition?.timelineColor,
            canHide,
            visible: entry?.visible !== false && runtimeConfig?.visible !== false,
            fixed: widgetType === CREDITS_WIDGET || widgetType === LOGO_WIDGET,
        }
    })

/**
 * Apply the package's visual top-to-bottom row order to widget stacking.
 *
 * @param {Array} rows - Timeline rows after a row drag.
 * @returns {Promise<void>}
 */
const applyTimelineWidgetOrder = async rows => {
    const widgetIds = rows
        .filter(row => row?.id && row.id !== 'replay' && row.movable !== false && row.fixed !== true)
        .map(row => row.id)
    if (widgetIds.length === 0) {
        return
    }

    const manager = __.ui.widgetManager
    if (typeof manager?.reorderWidgets === 'function') {
        await manager.reorderWidgets(widgetIds)
        return
    }

    // Keep the adapter safe for lightweight test/runtime contexts where the
    // full manager has not been initialized yet.
    const $list = lgs.stores.ui.widget.list
    widgetIds.forEach((id, index) => {
        const current = $list.get(id)
        if (current) {
            $list.set(id, {
                ...current,
                zIndex: WIDGET_LAYER_START + ((widgetIds.length - 1 - index) * WIDGET_LAYER_STEP),
            })
        }
    })
}

/**
 * Resolve a replay progress value from a logical video time.
 *
 * @param {Object} projection - Timeline projection.
 * @param {number} timeMillis - Logical timeline time.
 * @returns {number} Replay progress.
 */
const replayProgressAtTime = (projection, timeMillis) => {
    const phase = resolveReplayVideoFramePhase({
        timeline: projection.timeline,
        frameTimeMs: Math.max(0, Math.min(projection.durationMillis, timeMillis)),
    })
    return phase.progress
}

/**
 * Request direct HQ export through the existing dialog lifecycle.
 *
 * @returns {void}
 */
const requestHqExport = () => {
    globalThis.window?.dispatchEvent(new globalThis.CustomEvent('lgs:video:start-hq-export'))
}

/**
 * Replay Timeline preview component.
 *
 * The package is used as a controlled visual adapter. Its internal engine is
 * never started; Replay remains the sole owner of playback and frame time.
 *
 * @returns {JSX.Element} Preview surface or null outside linked preparation.
 */
export const ReplayTimelinePreview = () => {
    const video = useSnapshot(lgs.stores.ui.video)
    const replay = useSnapshot(lgs.stores.replay)
    const main = useSnapshot(lgs.stores.main)
    const widgetList = useSnapshot(lgs.stores.ui.widget.list)
    const widgetSettings = useOptionalSnapshot(lgs.settings?.widgets, {})
    const replaySettings = useOptionalSnapshot(lgs.settings?.ui?.replay, {})
    const _timeline = useRef(null)
    const _scrubScheduler = useRef(null)
    const _lastTimelineSignature = useRef(null)
    const [timelineScrollTop, setTimelineScrollTop] = useState(0)
    const [draggedRowId, setDraggedRowId] = useState(null)
    const [widgetMenuOpen, setWidgetMenuOpen] = useState(false)
    const journey = main?.theJourney ?? lgs.theJourney
    const widgetOrder = useMemo(() => resolveVideoWidgetOrder(widgetList, widgetSettings), [widgetList, widgetSettings])
    const linkedPreparation = video.editing === true
                               && video.timelinePreviewActive === true
                               && replay.recordingSync === true
                               && !video.preRecording
                               && !video.recording
                               && !video.recordingHQ
                               && !video.finalizing

    const projection = useMemo(() => buildReplayPreparationTimeline({
        videoTimeline: replay.deferredExportPlan?.videoTimeline ?? null,
        replayDurationMillis: resolveReplayDurationMillis(replay, replaySettings),
        fps: resolveCaptureFps({fps: video.fps}, replay),
        direction: replay.direction,
        clips: resolvePreparationClips(replay, journey, replaySettings.clips),
        widgetOrder,
    }), [journey, replay, replaySettings, video.fps, widgetOrder])
    const editorData = useMemo(() => toReplayTimelineEditorData(projection), [projection])
    const draggedRow = useMemo(() => editorData.find(row => row.id === draggedRowId) ?? null, [draggedRowId, editorData])
    const timelineEditorData = useMemo(() => decorateReplayTimelineEditorData(editorData), [editorData])
    const currentTimeMillis = resolveCurrentTimeMillis(replay, projection)
    const isPlaying = replay.playing === true
    const timelineHeight = resolveReplayTimelineHeight(editorData.length)

    const applyTimelineTime = useCallback(async ({progress, settled, signal}) => {
        const timeMillis = progress * projection.durationMillis
        const replayProgress = replayProgressAtTime(projection, timeMillis)
        const replayController = __.ui.replay
        const sample = replayController?.seek?.(replayProgress, {
            qualifyScene: settled === true,
            settled: settled === true,
            signal,
        })
        if (sample?.then) {
            await sample
        }
        replayController?.refresh?.({
            camera: true,
            forceGeometry: true,
            frameTimeMs: timeMillis,
            frameIntervalMs: projection.timeline.frameIntervalMs,
            exportMode: false,
        })
        return sample
    }, [projection])

    useEffect(() => {
        if (!linkedPreparation) {
            _scrubScheduler.current?.dispose?.()
            _scrubScheduler.current = null
            return undefined
        }

        const scheduler = createReplayScrubScheduler({
            apply: applyTimelineTime,
        })
        _scrubScheduler.current = scheduler
        return () => {
            scheduler.dispose()
            if (_scrubScheduler.current === scheduler) {
                _scrubScheduler.current = null
            }
        }
    }, [applyTimelineTime, linkedPreparation])

    useEffect(() => {
        if (!linkedPreparation || !_timeline.current || projection.durationMillis <= 0) {
            return
        }

        _timeline.current.setTime(currentTimeMillis / 1000)
    }, [currentTimeMillis, linkedPreparation, projection.durationMillis])

    useEffect(() => {
        if (!draggedRowId) {
            return undefined
        }

        const clearDraggedRow = () => setDraggedRowId(null)
        document.addEventListener('mouseup', clearDraggedRow)
        return () => document.removeEventListener('mouseup', clearDraggedRow)
    }, [draggedRowId])

    useEffect(() => {
        if (!linkedPreparation || _lastTimelineSignature.current === projection.signature) {
            return
        }

        _lastTimelineSignature.current = projection.signature
        void __.ui.replay?.enterReplayPreparation?.({
            journey: lgs.theJourney,
            shouldApply: () => lgs.stores.ui.video.timelinePreviewActive === true
                           && lgs.stores.replay.recordingSync === true,
        })
    }, [linkedPreparation, projection.signature])

    const seekToTime = useCallback(timeSeconds => {
        if (projection.durationMillis <= 0) {
            return
        }
        _scrubScheduler.current?.settle?.(
            Math.max(0, Math.min(1, (Number(timeSeconds) * 1000) / projection.durationMillis)),
        )
    }, [projection.durationMillis])

    const requestTime = useCallback(timeSeconds => {
        if (projection.durationMillis <= 0) {
            return
        }
        _scrubScheduler.current?.request?.(
            Math.max(0, Math.min(1, (Number(timeSeconds) * 1000) / projection.durationMillis)),
        )
    }, [projection.durationMillis])

    const handleTogglePlayback = useCallback(() => {
        __.ui.replay?.toggle?.()
    }, [])

    const handlePause = useCallback(() => {
        __.ui.replay?.pause?.()
    }, [])

    const handleReplay = useCallback(() => {
        __.ui.replay?.start?.({progress: projection.direction < 0 ? 1 : 0})
    }, [projection.direction])

    /**
     * Mark the row currently handled by the package row-drag interaction.
     *
     * @param {Object} dragState - Row-drag start state.
     * @param {Object} dragState.row - Timeline row being dragged.
     * @returns {void}
     */
    const handleTimelineRowDragStart = useCallback(({row} = {}) => {
        if (row?.movable !== false && row?.fixed !== true) {
            setDraggedRowId(row?.id ?? null)
        }
    }, [])

    const handleRowDragEnd = useCallback(({row, editorData: nextEditorData}) => {
        setDraggedRowId(null)
        if (row?.id === 'replay') {
            return
        }

        void applyTimelineWidgetOrder(nextEditorData)
    }, [])

    /**
     * Toggle the visibility of the widget represented by a timeline track.
     *
     * @param {Object} row - Timeline row represented by the legend entry.
     * @param {boolean} nextVisible - Requested widget visibility.
     * @param {Event} event - Visibility button event.
     * @returns {void}
     */
    const handleTrackVisibilityChange = useCallback((row, nextVisible, event) => {
        event?.preventDefault?.()
        event?.stopPropagation?.()
        if (!row?.canHide) {
            return
        }

        __.ui.widgetManager.toggleWidgetVisibility?.(row.id, nextVisible)
    }, [])

    /**
     * Keep the external track legend aligned with the virtualized timeline rows.
     *
     * @param {Object} scrollState - Vertical scroll state emitted by Timeline.
     * @param {number} scrollState.scrollTop - Current vertical scroll offset.
     * @returns {void}
     */
    const handleTimelineScroll = useCallback(({scrollTop = 0} = {}) => {
        setTimelineScrollTop(scrollTop)
    }, [])

    /**
     * Start the package-owned row drag when the user presses a track name.
     *
     * @param {MouseEvent} event - Pointer event received by the track legend.
     * @param {Object} row - Timeline row represented by the legend entry.
     * @param {number} rowIndex - Position of the row in the rendered editor data.
     * @returns {void}
     */
    const handleTrackLegendMouseDown = useCallback((event, row, rowIndex) => {
        const timelineElement = _timeline.current?.target
        relayReplayTimelineRowDrag({event, row, rowIndex, timelineElement})
    }, [])

    if (!linkedPreparation) {
        return null
    }

    return (
        <section className="replay-timeline-preview"
                 data-testid="replay-timeline-preview"
                 aria-label="Replay Timeline preview">
            <header className="replay-timeline-preview__header">
                <div>
                    <span className="replay-timeline-preview__eyebrow">{'Replay preparation'}</span>
                    <h2>{'Timeline'}</h2>
                </div>
                <WaButtonGroup label="Replay Timeline controls">
                    <WaButton appearance="plain"
                              size="s"
                              aria-label={isPlaying ? 'Pause Replay' : 'Play Replay'}
                              data-testid="replay-timeline-play"
                              onClick={isPlaying ? handlePause : handleTogglePlayback}>
                        <WaIcon name={isPlaying ? 'pause' : 'play'} label=""/>
                    </WaButton>
                    <WaButton appearance="plain"
                              size="s"
                              aria-label="Replay from beginning"
                              data-testid="replay-timeline-replay"
                              onClick={handleReplay}>
                        <WaIcon name="arrow-rotate-left" label=""/>
                    </WaButton>
                    <WaButton variant="brand"
                              appearance="filled"
                              size="s"
                              aria-label="Create HQ video"
                              data-testid="replay-timeline-export"
                              onClick={requestHqExport}>
                        <WaIcon name="clapperboard-play" label=""/>
                        <span>{'Create HQ'}</span>
                    </WaButton>
                </WaButtonGroup>
            </header>
            <div className="replay-timeline-preview__transport" aria-label="Replay transport">
                <span data-testid="replay-timeline-current-time">{formatTimelineTime(currentTimeMillis / 1000)}</span>
                <span>{' / '}</span>
                <span>{formatTimelineTime(projection.durationSeconds)}</span>
            </div>
            <div className={`replay-timeline-preview__timeline-layout${draggedRowId ? ' replay-timeline-preview__timeline-layout--dragging' : ''}`}
                 data-capture-exclude="true"
                 data-testid="replay-timeline-layout"
                 style={{'--replay-timeline-track-legend-width': `${REPLAY_TIMELINE_UI.legendWidth}px`}}>
                <div className="replay-timeline-preview__track-legend"
                     data-testid="replay-timeline-track-legend"
                     aria-label="Timeline tracks">
                    <div className="replay-timeline-preview__track-legend-ruler">
                        <WaButton id="replay-timeline-widget-menu-trigger"
                                  className="replay-timeline-preview__widget-menu-trigger"
                                  size="s"
                                  variant="brand"
                                  appearance="plain"
                                  aria-label="Add widget to timeline"
                                  aria-haspopup="menu"
                                  aria-expanded={widgetMenuOpen ? 'true' : 'false'}
                                  onClick={() => setWidgetMenuOpen(current => !current)}>
                            <WaIcon name="plus" variant="solid" label=""/>
                        </WaButton>
                    </div>
                    {widgetMenuOpen && (
                        <LGSPopup active
                                  anchor="replay-timeline-widget-menu-trigger"
                                  className="replay-timeline-preview__widget-menu-popup"
                                  placement="bottom-start"
                                  distance={4}
                                  onRequestClose={() => setWidgetMenuOpen(false)}>
                            <WidgetsPanelContent groups={REPLAY_WIDGET_GROUPS}
                                                 themeClassName="wa-theme-lgs1920"/>
                        </LGSPopup>
                    )}
                    <div className="replay-timeline-preview__track-legend-viewport">
                        <div className="replay-timeline-preview__track-legend-rows"
                             data-testid="replay-timeline-track-legend-rows"
                             style={{transform: resolveReplayTimelineLegendTransform(timelineScrollTop)}}>
                            {editorData.map((row, rowIndex) => {
                                return (
                                    <div className={`replay-timeline-preview__track-legend-row replay-timeline-preview__track-legend-row--${trackLegendClass(row)} ${colorClasses(row.colorClasses)}${row.movable !== false && row.fixed !== true ? ' replay-timeline-preview__track-legend-row--movable' : ''}${draggedRowId === row.id ? ' replay-timeline-preview__track-legend-row--dragging' : ''}`}
                                         key={row.id}
                                         aria-label={trackLegendLabel(row)}
                                         onMouseDown={event => handleTrackLegendMouseDown(event, row, rowIndex)}>
                                        <span className="replay-timeline-preview__track-drag-icon"
                                              aria-hidden="true">
                                            <WaIcon name={row.movable !== false && row.fixed !== true ? 'grip-dots-vertical' : 'thumbtack'}
                                                    variant="solid"
                                                    label=""/>
                                        </span>
                                        <span className="replay-timeline-preview__track-visibility-toggle lgs-widget-no-drag"
                                              onClick={event => event.stopPropagation()}
                                              onMouseDown={event => event.stopPropagation()}>
                                            {row.canHide && (
                                                <ToggleStateIcon
                                                    initial={row.visible !== false}
                                                    mode="link"
                                                    size="s"
                                                    appearance="plain"
                                                    buttonVariant="neutral"
                                                    aria-label={row.visible !== false
                                                        ? `Hide ${trackLegendLabel(row)}`
                                                        : `Show ${trackLegendLabel(row)}`}
                                                    onChange={(nextVisible, event) => handleTrackVisibilityChange(row, nextVisible, event)}
                                                />
                                            )}
                                        </span>
                                        <span className={`replay-timeline-preview__track-icon-frame ${colorClasses(row.colorClasses)}`}>
                                            <WaIcon className={colorClasses(row.colorClasses)} name={trackLegendIcon(row)} variant="regular" label=""/>
                                        </span>
                                        <span className="replay-timeline-preview__track-label">{trackLegendLabel(row)}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
                <div className={`replay-timeline-preview__surface${draggedRow ? ` ${colorClasses(draggedRow.colorClasses)}` : ''}`}>
                    <Timeline
                    style={{height: `${timelineHeight}px`}}
                    editorData={timelineEditorData}
                    effects={{}}
                    scale={1}
                    scaleWidth={REPLAY_TIMELINE_UI.scaleWidth}
                    scaleSplitCount={REPLAY_TIMELINE_UI.scaleSplitCount}
                    minScaleCount={Math.max(10, Math.ceil(projection.durationSeconds))}
                    maxScaleCount={Math.max(10, Math.ceil(projection.durationSeconds))}
                    rowHeight={REPLAY_TIMELINE_UI.rowHeight}
                    disableDrag={false}
                    enableRowDrag
                    autoScroll={false}
                    autoReRender
                    onScroll={handleTimelineScroll}
                    onRowDragStart={handleTimelineRowDragStart}
                    onActionResizing={() => false}
                    onRowDragEnd={handleRowDragEnd}
                    hideCursor={false}
                    onCursorDrag={requestTime}
                    onCursorDragEnd={seekToTime}
                    onClickTimeArea={time => {
                        seekToTime(time)
                        return false
                    }}
                    getScaleRender={scale => <span>{formatTimelineScale(scale)}</span>}
                    getActionRender={action => {
                        return (
                            <div className={`replay-timeline-action replay-timeline-action--${actionColorClass(action)} replay-timeline-action--${action.kind ?? 'replay'} ${colorClasses(action.colorClasses)}${action.visible === false ? ' replay-timeline-action--hidden' : ''}`}
                                 data-action-kind={action.kind}
                                 data-testid={`replay-timeline-action-${action.id}`}
                                 aria-label={actionLabel(action)}>
                                {renderActionPreview(action)}
                            </div>
                        )
                    }}
                    ref={_timeline}
                    />
                </div>
            </div>
        </section>
    )
}

ReplayTimelinePreview.displayName = 'ReplayTimelinePreview'
