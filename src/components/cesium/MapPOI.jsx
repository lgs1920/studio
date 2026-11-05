/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOI.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-12-23
 * Last modified: 2026-11-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { MapPOIContent }                   from '@Components/MainUI/MapPOI/MapPOIContent'
import { MapOverlaySurface }                from '@Components/MainUI/MapOverlaySurface'
import {
    normalizeJourneyReplayPOISettings, resolveReplayPOIPresentation,
} from '@Core/ui/replay/JourneyReplayPOISettings'
import {
    clearPOIHoverPreview, clearPOIHoverTitlePreview, getPOIHoverPreview, getPOIHoverTitle,
    isPOIHoverPreviewTransitionActive, setPOIHoverPreviewPosition, subscribeToPOIHoverPreview,
} from '@Components/MainUI/MapPOI/poiHoverPreviewStore'
import { POIUtils }                                       from '@Utils/cesium/POIUtils'
import {useReplayPOISelector} from '@Components/MainUI/MapPOI/replayPOISelectorStore'
import {subscribeToPOIProjectionUpdates} from './poiProjectionScheduler'
import { memo, useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useSnapshot }                                    from 'valtio'
import { proxy }                           from 'valtio'

const EMPTY_REPLAY_PROXY = proxy({nearbyPois: []})

