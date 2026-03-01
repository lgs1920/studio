/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditMenu.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-01
 * Last modified: 2026-03-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditMenu.jsx
 ******************************************************************************/

import {
    POI_FLAG_START, POI_FLAG_STOP, POI_STANDARD_TYPE, POI_STARTER_TYPE, POI_TMP_TYPE,
}                                                      from '@Core/constants'
import {
    faArrowRotateRight, faArrowsFromLine, faArrowsToLine, faCopy, faCrosshairsSimple, faFlag, faLocationDot, faPanorama,
    faTrashCan, faEye, faEyeSlash,
}                                                      from '@fortawesome/pro-regular-svg-icons'
import {
    SlButton, SlDivider, SlDropdown, SlIcon, SlMenu, SlMenuItem,
}                                                      from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                       from '@Utils/FA2SL'
import { UIToast }                                     from '@Utils/UIToast'
import React, { memo, useMemo, useCallback, useState } from 'react'
import { useSnapshot }                                 from 'valtio'

const ICON_FOCUS = FA2SL.set(faCrosshairsSimple)
const ICON_FLAG = FA2SL.set(faFlag)
const ICON_TRASH = FA2SL.set(faTrashCan)
const ICON_EXPAND = FA2SL.set(faArrowsFromLine)
const ICON_REDUCE = FA2SL.set(faArrowsToLine)
const ICON_MASK = FA2SL.set(faEyeSlash)
const ICON_ROTATE = FA2SL.set(faArrowRotateRight)
const ICON_PANORAMA = FA2SL.set(faPanorama)
const ICON_SHOW = FA2SL.set(faEye)
const ICON_COPY = FA2SL.set(faCopy)
const ICON_LOCATION = FA2SL.set(faLocationDot)

