/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayProgressBar.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { REPLAY_DRAWER } from '@Core/constants'
import { REPLAY_LABEL }  from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {
    clampReplayProgress,
    resolveReplayTimelineProgress,
}                           from '@Core/ui/replay/ReplayProgress'
import { createReplayScrubScheduler } from '@Core/ui/replay/ReplayScrubScheduler'
import { captureReplayCropSnapshot } from '@Core/ui/ReplayCropSnapshot'
import { DISTANCE_UNITS, km, UnitUtils } from '@Utils/UnitUtils'
import { WaButton, WaIcon, WaSlider, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useSnapshot } from 'valtio'
import { v4 as uuid } from 'uuid'

const MINUTE_MILLIS = 60 * 1000
const PLACEHOLDER_VALUE = '--'
const finiteNumber = value => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
}

const formatMinutes = minutes => {
    const safeMinutes = Math.max(0, Number.isFinite(minutes) ? minutes : 0)
    const hours = Math.floor(safeMinutes / 60)
    const remainingMinutes = String(safeMinutes % 60).padStart(2, '0')
    return `${String(hours).padStart(2, '0')}:${remainingMinutes}`
}

const formatHoursMinutes = (millis, {ceil = false, round = false} = {}) => {
    const rawMinutes = millis / MINUTE_MILLIS
    const minutes = Math.max(0, ceil ? Math.ceil(rawMinutes) : (round ? Math.round(rawMinutes) : Math.floor(rawMinutes)))
    return formatMinutes(minutes)
}

const formatElapsedHoursMinutes = (elapsedMillis, totalMillis) => {
    const safeTotalMillis = Math.max(0, finiteNumber(totalMillis) ?? 0)
    if (safeTotalMillis <= 0) {
        return null
    }

    const totalMinutes = Math.max(1, Math.ceil(safeTotalMillis / MINUTE_MILLIS))
    const elapsedMinutes = Math.min(
        totalMinutes,
        Math.max(0, Math.round(Math.max(0, finiteNumber(elapsedMillis) ?? 0) / MINUTE_MILLIS)),
    )

    return formatMinutes(elapsedMinutes)
}

const formatDistance = (value, unit) => (UnitUtils.convert(value ?? 0).to(unit) ?? 0).toFixed(1)

/**
 * Format the zero-to-one replay slider value as a percentage.
 *
 * @param {number} value - Slider value in thousandths.
 * @returns {string} Human-readable replay percentage.
 */
const formatReplayScrubPercent = value => `${(Number(value) / 10).toFixed(1)}%`

const playbackProgressFromSample = ({sample, totalDistance, direction, fallback}) => {
    const sampleProgress = finiteNumber(sample?.progress)
    const total = finiteNumber(totalDistance)
    const coveredDistance = direction < 0
                            ? finiteNumber(sample?.remainingDistance)
                            : finiteNumber(sample?.distanceFromStart)

    if (total !== null && total > 0 && coveredDistance !== null) {
        return clampReplayProgress(coveredDistance / total)
    }

    if (sampleProgress !== null) {
        return clampReplayProgress(direction < 0 ? 1 - sampleProgress : sampleProgress)
    }

    return fallback
}

const JourneyReplayTooltip = ({targetId, children}) => {
    const tooltipRef = useRef(null)

    useEffect(() => {
        let frame = null
        let detach = () => {}
        let cancelled = false

        const attach = () => {
            const tooltip = tooltipRef.current
            const anchor = document.getElementById(targetId)

            if (cancelled) {
                return
            }

            if (!tooltip?.isConnected || !anchor) {
                frame = requestAnimationFrame(attach)
                return
            }

            tooltip.removeAttribute('for')
            tooltip.for = null
            tooltip.trigger = 'manual'
            tooltip.anchor = anchor

            const show = () => {
                tooltip.show?.()
            }
            const hide = () => {
                tooltip.hide?.()
            }

            anchor.addEventListener('mouseenter', show)
            anchor.addEventListener('mouseleave', hide)
            anchor.addEventListener('focus', show, true)
            anchor.addEventListener('blur', hide, true)

            detach = () => {
                anchor.removeEventListener('mouseenter', show)
                anchor.removeEventListener('mouseleave', hide)
                anchor.removeEventListener('focus', show, true)
                anchor.removeEventListener('blur', hide, true)
                tooltip.hide?.()
                tooltip.anchor = null
            }
        }

        frame = requestAnimationFrame(attach)

        return () => {
            cancelled = true
            if (frame !== null) {
                cancelAnimationFrame(frame)
            }
            detach()
        }
    }, [targetId])

    return (
        <WaTooltip ref={tooltipRef} trigger="manual">
            {children}
        </WaTooltip>
    )
}