export const MapPOI = memo(({point}) => {

    const $list = lgs.stores.main.components.pois.list
    const $point = $list.get(point) ?? EMPTY_REPLAY_PROXY
    const thePOI = useSnapshot($point)
    const viewable = useSnapshot(lgs.stores.main.components.pois.visibleList)
    const replay = useSnapshot(lgs.stores?.replay ?? EMPTY_REPLAY_PROXY)
    const hasPOI = Boolean(thePOI)
    const hasCoordinates = Number.isFinite(thePOI?.latitude) && Number.isFinite(thePOI?.longitude)

    const [pixels, setPixels] = useState(null)
    const [scale, setScale] = useState(1)
    const [tooFar, setTooFar] = useState(false)
    const subscribeHoverPreview = useCallback(
        listener => subscribeToPOIHoverPreview(thePOI?.id, listener),
        [thePOI?.id],
    )
    const getHoverPreviewSnapshot = useCallback(
        () => getPOIHoverPreview(thePOI?.id),
        [thePOI?.id],
    )
    const hoverPreviewActive = useSyncExternalStore(subscribeHoverPreview, getHoverPreviewSnapshot, () => false)
    const getHoverTitleSnapshot = useCallback(
        () => getPOIHoverTitle(thePOI?.id),
        [thePOI?.id],
    )
    const hoverTitleActive = useSyncExternalStore(subscribeHoverPreview, getHoverTitleSnapshot, () => false)
    const replayAnimatedPOI = useReplayPOISelector('animated', thePOI?.id)
    const presentation = resolveReplayPOIPresentation(thePOI, {replay, animatedPOI: replayAnimatedPOI})
    const replayActive = presentation.active
    const replaySettings = normalizeJourneyReplayPOISettings(thePOI?.replay)
    const shouldProjectForHover = presentation.visible
        && (hoverPreviewActive || (hoverTitleActive && !thePOI?.expanded))

    useEffect(() => {
        if (hoverPreviewActive && ((thePOI?.expanded && !isPOIHoverPreviewTransitionActive(thePOI.id))
            || tooFar || !presentation.visible)) {
            clearPOIHoverPreview(thePOI.id)
        }
    }, [hoverPreviewActive, presentation.visible, thePOI?.expanded, thePOI?.id, tooFar])
    useEffect(() => {
        if (hoverTitleActive && (tooFar || !presentation.visible)) {
            clearPOIHoverTitlePreview(thePOI.id)
        }
    }, [hoverTitleActive, presentation.visible, thePOI?.expanded, thePOI?.id, tooFar])
    useEffect(() => {
        if (!shouldProjectForHover) {
            setPixels(null)
            return undefined
        }

        let cancelled = false
        let projectionPending = false
        let projectionQueued = false

        const tick = async () => {
            if (projectionPending) {
                projectionQueued = true
                return
            }

            projectionPending = true
            if (cancelled || !hasPOI || !hasCoordinates) {
                setPixels(null)
                clearPOIHoverPreview(point)
                clearPOIHoverTitlePreview(point)
                projectionPending = false
                return
            }

            const currentPOI = $list.get(point)
            if (!currentPOI?.id || !Number.isFinite(currentPOI.latitude) || !Number.isFinite(currentPOI.longitude)) {
                setPixels(null)
                clearPOIHoverPreview(point)
                clearPOIHoverTitlePreview(point)
                projectionPending = false
                return
            }

            const coords = await __.ui.sceneManager.degreesToPixelsCoordinates(currentPOI, true)
            if (cancelled) {
                projectionPending = false
                return
            }

            if (coords?.visible) {
                setPixels(previous => previous?.x === coords.x && previous?.y === coords.y
                    ? previous
                    : {x: coords.x, y: coords.y})
                setPOIHoverPreviewPosition(currentPOI.id, coords.x, window.innerHeight - coords.y)
            }
            else {
                setPixels(null)
            }

            const scaleInfo = POIUtils.adaptScaleToDistance(currentPOI)
            setScale(previous => previous === scaleInfo.scale ? previous : scaleInfo.scale)
            setTooFar(previous => previous === scaleInfo.tooFar ? previous : scaleInfo.tooFar)
            projectionPending = false

            if (projectionQueued && !cancelled) {
                projectionQueued = false
                void tick()
            }
        }

        void tick()

        const removeProjectionUpdates = subscribeToPOIProjectionUpdates({
            scene: lgs.scene,
            camera: lgs.camera,
            requestFrame: callback => __.requestAnimationFrame(callback),
            cancelFrame: frameId => __.cancelAnimationFrame(frameId),
            onUpdate: () => void tick(),
        })

        return () => {
            cancelled = true
            removeProjectionUpdates?.()
        }
    }, [
                  hasPOI,
                  hasCoordinates,
                  thePOI?.id,
                  thePOI?.longitude,
                  thePOI?.latitude,
                  thePOI?.height,
                  thePOI?.simulatedHeight,
                  thePOI?.visible,
                  thePOI?.tooClose,
                  replayActive,
                  replaySettings.visible,
                  shouldProjectForHover,
                  $list,
                  thePOI,
                  point,
              ])

    if (!hasPOI || !hasCoordinates) {
        return null
    }

    return (
        <>
            {pixels && hoverPreviewActive && !tooFar && presentation.visible &&
                <div
                    className="poi-screen-wrapper"
                    id={thePOI.id}
                    style={{
                        position:                     'absolute',
                        pointerEvents:                 'none',
                        bottom:                       window.innerHeight - pixels.y,
                        left:                         pixels.x,
                        transform: `translate( -50%,calc(-4 * var(--poi-border-width))) scale(${scale ?? 1})`,
                        transformOrigin:              'center bottom',
                        '--lgs-poi-background-color': thePOI.background === false ? 'transparent' : thePOI.bgColor ?? lgs.colors.poiDefaultBackground,
                        '--lgs-poi-border-color':     thePOI.borderColor ?? thePOI.color ?? lgs.colors.poiDefault,
                        '--lgs-poi-color':            thePOI.color ?? lgs.colors.poiDefault,
                        zIndex:                       viewable.get(thePOI.id),
                    }}
                >
                    <MapPOIContent
                        poi={thePOI.id}
                        domPreview
                        style={{
                            position: 'relative',
                            top: 0,
                            left: 0,
                            transform: 'none',
                            pointerEvents: 'none',
                            '--poi-expanded-dimension': `${thePOI.display?.maxWidth ?? 200}px`,
                        }}
                    />
                </div>
            }
            {pixels && hoverTitleActive && !thePOI.expanded && !tooFar && presentation.visible &&
                <MapOverlaySurface
                    className="poi-map-overlay-details"
                    role="tooltip"
                    style={{
                        position: 'absolute',
                        bottom: window.innerHeight - pixels.y + 17 * (scale ?? 1),
                        left: pixels.x,
                        transform: 'translate(-50%, calc(-100% - var(--lgs-gutter-xs)))',
                        zIndex: viewable.get(thePOI.id),
                    }}
                >
                    {thePOI.title?.trim() || 'Point Of Interest'}
                </MapOverlaySurface>
            }
        </>
    )
})
