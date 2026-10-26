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
 * Last modified: 2026-10-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { MapPOIContent }                   from '@Components/MainUI/MapPOI/MapPOIContent'
import {
    normalizeJourneyReplayPOISettings, resolveReplayPOIPresentation,
} from '@Core/ui/replay/JourneyReplayPOISettings'
import {
    clearPOIHoverPreview, getPOIHoverPreview, setPOIHoverPreviewPosition, subscribeToPOIHoverPreview,
} from '@Components/MainUI/MapPOI/poiHoverPreviewStore'
import { POIUtils }                                       from '@Utils/cesium/POIUtils'
import { memo, useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useSnapshot }                                    from 'valtio'
import { proxy }                           from 'valtio'

const EMPTY_REPLAY_PROXY = proxy({nearbyPois: []})

export const MapPOI = memo(({point}) => {

    const $list = lgs.stores.main.components.pois.list
    const list = useSnapshot($list)
    const thePOI = list.get(point) // Récupère les informations du POI
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
    const replayEntry = Array.isArray(replay.nearbyPois)
                            ? replay.nearbyPois.find(entry => entry?.poi?.id === thePOI?.id)
                            : null
    const presentation = resolveReplayPOIPresentation(thePOI, {replay})
    const replayActive = presentation.active
    const replaySettings = normalizeJourneyReplayPOISettings(thePOI?.replay)

    useEffect(() => {
        if (hoverPreviewActive && (thePOI?.expanded || tooFar || !presentation.visible)) {
            clearPOIHoverPreview(thePOI.id)
        }
    }, [hoverPreviewActive, presentation.visible, thePOI?.expanded, thePOI?.id, tooFar])
    useEffect(() => {
        let cancelled = false
        let rafId = null

        const tick = async () => {
            if (cancelled || !hasPOI || !hasCoordinates) {
                setPixels(null)
                clearPOIHoverPreview(point)
                return
            }

            const currentPOI = list.get(point)
            if (!currentPOI?.id || !Number.isFinite(currentPOI.latitude) || !Number.isFinite(currentPOI.longitude)) {
                setPixels(null)
                clearPOIHoverPreview(point)
                return
            }

            const coords = await __.ui.sceneManager.degreesToPixelsCoordinates(currentPOI, true)
            if (cancelled) {
                return
            }

            if (coords?.visible) {
                setPixels({x: coords.x, y: coords.y})
                setPOIHoverPreviewPosition(currentPOI.id, coords.x, window.innerHeight - coords.y)
            }
            else {
                setPixels(null)
                clearPOIHoverPreview(currentPOI.id)
            }

            const scaleInfo = POIUtils.adaptScaleToDistance(currentPOI)
            setScale(scaleInfo.scale)
            setTooFar(scaleInfo.tooFar)

            rafId = __.requestAnimationFrame(tick)
        }

        void tick()

        return () => {
            cancelled = true
            if (rafId) {
                __.cancelAnimationFrame(rafId)
            }
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
                  replayEntry?.poi?.id,
                  replaySettings.visible,
                  list,
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
                        '--lgs-poi-background-color': thePOI.noBackground ? 'transparent' : thePOI.bgColor ?? lgs.colors.poiDefaultBackground,
                        '--lgs-poi-border-color':     thePOI.color ?? lgs.colors.poiDefault,
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
        </>
    )
})
