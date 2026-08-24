/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: GeocodingWidget.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-01
 * Last modified: 2026-05-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { GeocodingUI }                                    from '@Components/MainUI/geocoding/GeocodingUI'
import { Widget }                                         from '@Components/MainUI/widgets/Widget'
import { LGS_WIDGET, SCENE_WIDGETS, SCENE_WIDGETS_BOARD } from '@Core/constants'
import { useMemo }                                        from 'react'

export const GeocodingWidget = () => {
    const config = useMemo(() => {
        const trigger = document.getElementById('launch-the-geocoder')
        const rect = trigger?.getBoundingClientRect?.()
        const containerRect = lgs.canvas?.getBoundingClientRect?.()
        const margin = lgs.gutter.s ?? 8
        const gap = lgs.gutter.s ?? 8
        const viewportWidth = containerRect?.width ?? window.innerWidth
        const viewportHeight = containerRect?.height ?? window.innerHeight
        const centerOnMobile = __.device.isMobile || viewportWidth <= 767
        const dialogWidth = Math.min(viewportWidth - 2 * margin, 560)
        const triggerCenter = rect
                              ? ((rect.left + rect.right) / 2) - (containerRect?.left ?? 0)
                              : viewportWidth / 2
        const openToRight = triggerCenter < viewportWidth / 2
        const relativeLeft = rect
                             ? ((openToRight ? rect.right : rect.left) + (openToRight ? gap : -gap)) - (containerRect?.left ?? 0)
                             : (openToRight ? margin : viewportWidth - margin)
        const relativeTop = rect
                            ? rect.top - (containerRect?.top ?? 0)
                            : margin

        let left = relativeLeft
        const top = Math.max(margin, Math.min(relativeTop, viewportHeight - margin))

        if (centerOnMobile) {
            left = viewportWidth / 2
        }
        else if (openToRight) {
            left = Math.min(left, viewportWidth - dialogWidth - margin)
        }
        else {
            left = Math.max(left, dialogWidth + margin)
        }

        return {
            contextMenu:     {
                canEdit:     false,
                canRemove:   false,
                canReset:    false,
                canPosition: false,
                canMaximize: false,
            },
            top:             `${Math.round(top)}px`,
            left:            `${Math.round(left)}px`,
            attachTo: centerOnMobile ? 'top' : (openToRight ? 'top-left' : 'top-right'),
            margin:          lgs.gutter?.xs ?? 5,
            type:            LGS_WIDGET,
            group:           SCENE_WIDGETS,
            id:              'geocoding-widget',
            draggable:       true,
            resizable:       false,
            scalable:        false,
            rotatable:       false,
            snappable:       false,
            persist:         false,
            transient:       true,
            dynamic:         true,
            mandatory:       false,
            stopPropagation: true,
            widgetsBoard:    SCENE_WIDGETS_BOARD,
            min:             {width: 320, height: 160},
            max:             {width: 560, height: 800},
            zIndex:          12000,
        }
    }, [])

    return (
        <Widget isVisible={true} config={config} className="geocoding-widget-shell">
            <GeocodingUI/>
        </Widget>
    )
}
