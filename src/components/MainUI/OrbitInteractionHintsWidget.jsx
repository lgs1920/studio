/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: OrbitInteractionHintsWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-29
 * Last modified: 2026-04-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Widget }                                         from '@Components/MainUI/widgets/Widget'
import { LGS_WIDGET, SCENE_WIDGETS, SCENE_WIDGETS_BOARD } from '@Core/constants'
import { memo, useEffect, useMemo, useState }             from 'react'
import { useSnapshot }                                    from 'valtio'

export const ORBIT_INTERACTION_HINTS_WIDGET = 'orbit-interaction-hints-widget'

const hasFinePointer = () => typeof window !== 'undefined' && (window.matchMedia?.('(any-pointer: fine)').matches ?? false)

export const OrbitInteractionHintsWidget = memo(() => {
    const rotate = useSnapshot(lgs.stores.ui.mainUI.rotate)
    const panorama = useSnapshot(lgs.stores.ui.mainUI.panorama)
    const widgetList = useSnapshot(lgs.stores.ui.widget.list)
    const [finePointer, setFinePointer] = useState(hasFinePointer)
    const active = rotate.running || panorama.active

    useEffect(() => {
        const mediaQuery = window.matchMedia?.('(any-pointer: fine)')
        if (!mediaQuery) {
            return
        }

        const updatePointerMode = () => setFinePointer(mediaQuery.matches)
        updatePointerMode()
        mediaQuery.addEventListener('change', updatePointerMode)

        return () => mediaQuery.removeEventListener('change', updatePointerMode)
    }, [])

    useEffect(() => {
        if (!active || lgs.stores.ui.widget.list.has(ORBIT_INTERACTION_HINTS_WIDGET)) {
            return
        }

        lgs.stores.ui.widget.list.set(ORBIT_INTERACTION_HINTS_WIDGET, {
            widgetsBoard: SCENE_WIDGETS_BOARD,
            zIndex:       11850,
        })
    }, [active])

    const config = useMemo(() => ({
        attachTo:        'bottom-left',
        contextMenu:     {
            canRemove: true,
        },
        draggable:       false,
        dynamic:         true,
        group:           SCENE_WIDGETS,
        id:              ORBIT_INTERACTION_HINTS_WIDGET,
        left:            '0px',
        margin:          lgs.gutter.s,
        opacity:         1,
        persist:         false,
        resizable:       false,
        rotatable:       false,
        scalable:        false,
        showControlBox:  false,
        snappable:       false,
        stopPropagation: true,
        top:             '100%',
        transient:       true,
        type:            LGS_WIDGET,
        widgetsBoard:    SCENE_WIDGETS_BOARD,
        zIndex:          11850,
    }), [])

    if (!active || !widgetList.has(ORBIT_INTERACTION_HINTS_WIDGET)) {
        return null
    }

    return (
        <Widget isVisible={true} config={config} className="orbit-interaction-hints-shell">
            <div className="orbit-interaction-hints lgs-card wa-theme-lgs1920-on-map">
                {panorama.active ? (
                    finePointer ? (
                        <>
                            <span>{'Drag vertical: angle'}</span>
                            <span>{'Wheel/trackpad: height'}</span>
                            <span>{'Alt/Option + drag: height'}</span>
                        </>
                    ) : (
                        <>
                            <span>{'Sliders: height / angle'}</span>
                            <span>{'RPM / sense stay available'}</span>
                        </>
                    )
                ) : (
                     <>
                         <span>{'Sliders: RPM / sense'}</span>
                         <span>{'Stop: close rotation'}</span>
                     </>
                 )}
            </div>
        </Widget>
    )
})