export const MapPOIEditMenu = memo(({poiId}) => {
    const $pois = lgs.stores.main.components.pois
    const $camera = lgs.stores.main.components.camera

    /**
     * Subscribe to POI proxy directly so property changes (visible/animated/etc.)
     * trigger UI updates without relying on list-level epoch changes.
     */
    const poisSnap = useSnapshot($pois, {sync: true})
    const $point = $pois.list.get(poiId)
    const pointSnap = useSnapshot($point || {})

    if (!pointSnap || !$point) {
        return null
    }

    const [isVisible, setIsVisible] = useState(pointSnap.visible ?? true)
    const isAnimated = pointSnap.animated
    const isCurrent = poisSnap.current === pointSnap?.id

    const stopRotation = useCallback(async () => {
        await __.ui.cameraManager.stopRotate()
        $point.animated = false
    }, [$point])

    /**
     * Toggles visibility and prevents event bubbling to avoid SlDetails toggling
     */
    const toggleVisibility = useCallback(async (e) => {
        e?.preventDefault()
        e?.stopPropagation()

        const nextState = !isVisible

        /** Immediate engine feedback */
        if (nextState) {
            $point.visible = true
            $point.show?.()
        }
        else {
            $point.visible = false
            $point.hide?.()
        }

        /** Valtio mutation for UI sync */
        $point.visible = nextState
        setIsVisible(nextState)
        await __.ui.poiManager.updatePOI(pointSnap.id, {visible: nextState})
    }, [pointSnap.id, isVisible, $point])

    const focus = useCallback(async (e) => {
        e?.stopPropagation()
        $pois.current = pointSnap.id
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
        }
        __.ui.sceneManager.focus($point, {
            target:  $point,
            heading: $camera.position.heading,
            pitch:   $camera.position.pitch,
            range:   $camera.position.range,
            flyingTime: 2,
        })
    }, [pointSnap.id, $point, $camera.position, $pois])

    const rotationAround = useCallback(async (e) => {
        e?.stopPropagation()
        $pois.current = pointSnap.id
        if (__.ui.cameraManager.isRotating()) {
            await stopRotation()
        }
        __.ui.sceneManager.focus($point, {
            target:  $point,
            heading: $camera.position.heading,
            pitch:   $camera.position.pitch,
            range:   $camera.position.range,
            infinite:   true,
            rpm:        lgs.settings.ui.poi.rpm,
            rotate:     true,
            flyingTime: 0,
        })
        $point.animated = true
    }, [pointSnap.id, $point, $camera.position, $pois, stopRotation])

    const copyCoordinates = useCallback((e) => {
        e?.stopPropagation()
        __.ui.poiManager.copyCoordinatesToClipboard($point).then(() => {
            UIToast.success({caption: pointSnap.title, text: 'Coordinates copied to clipboard'})
        })
    }, [$point, pointSnap.title])

    const remove = useCallback(async (e) => {
        e?.stopPropagation()
        if (__.ui.cameraManager.isRotating()) {
            await stopRotation()
        }
        __.ui.poiManager.remove({id: pointSnap.id}).then((result) => {
            if (result.success) {
                $pois.filtered.global.delete(result.id)
                $pois.bulkList.delete(result.id)
                $pois.current = false
            }
        })
    }, [pointSnap.id, $pois, stopRotation])

    const menuItems = useMemo(() => {
        if (!isVisible) {
            return []
        }
        const items = []

        items.push(
            <SlMenuItem key="focus" onClick={focus}>
                <SlIcon slot="prefix" library="fa" name={ICON_FOCUS}/>
                <span>{'Focus'}</span>
            </SlMenuItem>,
        )

        if (pointSnap.type !== POI_STARTER_TYPE && pointSnap.type !== POI_FLAG_START && pointSnap.type !== POI_FLAG_STOP) {
            items.push(
                <SlMenuItem key="remove" onClick={remove}>
                    <SlIcon slot="prefix" library="fa" name={ICON_TRASH}/>
                    <span>{'Remove'}</span>
                </SlMenuItem>,
            )
        }

        items.push(
            <SlMenuItem key="copy-coords" onClick={copyCoordinates}>
                <SlIcon slot="prefix" library="fa" name={ICON_COPY}/>
                <span>{'Copy Coords'}</span>
            </SlMenuItem>,
            <SlMenuItem key="toggle-exp"
                        onClick={() => __.ui.poiManager.updatePOI(pointSnap.id, {expanded: !pointSnap.expanded})}>
                <SlIcon slot="prefix" library="fa" name={pointSnap.expanded ? ICON_REDUCE : ICON_EXPAND}/>
                <span>{pointSnap.expanded ? 'Reduce' : 'Expand'}</span>
            </SlMenuItem>,
            <SlMenuItem key="hide" onClick={toggleVisibility}>
                <SlIcon slot="prefix" library="fa" name={ICON_MASK}/>
                <span>{'Hide'}</span>
            </SlMenuItem>,
            <SlDivider key="div-1"/>,
        )

        if (!isAnimated) {
            items.push(
                <SlMenuItem key="rot-around" onClick={rotationAround}>
                    <SlIcon slot="prefix" library="fa" name={ICON_ROTATE}/>
                    <span>{'Rotate Around'}</span>
                </SlMenuItem>,
            )

            items.push(
                <SlMenuItem key="rot-panorama" onClick={stopRotation}>
                    <SlIcon slot="prefix" library="fa" name={ICON_PANORAMA}/>
                    <span>{'Panoramic'}</span>
                </SlMenuItem>,
            )
        }
        else if (isCurrent) {
            items.push(
                <SlMenuItem key="stop-rot" onClick={stopRotation}>
                    <SlIcon slot="prefix" library="fa" name={ICON_ROTATE}/>
                    <span>{'Stop Rotation'}</span>
                </SlMenuItem>,
            )

        }

        return items
    }, [pointSnap, isCurrent, isAnimated, isVisible, focus, remove, rotationAround, stopRotation, copyCoordinates, toggleVisibility])

    /**
     * UI BRANCHING:
     * If hidden -> Single Button
     * If visible -> Dropdown Menu
     */
    return (
        <div
            key={`${pointSnap.id}-${isVisible ? 'visible' : 'hidden'}`}
            className="poi-edit-menu-container"
            onClick={(e) => e.stopPropagation()}
        >
            {!isVisible ? (
                <SlButton size="small" onClick={toggleVisibility}>
                    <SlIcon slot="prefix" size={'small'} library="fa" name={ICON_SHOW}/>{'Show'}
                </SlButton>
            ) : (
                 <SlDropdown className="edit-poi-menu">
                     <SlButton slot="trigger" caret size="small">
                         <SlIcon slot="prefix" size={'small'} library="fa" name={ICON_LOCATION}/>{'Select an action'}
                     </SlButton>
                     <SlMenu>{menuItems}</SlMenu>
                 </SlDropdown>
             )}
        </div>
    )
})