export const JourneyReplayProgressBar = memo(({
                                                 showSettings = false,
                                                 showActions = true,
                                                 showSnapshot = true,
                                                 actionAppearance = 'plain',
                                                 snapshotAppearance = 'plain',
                                                 disabled = false,
                                                 className = '',
                                                 showTime = true,
                                                 showDistance = true,
                                                 progressOverride = null,
                                                 timeLabelOverride = undefined,
                                                 playingOverride = null,
                                                 pausedOverride = null,
                                                 onPlay = null,
                                                 onPause = null,
                                                 onStop = null,
                                                 playLabelOverride = null,
                                                 pauseLabelOverride = null,
                                                 stopLabelOverride = null,
                                                 snapshotLabelOverride = 'Take replay snapshot',
                                                 stopIcon = 'stop',
                                                 stopVariant = 'brand',
                                                 onSnapshot = null,
                                                 showScrubber = true,
                                                 onSeek = null,
                                             }) => {
    const replay = useSnapshot(lgs.stores.replay)
    const {current: unitSystem} = useSnapshot(lgs.settings.unitSystem)
    const {drawers: {open: openDrawer}} = useSnapshot(lgs.stores.ui)
    const idPrefix = useMemo(() => `replay-progress-${uuid()}`, [])
    const scrubSchedulerRef = useRef(null)
    const isUiHidden = replay.mainUiHidden === true
    const isClipSequenceActive = replay.clipSequenceActive === true
    const hasPlaybackSample = Boolean((replay.active || replay.playing || replay.paused) && replay.sample)
    const progress = hasPlaybackSample ? clampReplayProgress(replay.progress) : 0
    const direction = Number(replay.direction) < 0 ? -1 : 1
    const totalMillis = finiteNumber(replay.durationMillis)
    const elapsedMillis = finiteNumber(replay.elapsedMillis)
    const hasJourneyTime = hasPlaybackSample && totalMillis !== null && totalMillis > 0 && elapsedMillis !== null
    const totalDistance = hasPlaybackSample ? replay.totalDistance ?? 0 : 0
    const distanceUnit = DISTANCE_UNITS[unitSystem] ?? km
    const draftFrameState = replay.dynamicFrameState
    const draftPlaybackProgress = replay.recordingSync === true
                                  ? resolveReplayTimelineProgress({
                                      frameIndex:    draftFrameState?.replayFrameIndex ?? draftFrameState?.frameIndex,
                                      frameCount:    draftFrameState?.replayFrameCount ?? draftFrameState?.frameCount,
                                      elapsedMillis: draftFrameState?.elapsedMillis ?? elapsedMillis,
                                      durationMillis: draftFrameState?.durationMillis ?? totalMillis,
                                      fallback:      direction < 0 ? 1 - progress : progress,
                                  })
                                  : null
    const playbackProgress = draftPlaybackProgress
                            ?? playbackProgressFromSample({
                                sample: hasPlaybackSample ? replay.sample : null,
                                totalDistance,
                                direction,
                                fallback: direction < 0 ? 1 - progress : progress,
                            })
    const overrideProgress = progressOverride === null || progressOverride === undefined
                             ? null
                             : finiteNumber(progressOverride)
    const displayProgress = overrideProgress !== null ? clampReplayProgress(overrideProgress) : playbackProgress
    const coveredDistance = hasPlaybackSample && replay.sample
                            ? (direction < 0 ? replay.sample.remainingDistance : replay.sample.distanceFromStart)
                            : totalDistance * playbackProgress

    const timeLabel = useMemo(() => {
        if (!showTime) {
            return null
        }

        if (timeLabelOverride !== undefined) {
            return timeLabelOverride
        }

        if (!hasPlaybackSample) {
            return `${PLACEHOLDER_VALUE} / ${PLACEHOLDER_VALUE}`
        }

        if (!hasJourneyTime) {
            return null
        }

        return `${formatElapsedHoursMinutes(elapsedMillis, totalMillis)} / ${formatHoursMinutes(totalMillis, {ceil: true})}`
    }, [elapsedMillis, hasJourneyTime, hasPlaybackSample, showTime, timeLabelOverride, totalMillis])

    const distanceLabel = useMemo(() => {
        if (!showDistance) {
            return null
        }

        if (!hasPlaybackSample) {
            return `${PLACEHOLDER_VALUE} / ${PLACEHOLDER_VALUE} ${distanceUnit}`
        }

        const covered = formatDistance(coveredDistance, distanceUnit)
        const total = formatDistance(totalDistance, distanceUnit)
        return `${covered} / ${total} ${distanceUnit}`
    }, [coveredDistance, distanceUnit, hasPlaybackSample, showDistance, totalDistance])

    const percentLabel = hasPlaybackSample || overrideProgress !== null ? `${(displayProgress * 100).toFixed(0)}%` : `${PLACEHOLDER_VALUE}%`
    const playing = playingOverride ?? replay.playing
    const paused = pausedOverride ?? replay.paused
    const showPauseAction = playing || (isClipSequenceActive && !paused)
    const playLabel = playLabelOverride ?? (paused ? `Resume ${REPLAY_LABEL}` : `Start ${REPLAY_LABEL}`)
    const pauseLabel = pauseLabelOverride ?? `Pause ${REPLAY_LABEL}`
    const stopLabel = stopLabelOverride ?? `Stop ${REPLAY_LABEL}`
    const snapshotLabel = snapshotLabelOverride
    const settingsLabel = `${REPLAY_LABEL} settings`
    const canScrub = showScrubber
                     && hasPlaybackSample
                     && progressOverride === null
                     && replay.recordingSync !== true
                     && !isClipSequenceActive

    const applyScrubRequest = useCallback(({progress: requestedProgress}) => {
        if (typeof onSeek === 'function') {
            return onSeek(requestedProgress)
        }

        return __.ui.replay?.seek?.(requestedProgress)
    }, [onSeek])

    useEffect(() => {
        const scheduler = createReplayScrubScheduler({apply: applyScrubRequest})
        scrubSchedulerRef.current = scheduler

        return () => {
            scheduler.dispose()
            if (scrubSchedulerRef.current === scheduler) {
                scrubSchedulerRef.current = null
            }
        }
    }, [applyScrubRequest])

    const scrubReplay = useCallback(event => {
        scrubSchedulerRef.current?.request(Number(event.target.value) / 1000)
    }, [])

    const settleReplayScrub = useCallback(event => {
        void scrubSchedulerRef.current?.settle(Number(event.target.value) / 1000)
    }, [])

    const playOrResume = useCallback(() => {
        if (typeof onPlay === 'function') {
            onPlay()
            return
        }

        lgs.stores.replay.toolbarVisible = true
        if (__.ui.replay?.paused) {
            __.ui.replay.resume()
            return
        }
        __.ui.replay?.start()
    }, [onPlay])

    const pause = useCallback(() => {
        if (typeof onPause === 'function') {
            onPause()
            return
        }

        __.ui.replay?.pause()
    }, [onPause])

    const stop = useCallback(() => {
        if (typeof onStop === 'function') {
            onStop()
            return
        }

        __.ui.replay?.stop()
        lgs.stores.replay.toolbarVisible = false
    }, [onStop])

    const snapshot = useCallback(() => {
        void (typeof onSnapshot === 'function' ? onSnapshot() : captureReplayCropSnapshot())
    }, [onSnapshot])

    const toggleSettings = useCallback(() => {
        if (openDrawer === REPLAY_DRAWER) {
            __.ui.drawerManager.close()
            return
        }
        lgs.stores.replay.toolbarVisible = true
        __.ui.drawerManager.open(REPLAY_DRAWER)
    }, [openDrawer])

    return (
        <div className={`replay-progress-bar${className ? ` ${className}` : ''}`}>
            {timeLabel &&
                <span className="replay-progress-segment replay-progress-time">{timeLabel}</span>}
            {distanceLabel &&
                <span className="replay-progress-segment replay-progress-distance">{distanceLabel}</span>}
            {canScrub &&
                <span className="replay-progress-segment replay-progress-scrubber">
                    <WaSlider
                        label="Replay position"
                        size="xs"
                        min={0}
                        max={1000}
                        step={1}
                        value={Math.round(displayProgress * 1000)}
                        valueFormatter={formatReplayScrubPercent}
                        withTooltip
                        onInput={scrubReplay}
                        onChange={settleReplayScrub}
                        disabled={disabled}
                    />
                </span>}
            <span className="replay-progress-segment replay-progress-percent">{percentLabel}</span>
            {showActions &&
                <span className="replay-progress-segment replay-progress-actions">
                    {showPauseAction ? (
                        <>
                            <JourneyReplayTooltip targetId={`${idPrefix}-pause`}>{pauseLabel}</JourneyReplayTooltip>
                            <WaButton
                                id={`${idPrefix}-pause`}
                                className="replay-progress-action"
                                appearance={actionAppearance}
                                variant="brand"
                                size="s"
                                title={pauseLabel}
                                aria-label={pauseLabel}
                                onClick={pause}
                                disabled={disabled}
                            >
                                <WaIcon name="pause" variant="regular"/>
                            </WaButton>
                        </>
                    ) : (
                         <>
                             <JourneyReplayTooltip targetId={`${idPrefix}-play`}>{playLabel}</JourneyReplayTooltip>
                             <WaButton
                                 id={`${idPrefix}-play`}
                                 className="replay-progress-action"
                                 appearance={actionAppearance}
                                 variant="brand"
                                 size="s"
                                 title={playLabel}
                                 aria-label={playLabel}
                                 onClick={playOrResume}
                                 disabled={disabled}
                             >
                                 <WaIcon name="play" variant="regular"/>
                             </WaButton>
                         </>
                     )}
                    {showSnapshot &&
                        <>
                            <JourneyReplayTooltip targetId={`${idPrefix}-snapshot`}>{snapshotLabel}</JourneyReplayTooltip>
                            <WaButton
                                id={`${idPrefix}-snapshot`}
                                className="replay-progress-action"
                                appearance={snapshotAppearance}
                                variant="brand"
                                size="s"
                                title={snapshotLabel}
                                aria-label={snapshotLabel}
                                onClick={snapshot}
                                disabled={disabled}
                            >
                                <WaIcon name="camera" variant="regular"/>
                            </WaButton>
                        </>}
                    <JourneyReplayTooltip targetId={`${idPrefix}-stop`}>{stopLabel}</JourneyReplayTooltip>
                    <WaButton
                        id={`${idPrefix}-stop`}
                        className="replay-progress-action"
                        appearance={actionAppearance}
                        variant={stopVariant}
                        size="s"
                        title={stopLabel}
                        aria-label={stopLabel}
                        onClick={stop}
                        disabled={disabled}
                    >
                        <WaIcon name={stopIcon} variant="regular"/>
                    </WaButton>
                </span>}
            {showSnapshot && !showActions &&
                <span className="replay-progress-segment replay-progress-snapshot">
                    <JourneyReplayTooltip targetId={`${idPrefix}-snapshot`}>{snapshotLabel}</JourneyReplayTooltip>
                    <WaButton
                        id={`${idPrefix}-snapshot`}
                        className="replay-progress-action"
                        appearance={snapshotAppearance}
                        variant="brand"
                        size="s"
                        title={snapshotLabel}
                        aria-label={snapshotLabel}
                        onClick={snapshot}
                        disabled={disabled}
                    >
                        <WaIcon name="camera" variant="regular"/>
                    </WaButton>
                </span>}
            {showSettings && !isUiHidden &&
                <span className="replay-progress-settings">
                    <JourneyReplayTooltip targetId={`${idPrefix}-settings`}>{settingsLabel}</JourneyReplayTooltip>
                    <WaButton
                        id={`${idPrefix}-settings`}
                        className="replay-progress-action"
                        appearance={actionAppearance}
                        variant="brand"
                        size="s"
                        title={settingsLabel}
                        aria-label={settingsLabel}
                        onClick={toggleSettings}
                        disabled={disabled}
                    >
                        <WaIcon name="sliders" variant="regular"/>
                    </WaButton>
                </span>}
        </div>
    )
})
