/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOI.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-28
 * Last modified: 2026-02-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { MapPOIContent }                                  from '@Components/MainUI/MapPOI/MapPOIContent'
import { POIUtils }                                       from '@Utils/cesium/POIUtils'
import classNames                                         from 'classnames'
import { memo, useEffect, useRef, useState } from 'react'
import { useSnapshot }                                    from 'valtio'

export const MapPOI = memo(({point}) => {

    const $list = lgs.stores.main.components.pois.list
    const list = useSnapshot($list)
    const thePOI = list.get(point) // Récupère les informations du POI
    const viewable = useSnapshot(lgs.stores.main.components.pois.visibleList)

    if (!thePOI || !thePOI.latitude || !thePOI.longitude) {
        return null
    }

    const _poi = useRef(null)
    const [pixels, setPixels] = useState(null)
    const [scale, setScale] = useState(1)
    const [tooFar, setTooFar] = useState(false)

    useEffect(() => {
        let cancelled = false
        let rafId = null

        const tick = async () => {
            if (cancelled) {
                return
            }

            const coords = await __.ui.sceneManager.degreesToPixelsCoordinates(thePOI, true)
            if (cancelled) {
                return
            }

            if (coords?.visible) {
                setPixels({x: coords.x, y: coords.y})
            }
            else {
                setPixels(null)
            }

            const scaleInfo = POIUtils.adaptScaleToDistance(thePOI)
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
                  thePOI?.longitude,
                  thePOI?.latitude,
                  thePOI?.height,
                  thePOI?.simulatedHeight,
                  thePOI?.visible,
              ])

    const hideMenu = (event) => {
        lgs.stores.main.components.pois.context.visible = false
        if (event) {
            __.ui.sceneManager.propagateEventToCanvas(event)
        }
    }
    console.log(pixels, thePOI)
    return (
        <>
            {pixels &&
                <div
                    className={classNames(
                        'poi-icon-wrapper',
                        'lgs-slide-in-from-top-bounced',
                        thePOI?.expanded ? 'poi-shrinked' : '',
                    )}
                    ref={_poi}
                    id={thePOI.id}
                    style={{
                        bottom:                       window.innerHeight - pixels.y,
                        left:                         pixels.x,
                        transform: `translate( -50%,calc(-4 * var(--poi-border-width))) scale(${scale ?? 1})`,
                        transformOrigin:              'center bottom',
                        '--lgs-poi-background-color': thePOI.bgColor ?? lgs.colors.poiDefaultBackground,
                        '--lgs-poi-border-color':     thePOI.color ?? lgs.colors.poiDefault,
                        '--lgs-poi-color':            thePOI.color ?? lgs.colors.poiDefault,
                        zIndex:                       viewable.get(thePOI.id),
                    }}
                    onPointerMove={__.ui.sceneManager.propagateEventToCanvas}
                    onWheel={hideMenu}
                >
                    {thePOI.visible && !tooFar &&
                        <MapPOIContent poi={thePOI.id} hide={hideMenu}/>
                    }
                </div>
            }
        </>
    )
})
