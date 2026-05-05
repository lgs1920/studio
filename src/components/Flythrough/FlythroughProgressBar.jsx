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
import { memo, useCallback, useId, useMemo } from 'react'
import { useSnapshot } from 'valtio'

const MINUTE_MILLIS = 60 * 1000
const clampProgress = value => Math.max(0, Math.min(1, Number(value) || 0))
const finiteNumber = value => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
}

const formatHoursMinutes = (millis, {ceil = false} = {}) => {
    const minutes = Math.max(0, ceil ? Math.ceil(millis / MINUTE_MILLIS) : Math.floor(millis / MINUTE_MILLIS))
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = String(minutes % 60).padStart(2, '0')
    return `${String(hours).padStart(2, '0')}:${remainingMinutes}`
}

const formatElapsedHoursMinutes = (elapsedMillis, totalMillis, progress) => {
    if (clampProgress(progress) <= 0) {
        return formatHoursMinutes(0)
    }
    return formatHoursMinutes(Math.min(elapsedMillis, totalMillis), {ceil: true})
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

export const FlythroughProgressBar = memo(({showSettings = false, className = ''}) => {
    const flythrough = useSnapshot(lgs.stores.ui.mainUI.flythrough)
    const {current: unitSystem} = useSnapshot(lgs.settings.unitSystem)
    const {drawers: {open: openDrawer}} = useSnapshot(lgs.stores.ui)
    const idPrefix = useId().replace(/[^a-zA-Z0-9_-]/g, '')
    const progress = clampProgress(flythrough.progress)
    const direction = Number(flythrough.direction) < 0 ? -1 : 1
    const duration = Number(flythrough.duration)
    const hasDuration = Number.isFinite(duration) && duration > 0
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
        if (!hasDuration) {
            return null
        }

        const totalMillis = duration * 1000
        const elapsedMillis = totalMillis * clampProgress(playbackProgress)
        return `${formatElapsedHoursMinutes(elapsedMillis, totalMillis, playbackProgress)} / ${formatHoursMinutes(totalMillis, {ceil: true})}`
    }, [duration, hasDuration, playbackProgress])

    const distanceLabel = useMemo(() => {
        const covered = formatDistance(coveredDistance, distanceUnit)
        const total = formatDistance(totalDistance, distanceUnit)
        return `${covered} / ${total} ${distanceUnit}`
    }, [coveredDistance, distanceUnit, totalDistance])

    const percentLabel = `${(playbackProgress * 100).toFixed(1)}%`
    const playing = flythrough.playing
    const paused = flythrough.paused

    const playOrResume = useCallback(() => {
        lgs.stores.ui.mainUI.flythrough.toolbarVisible = true
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
        lgs.stores.ui.mainUI.flythrough.toolbarVisible = false
    }, [])

    const toggleSettings = useCallback(() => {
        if (openDrawer === FLYTHROUGH_DRAWER) {
            __.ui.drawerManager.close()
            return
        }
        lgs.stores.ui.mainUI.flythrough.toolbarVisible = true
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
                        <WaTooltip for={`${idPrefix}-pause`}>{`Pause ${FLYTHROUGH_LABEL}`}</WaTooltip>
                        <WaButton
                            id={`${idPrefix}-pause`}
                            className="flythrough-progress-action"
                            appearance="plain"
                            variant="brand"
                            size="small"
                            onClick={pause}
                        >
                            <WaIcon name="pause" variant="regular"/>
                        </WaButton>
                    </>
                ) : (
                     <>
                         <WaTooltip for={`${idPrefix}-play`}>
                             {paused ? `Resume ${FLYTHROUGH_LABEL}` : `Start ${FLYTHROUGH_LABEL}`}
                         </WaTooltip>
                         <WaButton
                             id={`${idPrefix}-play`}
                             className="flythrough-progress-action"
                             appearance="plain"
                             variant="brand"
                             size="small"
                             onClick={playOrResume}
                         >
                             <WaIcon name="play" variant="regular"/>
                         </WaButton>
                     </>
                 )}
                <WaTooltip for={`${idPrefix}-stop`}>{`Stop ${FLYTHROUGH_LABEL}`}</WaTooltip>
                <WaButton
                    id={`${idPrefix}-stop`}
                    className="flythrough-progress-action"
                    appearance="plain"
                    variant="brand"
                    size="small"
                    onClick={stop}
                >
                    <WaIcon name="stop" variant="regular"/>
                </WaButton>
            </span>
            {showSettings &&
                <span className="flythrough-progress-settings">
                    <WaTooltip for={`${idPrefix}-settings`}>{`${FLYTHROUGH_LABEL} settings`}</WaTooltip>
                    <WaButton
                        id={`${idPrefix}-settings`}
                        className="flythrough-progress-action"
                        appearance="plain"
                        variant="brand"
                        size="small"
                        onClick={toggleSettings}
                    >
                        <WaIcon name="sliders" variant="regular"/>
                    </WaButton>
                </span>}
        </div>
    )
})
