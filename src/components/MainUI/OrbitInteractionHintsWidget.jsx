/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: OrbitInteractionHintsWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Widget }                                         from '@Components/MainUI/widgets/Widget'
import { LGS_WIDGET, SCENE_WIDGETS, SCENE_WIDGETS_BOARD } from '@Core/constants'
import { WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useEffect, useMemo, useState }             from 'react'
import { useSnapshot }                                    from 'valtio'

export const ORBIT_INTERACTION_HINTS_WIDGET = 'orbit-interaction-hints-widget'

const SHORTCUT_ICONS = {
    cameraRotate:    'camera-rotate',
    command:         'command',
    mouseButtonLeft: 'computer-mouse-button-left',
    scrollwheel:     'computer-mouse-scrollwheel',
    sliders:         'sliders',
}

const hasFinePointer = () => typeof window !== 'undefined' && (window.matchMedia?.('(any-pointer: fine)').matches ?? false)
const isAppleOS = () => {
    if (typeof navigator === 'undefined') {
        return false
    }

    const platform = navigator.userAgentData?.platform ?? navigator.platform ?? ''
    return /mac|iphone|ipad|ipod/i.test(platform)
        || (/mac/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
}

const Icon = ({icon, className = 'orbit-shortcut-icon'}) => (
    <WaIcon className={className} name={icon} variant="regular"/>
)

const KeyTag = ({children, icon = null}) => (
    <span className="orbit-key-tag">
        {icon && <Icon className="orbit-shortcut-key-icon" icon={icon}/>}
        {children}
    </span>
)

const Gesture = ({icon, label}) => (
    <span className="orbit-shortcut-gesture">
        <Icon icon={icon}/>
        <span>{label}</span>
    </span>
)

const Shortcut = ({gesture, action}) => (
    <span className="orbit-shortcut-row">
        <span className="orbit-shortcut-combo">{gesture}</span>
        <span className="orbit-shortcut-label">{action}</span>
    </span>
)

const Plus = () => <span className="orbit-shortcut-plus">{'+'}</span>

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
        draggable: true,
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

    const appleOS = useMemo(() => isAppleOS(), [])
    const altKey = useMemo(() => appleOS ? <KeyTag icon={SHORTCUT_ICONS.command}>{'Command'}</KeyTag> :
                                 <KeyTag>{'Alt'}</KeyTag>, [appleOS])
    const distanceGesture = useMemo(() => (
        <Gesture
            icon={SHORTCUT_ICONS.scrollwheel}
            label={appleOS ? 'Trackpad scroll' : 'Wheel'}
        />
    ), [appleOS])

    if (!active || !widgetList.has(ORBIT_INTERACTION_HINTS_WIDGET)) {
        return null
    }

    return (
        <Widget isVisible={true} config={config} className="orbit-interaction-hints-shell">
            <div className="orbit-interaction-hints lgs-card wa-theme-lgs1920-on-map">
                {panorama.active ? (
                    finePointer ? (
                        <>
                            <Shortcut
                                gesture={<Gesture icon={SHORTCUT_ICONS.scrollwheel} label="Wheel / trackpad"/>}
                                action="Height"
                            />
                            <Shortcut
                                gesture={<>{altKey}<Plus/><Gesture icon={SHORTCUT_ICONS.mouseButtonLeft}
                                                                   label="Drag"/></>}
                                action="Height"
                            />
                            <Shortcut
                                gesture={<Gesture icon={SHORTCUT_ICONS.mouseButtonLeft} label="Vertical drag"/>}
                                action="Angle"
                            />
                        </>
                    ) : (
                        <>
                            <Shortcut
                                gesture={<Gesture icon={SHORTCUT_ICONS.sliders} label="Sliders"/>}
                                action="Height / angle"
                            />
                            <Shortcut
                                gesture={<Gesture icon={SHORTCUT_ICONS.cameraRotate} label="Sliders"/>}
                                action="RPM / sense"
                            />
                        </>
                    )
                ) : (
                     <>
                         <Shortcut
                             gesture={<Gesture icon={SHORTCUT_ICONS.mouseButtonLeft} label="Drag"/>}
                             action="Orbit"
                         />
                         <Shortcut
                             gesture={distanceGesture}
                             action="Distance"
                         />
                     </>
                 )}
            </div>
        </Widget>
    )
})
