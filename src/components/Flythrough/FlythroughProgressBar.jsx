/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughProgressBar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-05
 * Last modified: 2026-05-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { FLYTHROUGH_DRAWER } from '@Core/constants'
import { FLYTHROUGH_LABEL }  from '@Core/ui/flythrough/FlythroughProgressionStyle'
import { DISTANCE_UNITS, km, UnitUtils } from '@Utils/UnitUtils'
import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useSnapshot } from 'valtio'
import { v4 as uuid } from 'uuid'

const MINUTE_MILLIS = 60 * 1000
const clampProgress = value => Math.max(0, Math.min(1, Number(value) || 0))
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

const playbackProgressFromSample = ({sample, totalDistance, direction, fallback}) => {
    const sampleProgress = finiteNumber(sample?.progress)
    const total = finiteNumber(totalDistance)
    const coveredDistance = direction < 0
                            ? finiteNumber(sample?.remainingDistance)
                            : finiteNumber(sample?.distanceFromStart)

    if (total !== null && total > 0 && coveredDistance !== null) {
        return clampProgress(coveredDistance / total)
    }

    if (sampleProgress !== null) {
        return clampProgress(direction < 0 ? 1 - sampleProgress : sampleProgress)
    }

    return fallback
}

const FlythroughTooltip = ({targetId, children}) => {
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

export const FlythroughProgressBar = memo(({showSettings = false, className = ''}) => {
    const flythrough = useSnapshot(lgs.stores.flythrough)
    const {current: unitSystem} = useSnapshot(lgs.settings.unitSystem)
    const {drawers: {open: openDrawer}} = useSnapshot(lgs.stores.ui)
    const idPrefix = useMemo(() => `flythrough-progress-${uuid()}`, [])
    const progress = clampProgress(flythrough.progress)
    const direction = Number(flythrough.direction) < 0 ? -1 : 1
    const totalMillis = finiteNumber(flythrough.durationMillis)
    const elapsedMillis = finiteNumber(flythrough.elapsedMillis)
    const hasJourneyTime = totalMillis !== null && totalMillis > 0 && elapsedMillis !== null
    const totalDistance = flythrough.totalDistance ?? 0
    const distanceUnit = DISTANCE_UNITS[unitSystem] ?? km
    const playbackProgress = playbackProgressFromSample({
        sample: flythrough.sample,
        totalDistance,
        direction,
        fallback: direction < 0 ? 1 - progress : progress,
    })
    const coveredDistance = flythrough.sample
                            ? (direction < 0 ? flythrough.sample.remainingDistance : flythrough.sample.distanceFromStart)
                            : totalDistance * playbackProgress

    const timeLabel = useMemo(() => {
        if (!hasJourneyTime) {
            return null
        }

        return `${formatElapsedHoursMinutes(elapsedMillis, totalMillis)} / ${formatHoursMinutes(totalMillis, {ceil: true})}`
    }, [elapsedMillis, hasJourneyTime, totalMillis])

    const distanceLabel = useMemo(() => {
        const covered = formatDistance(coveredDistance, distanceUnit)
        const total = formatDistance(totalDistance, distanceUnit)
        return `${covered} / ${total} ${distanceUnit}`
    }, [coveredDistance, distanceUnit, totalDistance])

    const percentLabel = `${(playbackProgress * 100).toFixed(0)}%`
    const playing = flythrough.playing
    const paused = flythrough.paused
    const playLabel = paused ? `Resume ${FLYTHROUGH_LABEL}` : `Start ${FLYTHROUGH_LABEL}`
    const pauseLabel = `Pause ${FLYTHROUGH_LABEL}`
    const stopLabel = `Stop ${FLYTHROUGH_LABEL}`
    const settingsLabel = `${FLYTHROUGH_LABEL} settings`

    const playOrResume = useCallback(() => {
        lgs.stores.flythrough.toolbarVisible = true
        if (__.ui.flythrough?.paused) {
            __.ui.flythrough.resume()
            return
        }
        __.ui.flythrough?.start()
    }, [])

    const pause = useCallback(() => {
        __.ui.flythrough?.pause()
    }, [])

    const stop = useCallback(() => {
        __.ui.flythrough?.stop()
        lgs.stores.flythrough.toolbarVisible = false
    }, [])

    const toggleSettings = useCallback(() => {
        if (openDrawer === FLYTHROUGH_DRAWER) {
            __.ui.drawerManager.close()
            return
        }
        lgs.stores.flythrough.toolbarVisible = true
        __.ui.drawerManager.open(FLYTHROUGH_DRAWER)
    }, [openDrawer])

    return (
        <div className={`flythrough-progress-bar${className ? ` ${className}` : ''}`}>
            {timeLabel &&
                <span className="flythrough-progress-segment flythrough-progress-time">{timeLabel}</span>}
            <span className="flythrough-progress-segment flythrough-progress-distance">{distanceLabel}</span>
            <span className="flythrough-progress-segment flythrough-progress-percent">{percentLabel}</span>
            <span className="flythrough-progress-segment flythrough-progress-actions">
                {playing ? (
                    <>
                        <FlythroughTooltip targetId={`${idPrefix}-pause`}>{pauseLabel}</FlythroughTooltip>
                        <WaButton
                            id={`${idPrefix}-pause`}
                            className="flythrough-progress-action"
                            appearance="plain"
                            variant="brand"
                            size="small"
                            title={pauseLabel}
                            aria-label={pauseLabel}
                            onClick={pause}
                        >
                            <WaIcon name="pause" variant="regular"/>
                        </WaButton>
                    </>
                ) : (
                     <>
                         <FlythroughTooltip targetId={`${idPrefix}-play`}>{playLabel}</FlythroughTooltip>
                         <WaButton
                             id={`${idPrefix}-play`}
                             className="flythrough-progress-action"
                             appearance="plain"
                             variant="brand"
                             size="small"
                             title={playLabel}
                             aria-label={playLabel}
                             onClick={playOrResume}
                         >
                             <WaIcon name="play" variant="regular"/>
                         </WaButton>
                     </>
                 )}
                <FlythroughTooltip targetId={`${idPrefix}-stop`}>{stopLabel}</FlythroughTooltip>
                <WaButton
                    id={`${idPrefix}-stop`}
                    className="flythrough-progress-action"
                    appearance="plain"
                    variant="brand"
                    size="small"
                    title={stopLabel}
                    aria-label={stopLabel}
                    onClick={stop}
                >
                    <WaIcon name="stop" variant="regular"/>
                </WaButton>
            </span>
            {showSettings &&
                <span className="flythrough-progress-settings">
                    <FlythroughTooltip targetId={`${idPrefix}-settings`}>{settingsLabel}</FlythroughTooltip>
                    <WaButton
                        id={`${idPrefix}-settings`}
                        className="flythrough-progress-action"
                        appearance="plain"
                        variant="brand"
                        size="small"
                        title={settingsLabel}
                        aria-label={settingsLabel}
                        onClick={toggleSettings}
                    >
                        <WaIcon name="sliders" variant="regular"/>
                    </WaButton>
                </span>}
        </div>
    )
})
