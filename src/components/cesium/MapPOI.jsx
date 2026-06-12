/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOI.jsx
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

import { MapPOIContent }                   from '@Components/MainUI/MapPOI/MapPOIContent'
import { normalizeFlythroughPOISettings }  from '@Core/ui/flythrough/FlythroughPOISettings'
import { POIUtils }                                       from '@Utils/cesium/POIUtils'
import { memo, useEffect, useRef, useState } from 'react'
import { useSnapshot }                                    from 'valtio'
import { proxy }                           from 'valtio'

const EMPTY_FLYTHROUGH_PROXY = proxy({nearbyPois: []})

export const MapPOI = memo(({point}) => {

    const $list = lgs.stores.main.components.pois.list
    const list = useSnapshot($list)
    const thePOI = list.get(point) // Récupère les informations du POI
    const viewable = useSnapshot(lgs.stores.main.components.pois.visibleList)
    const flythrough = useSnapshot(lgs.stores?.flythrough ?? EMPTY_FLYTHROUGH_PROXY)
    const hasPOI = Boolean(thePOI)
    const hasCoordinates = Number.isFinite(thePOI?.latitude) && Number.isFinite(thePOI?.longitude)

    const _poi = useRef(null)
    const [pixels, setPixels] = useState(null)
    const [scale, setScale] = useState(1)
    const [tooFar, setTooFar] = useState(false)
    const flythroughEntry = Array.isArray(flythrough.nearbyPois)
                            ? flythrough.nearbyPois.find(entry => entry?.poi?.id === thePOI?.id)
                            : null
    const flythroughActive = Boolean(flythrough.active || flythrough.playing || flythrough.paused)
    const flythroughSettings = normalizeFlythroughPOISettings(thePOI?.flythrough)
    const flythroughMasked = thePOI?.visible === false || (flythroughActive && flythroughSettings.visible === false)
    const flythroughScale = flythroughActive && flythroughEntry && !flythroughMasked
                            ? flythroughSettings.scalePercent / 100
                            : 1
    useEffect(() => {
        let cancelled = false
        let rafId = null

        const tick = async () => {
            if (cancelled || !hasPOI || !hasCoordinates) {
                setPixels(null)
                return
            }

            const currentPOI = list.get(point)
            if (!currentPOI?.id || !Number.isFinite(currentPOI.latitude) || !Number.isFinite(currentPOI.longitude)) {
                setPixels(null)
                return
            }

            const coords = await __.ui.sceneManager.degreesToPixelsCoordinates(currentPOI, true)
            if (cancelled) {
                return
            }

            if (coords?.visible) {
                setPixels({x: coords.x, y: coords.y})
            }
            else {
                setPixels(null)
            }

            const scaleInfo = POIUtils.adaptScaleToDistance(currentPOI)
            setScale(scaleInfo.scale)
            setTooFar(scaleInfo.tooFar)

            rafId = __.requestAnimationFrame(tick)
        }

        tick()

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
                  flythroughActive,
                  flythroughEntry?.poi?.id,
                  flythroughSettings.scalePercent,
                  flythroughSettings.visible,
                  list,
                  point,
              ])

    const hideMenu = (event) => {
        lgs.stores.main.components.pois.context.visible = false
        if (event) {
            __.ui.sceneManager.propagateEventToCanvas(event)
        }
    }

    if (!hasPOI || !hasCoordinates) {
        return null
    }

    return (
        <>
            {pixels &&
                <div
                    className="poi-screen-wrapper"
                    ref={_poi}
                    id={thePOI.id}
                    style={{
                        bottom:                       window.innerHeight - pixels.y,
                        left:                         pixels.x,
                        transform: `translate( -50%,calc(-4 * var(--poi-border-width))) scale(${(scale ?? 1) * flythroughScale})`,
                        transformOrigin:              'center bottom',
                        '--lgs-poi-background-color': thePOI.bgColor ?? lgs.colors.poiDefaultBackground,
                        '--lgs-poi-border-color':     thePOI.color ?? lgs.colors.poiDefault,
                        '--lgs-poi-color':            thePOI.color ?? lgs.colors.poiDefault,
                        display:                      flythroughMasked ? 'none' : undefined,
                        zIndex:                       viewable.get(thePOI.id),
                    }}
                    onPointerMove={__.ui.sceneManager.propagateEventToCanvas}
                    onWheel={hideMenu}
                >
                    {thePOI.visible && !tooFar &&
                        <div className="lgs-slide-in-from-top-bounced">
                            <MapPOIContent
                                poi={thePOI.id}
                                flythroughScale={flythroughScale}
                                hide={hideMenu}
                            />
                        </div>
                    }
                </div>
            }
        </>
    )
})
