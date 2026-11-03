/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditMenu.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-02-22
 * Last modified: 2026-11-03
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
    CURRENT_POI, POI_FLAG_START, POI_FLAG_STOP, POI_STARTER_TYPE, SCENE_MODE_2D,
}                                                      from '@Core/constants'
import { UI_ACTIONS }                                  from '@Core/ui/metadata/uiActionCatalog'
import {
    DEFAULT_PANORAMA_HEIGHT_OFFSET, DEFAULT_PANORAMA_PITCH, getOrbitSettings, setOrbitStoreSettings,
}                                                       from '@Core/OrbitSettings'

import { UIToast }                                     from '@Utils/UIToast'
import { WaButton, WaDivider, WaDropdown, WaDropdownItem, WaIcon } from '@awesome.me/webawesome/dist/react'
import { memo, useMemo, useCallback } from 'react'
import { proxy, useSnapshot } from 'valtio'

const EMPTY_POI_PROXY = proxy({})

export const MapPOIEditMenu = memo(({poiId}) => {
    const $pois = lgs.stores.main.components.pois
    const rotateState = useSnapshot(lgs.stores.ui.mainUI.rotate)
    const sceneMode = useSnapshot(lgs.settings.scene.mode)
    const panoramaAllowed = Number(sceneMode.value) !== Number(SCENE_MODE_2D.value)

    /**
     * Subscribe to POI proxy directly so property changes (visible/animated/etc.)
     * trigger UI updates without relying on list-level epoch changes.
     */
    const $point = $pois.list.get(poiId)
    const pointSnap = useSnapshot($point ?? EMPTY_POI_PROXY)
    const pointAvailable = Boolean(pointSnap && $point)

    const isVisible = pointSnap.visible ?? true
    const isPOIRotating = useMemo(
        () => __.ui.poiManager.isPOIRotating(pointSnap.id),
        [pointSnap.id, rotateState.running, rotateState.target?.element, rotateState.target?.slug, rotateState.target?.id],
    )
    const panoramaState = useSnapshot(lgs.stores.ui.mainUI.panorama)
    const isPOIPanoramic = panoramaState.active
        && panoramaState.target?.element === CURRENT_POI
        && (panoramaState.target?.slug ?? panoramaState.target?.id) === pointSnap.id
    const stopOrbit = useCallback(async () => {
        await __.ui.poiManager.stopRotationAndSync()
    }, [])

    /**
     * Toggles visibility and prevents event bubbling to avoid SlDetails toggling
     */
    const toggleVisibility = useCallback(async (e) => {
        e?.preventDefault()
        e?.stopPropagation()

        const nextState = !isVisible
        await __.ui.poiManager.updatePOI(pointSnap.id, {visible: nextState}, {markAsEdited: true})
    }, [pointSnap.id, isVisible])

    const focus = useCallback(async (e) => {
        e?.stopPropagation()
        $pois.current = pointSnap.id
        await __.ui.poiManager.focusPOI(pointSnap.id, {flyingTime: 2})
    }, [pointSnap.id, $pois])

    const orbitAround = useCallback(async (e) => {
        e?.stopPropagation()
        $pois.current = pointSnap.id
        await __.ui.poiManager.rotateAroundPOI(pointSnap.id)
    }, [pointSnap.id, $pois])

    const startPanoramic = useCallback(async (e) => {
        e?.stopPropagation()
        if (!panoramaAllowed) {
            return
        }

        if (__.ui.cameraManager.isRotating()) {
            await __.ui.poiManager.stopRotationAndSync()
        }
        const storedPanorama = {
            ...(pointSnap.panorama ?? {}),
            ...getOrbitSettings(pointSnap, 'panorama', panoramaState),
        }
        const panorama = lgs.stores.ui.mainUI.panorama
        panorama.target = {
            ...pointSnap,
            element: CURRENT_POI,
            slug:    pointSnap.slug ?? pointSnap.id,
        }
        panorama.visible = true
        panorama.heading = lgs.stores.main.components.camera.position.heading ?? 0
        panorama.pitch = storedPanorama.pitch ?? DEFAULT_PANORAMA_PITCH
        panorama.heightOffset = storedPanorama.heightOffset ?? DEFAULT_PANORAMA_HEIGHT_OFFSET
        setOrbitStoreSettings(panorama, storedPanorama)
        panorama.active = true
    }, [panoramaAllowed, panoramaState, pointSnap])

    const stopPanoramic = useCallback((e) => {
        e?.stopPropagation()
        void __.ui.poiManager.stopRotationAndSync()
    }, [])

    const copyCoordinates = useCallback((e) => {
        e?.stopPropagation()
        __.ui.poiManager.copyCoordinatesToClipboard($point).then(() => {
            UIToast.success({caption: pointSnap.title, text: 'Coordinates copied to clipboard'})
        })
    }, [$point, pointSnap.title])

    const remove = useCallback(async (e) => {
        e?.stopPropagation()
        if (__.ui.cameraManager.isRotating()) {
            await stopOrbit()
        }
        __.ui.poiManager.remove({id: pointSnap.id}).then((result) => {
            if (result.success) {
                $pois.filtered.global.delete(result.id)
                $pois.bulkList.delete(result.id)
                $pois.current = false
            }
        })
    }, [pointSnap.id, $pois, stopOrbit])

    const menuItems = useMemo(() => {
        if (!pointAvailable || !isVisible) {
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
                    <WaIcon slot="icon" {...UI_ACTIONS.remove.icon}/>
                    <span>{UI_ACTIONS.remove.label}</span>
                </WaDropdownItem>,
            )
        }

        items.push(
            <WaDropdownItem key="copy-coords" onClick={copyCoordinates}>
                <WaIcon slot="icon" {...UI_ACTIONS.copyCoordinates.icon}/>
                <span>{UI_ACTIONS.copyCoordinates.label}</span>
            </WaDropdownItem>,
            <WaDropdownItem key="toggle-exp"
                        onClick={() => __.ui.poiManager.updatePOI(pointSnap.id, {expanded: !pointSnap.expanded})}>
                <WaIcon slot="icon" {...(pointSnap.expanded ? UI_ACTIONS.reduce.icon : UI_ACTIONS.expand.icon)}/>
                <span>{pointSnap.expanded ? UI_ACTIONS.reduce.label : UI_ACTIONS.expand.label}</span>
            </WaDropdownItem>,
            <WaDropdownItem key="hide" onClick={toggleVisibility}>
                <WaIcon slot="icon" {...UI_ACTIONS.hidePOIs.icon}/>
                <span>{UI_ACTIONS.hidePOIs.label}</span>
            </WaDropdownItem>,
            <WaDivider key="div-1"/>,
        )

        if (isPOIRotating || isPOIPanoramic) {
            items.push(
                <WaDropdownItem key="stop-rot" onClick={isPOIPanoramic ? stopPanoramic : stopOrbit}>
                    <WaIcon slot="icon" {...UI_ACTIONS.stopMotion.icon}/>
                    <span>{`${UI_ACTIONS.stopMotion.label} ${isPOIPanoramic ? 'Panorama' : 'Orbit'}`}</span>
                </WaDropdownItem>,
            )
        }
        else {
            items.push(
                <WaDropdownItem key="rot-around" onClick={orbitAround}>
                    <WaIcon slot="icon" {...UI_ACTIONS.orbit.icon}/>
                    <span>{UI_ACTIONS.orbit.label}</span>
                </WaDropdownItem>,
            )

            if (panoramaAllowed) {
                items.push(
                    <WaDropdownItem key="rot-panorama" onClick={startPanoramic}>
                        <WaIcon slot="icon" {...UI_ACTIONS.panoramic.icon}/>
                        <span>{UI_ACTIONS.panoramic.label}</span>
                    </WaDropdownItem>,
                )
            }
        }

        return items
    }, [pointAvailable, pointSnap, isPOIRotating, isPOIPanoramic, isVisible, focus, remove, orbitAround, stopOrbit, stopPanoramic, copyCoordinates, toggleVisibility, startPanoramic, panoramaAllowed])

    /**
     * UI BRANCHING:
     * If hidden -> Single Button
     * If visible -> Dropdown Menu
     */
    if (!pointAvailable) {
        return null
    }

    return (
        <div className="poi-edit-menu-container">
            {!isVisible ? (
                <WaButton size="s" onClick={toggleVisibility} variant="brand">
                    <WaIcon slot="start" size={'small'} {...UI_ACTIONS.show.icon}/>{UI_ACTIONS.show.label}
                </WaButton>
            ) : (
                 <WaDropdown className="edit-poi-menu" size="s" variant="brand">
                     <WaButton slot="trigger" withCaret size="s" variant="brand">
                         <WaIcon slot="start" {...UI_ACTIONS.selectAction.icon}/>{UI_ACTIONS.selectAction.label}
                     </WaButton>
                     {menuItems}
                 </WaDropdown>
             )}
        </div>
    )
})
