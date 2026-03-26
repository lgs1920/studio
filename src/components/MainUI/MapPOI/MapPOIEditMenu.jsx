/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditMenu.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-26
 * Last modified: 2026-03-26
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
    POI_FLAG_START, POI_FLAG_STOP, POI_STARTER_TYPE,
}                                                      from '@Core/constants'

import { UIToast }                                     from '@Utils/UIToast'
import { WaButton, WaDivider, WaDropdown, WaDropdownItem, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import React, { memo, useMemo, useCallback } from 'react'
import { useSnapshot }                                 from 'valtio'


export const MapPOIEditMenu = memo(({poiId}) => {
    const $pois = lgs.stores.main.components.pois
    const rotateState = useSnapshot(lgs.stores.ui.mainUI.rotate)

    /**
     * Subscribe to POI proxy directly so property changes (visible/animated/etc.)
     * trigger UI updates without relying on list-level epoch changes.
     */
    const $point = $pois.list.get(poiId)
    const pointSnap = useSnapshot($point || {})

    if (!pointSnap || !$point) {
        return null
    }

    const isVisible = pointSnap.visible ?? true
    const isPOIRotating = useMemo(
        () => __.ui.poiManager.isPOIRotating(pointSnap.id),
        [pointSnap.id, rotateState.running, rotateState.target?.element, rotateState.target?.slug, rotateState.target?.id],
    )

    const stopRotation = useCallback(async () => {
        await __.ui.poiManager.stopRotationAndSync()
    }, [])

    /**
     * Toggles visibility and prevents event bubbling to avoid SlDetails toggling
     */
    const toggleVisibility = useCallback(async (e) => {
        e?.preventDefault()
        e?.stopPropagation()

        const nextState = !isVisible
        await __.ui.poiManager.updatePOI(pointSnap.id, {visible: nextState})
    }, [pointSnap.id, isVisible])

    const focus = useCallback(async (e) => {
        e?.stopPropagation()
        $pois.current = pointSnap.id
        await __.ui.poiManager.focusPOI(pointSnap.id, {flyingTime: 2})
    }, [pointSnap.id, $pois])

    const rotationAround = useCallback(async (e) => {
        e?.stopPropagation()
        $pois.current = pointSnap.id
        await __.ui.poiManager.rotateAroundPOI(pointSnap.id)
    }, [pointSnap.id, $pois])

    const startPanoramic = useCallback(async (e) => {
        e?.stopPropagation()
        await __.ui.poiManager.stopRotationAndSync()
        await __.ui.poiManager.updatePOI(pointSnap.id, {animated: false})
        __.ui.cameraManager.panoramic()
    }, [pointSnap.id])

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
                <WaIcon slot="icon" name={'crosshairs-simple'}/>
                <span>{'Focus'}</span>
            </WaDropdownItem>,
        )

        if (pointSnap.type !== POI_STARTER_TYPE && pointSnap.type !== POI_FLAG_START && pointSnap.type !== POI_FLAG_STOP) {
            items.push(
                <WaDropdownItem key="remove" onClick={remove}>
                    <WaIcon slot="icon" name={'trash-can'}/>
                    <span>{'Remove'}</span>
                </WaDropdownItem>,
            )
        }

        items.push(
            <WaDropdownItem key="copy-coords" onClick={copyCoordinates}>
                <WaIcon slot="icon" name={'copy'}/>
                <span>{'Copy Coords'}</span>
            </WaDropdownItem>,
            <WaDropdownItem key="toggle-exp"
                        onClick={() => __.ui.poiManager.updatePOI(pointSnap.id, {expanded: !pointSnap.expanded})}>
                <WaIcon slot="icon" name={pointSnap.expanded ? 'arrows-to-line' : 'arrows-from-line'}/>
                <span>{pointSnap.expanded ? 'Reduce' : 'Expand'}</span>
            </WaDropdownItem>,
            <WaDropdownItem key="hide" onClick={toggleVisibility}>
                <WaIcon slot="icon" name={'eye-slash'}/>
                <span>{'Hide'}</span>
            </WaDropdownItem>,
            <WaDivider key="div-1"/>,
        )

        if (isPOIRotating) {
            items.push(
                <WaDropdownItem key="stop-rot" onClick={stopRotation}>
                    <WaIcon slot="icon" name={'arrow-rotate-right'}/>
                    <span>{'Stop Rotation'}</span>
                </WaDropdownItem>,
            )
        }
        else {
            items.push(
                <WaDropdownItem key="rot-around" onClick={rotationAround}>
                    <WaIcon slot="icon" name={'arrow-rotate-right'}/>
                    <span>{'Rotate Around'}</span>
                </WaDropdownItem>,
            )

            items.push(
                <WaDropdownItem key="rot-panorama" onClick={startPanoramic}>
                    <WaIcon slot="icon" name={'panorama'}/>
                    <span>{'Panoramic'}</span>
                </WaDropdownItem>,
            )
        }

        return items
    }, [pointSnap, isPOIRotating, isVisible, focus, remove, rotationAround, stopRotation, copyCoordinates, toggleVisibility, startPanoramic])

    /**
     * UI BRANCHING:
     * If hidden -> Single Button
     * If visible -> Dropdown Menu
     */
    return (
        <div className="poi-edit-menu-container">
            {!isVisible ? (
                <WaButton size="small" onClick={toggleVisibility} variant="brand">
                    <WaIcon slot="start" size={'small'} name={'eye'} variant="regular"/>{'Show'}
                </WaButton>
            ) : (
                 <WaDropdown className="edit-poi-menu" size="small" variant="brand">
                     <WaButton slot="trigger" withCaret size="small" variant="brand">
                         <WaIcon slot="start" variant="regular" name="location-dot"/>{'Select an action'}
                     </WaButton>
                     {menuItems}
                 </WaDropdown>
             )}
        </div>
    )
})
