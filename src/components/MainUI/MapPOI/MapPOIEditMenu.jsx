/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditMenu.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-22
 * Last modified: 2026-03-22
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

import { UIToast }                                     from '@Utils/UIToast'
import { WaButton, WaDivider, WaDropdown, WaDropdownItem, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import React, { memo, useMemo, useCallback, useState } from 'react'
import { useSnapshot }                                 from 'valtio'


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

        $point.visible = nextState
        if (nextState) {
            $point.show()
        }
        else {
            $point.hide()
        }

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
            <WaDropdownItem key="focus" onClick={focus}>
                <WaIcon slot="prefix" name={'crosshairs-simple'}/>
                <span>{'Focus'}</span>
            </WaDropdownItem>,
        )

        if (pointSnap.type !== POI_STARTER_TYPE && pointSnap.type !== POI_FLAG_START && pointSnap.type !== POI_FLAG_STOP) {
            items.push(
                <WaDropdownItem key="remove" onClick={remove}>
                    <WaIcon slot="prefix" name={'trash-can'}/>
                    <span>{'Remove'}</span>
                </WaDropdownItem>,
            )
        }

        items.push(
            <WaDropdownItem key="copy-coords" onClick={copyCoordinates}>
                <WaIcon slot="prefix" name={'copy'}/>
                <span>{'Copy Coords'}</span>
            </WaDropdownItem>,
            <WaDropdownItem key="toggle-exp"
                        onClick={() => __.ui.poiManager.updatePOI(pointSnap.id, {expanded: !pointSnap.expanded})}>
                <WaIcon slot="prefix" name={pointSnap.expanded ? 'arrows-to-line' : 'arrows-from-line'}/>
                <span>{pointSnap.expanded ? 'Reduce' : 'Expand'}</span>
            </WaDropdownItem>,
            <WaDropdownItem key="hide" onClick={toggleVisibility}>
                <WaIcon slot="prefix" name={'eye-slash'}/>
                <span>{'Hide'}</span>
            </WaDropdownItem>,
            <WaDivider key="div-1"/>,
        )

        if (!isAnimated) {
            items.push(
                <WaDropdownItem key="rot-around" onClick={rotationAround}>
                    <WaIcon slot="prefix" name={'arrow-rotate-right'}/>
                    <span>{'Rotate Around'}</span>
                </WaDropdownItem>,
            )

            items.push(
                <WaDropdownItem key="rot-panorama" onClick={stopRotation}>
                    <WaIcon slot="prefix" name={'panorama'}/>
                    <span>{'Panoramic'}</span>
                </WaDropdownItem>,
            )
        }
        else if (isCurrent) {
            items.push(
                <WaDropdownItem key="stop-rot" onClick={stopRotation}>
                    <WaIcon slot="prefix" name={'arrow-rotate-right'}/>
                    <span>{'Stop Rotation'}</span>
                </WaDropdownItem>,
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
                <WaButton size="small" onClick={toggleVisibility} variant="brand">
                    <WaIcon slot="prefix" size={'small'} name={'eye'}/>{'Show'}
                </WaButton>
            ) : (
                 <WaDropdown className="edit-poi-menu" size="small">
                     <WaButton slot="trigger" withcaret variant="brand">
                         <WaIcon slot="start" variant="regular" name="location-dot"/>{'Select an action'}
                     </WaButton>
                     {menuItems}
                 </WaDropdown>
             )}
        </div>
    )
})
