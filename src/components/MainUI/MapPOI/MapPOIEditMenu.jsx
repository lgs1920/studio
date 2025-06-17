/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditMenu.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-17
 * Last modified: 2025-06-17
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { memo, useCallback, useMemo } from 'react'
import { useSnapshot }                from 'valtio'
import { FontAwesomeIcon }            from '@Components/FontAwesomeIcon'
import { POI_FLAG_START, POI_FLAG_STOP, POI_STARTER_TYPE } from '@Core/constants'
import {
    faArrowRotateRight, faArrowsFromLine, faCrosshairsSimple, faFlag, faLocationDot, faPanorama, faTrashCan, faXmark,
}                                     from '@fortawesome/pro-regular-svg-icons'
import { faMask }                     from '@fortawesome/pro-solid-svg-icons'
import { SlButton, SlDropdown, SlIcon, SlMenu, SlMenuItem } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                      from '@Utils/FA2SL'
import { UIToast }                    from '@Utils/UIToast'
import './style.css'

// Pre-calculated icon names to avoid recalculation
const ICON_CROSSHAIRS = FA2SL.set(faCrosshairsSimple)
const ICON_FLAG = FA2SL.set(faFlag)
const ICON_TRASH = FA2SL.set(faTrashCan)
const ICON_ARROWS = FA2SL.set(faArrowsFromLine)
const ICON_MASK = FA2SL.set(faMask)
const ICON_ROTATE = FA2SL.set(faArrowRotateRight)
const ICON_PANORAMA = FA2SL.set(faPanorama)
const ICON_STOP = FA2SL.set(faXmark)

/**
 * A memoized React component for interacting with Points of Interest (POI) on the map.
 * @param {Object} props - Component props
 * @param {Object} props.point - The POI object to interact with
 * @returns {JSX.Element|null} The rendered dropdown menu or null if no point
 */
export const MapPOIEditMenu = memo(({point}) => {
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    const settings = useSnapshot(lgs.settings.ui.poi)

    // Stabilize point to avoid unnecessary re-renders
    const thePOI = useMemo(() => point, [point.id])

    // Memoized event handlers
    const hide = useCallback(async () => {
        const poi = $pois.list.get(thePOI.id)
        $pois.list.set(thePOI.id, {...poi, visible: false})
        poi.toggleVisibility()
    }, [thePOI.id, $pois])

    const show = useCallback(async () => {
        const poi = $pois.list.get(thePOI.id)
        $pois.list.set(thePOI.id, {...poi, visible: true})
        poi.toggleVisibility()
    }, [thePOI.id, $pois])

    const shrink = useCallback(async () => {
        const poi = $pois.list.get(thePOI.id)
        $pois.list.set(thePOI.id, {...poi, expanded: false})
    }, [thePOI.id, $pois])

    const expand = useCallback(async () => {
        const poi = $pois.list.get(thePOI.id)
        $pois.list.set(thePOI.id, {...poi, expanded: true})
    }, [thePOI.id, $pois])

    const focus = useCallback(async () => {
        $pois.current = thePOI.id
        const camera = lgs.mainProxy.components.camera
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
        }
        __.ui.sceneManager.focus(thePOI, {
            target: thePOI,
            heading:    camera.position.heading,
            pitch:      camera.position.pitch,
            roll:       camera.position.roll,
            range:      camera.position.range,
            infinite:   true,
            rotate:     false,
            panoramic:  false,
            flyingTime: 0,
        })
    }, [thePOI, $pois])

    const rotationAround = useCallback(async () => {
        $pois.current = thePOI.id
        const current = pois.list.get(thePOI.id)
        const camera = lgs.mainProxy.components.camera
        if (__.ui.cameraManager.isRotating()) {
            await stopRotation()
        }
        __.ui.sceneManager.focus(current, {
            target:     current,
            heading:    camera.position.heading,
            pitch:      camera.position.pitch,
            roll:       camera.position.roll,
            range:      camera.position.range,
            infinite:   true,
            rpm:        lgs.settings.ui.poi.rpm,
            rotations: 1,
            rotate:     true,
            panoramic:  false,
            flyingTime: 0,
        })
        $pois.list.set(thePOI.id, {...$pois.list.get(thePOI.id), animated: true})
    }, [thePOI.id, pois.list, $pois])

    const setAsStarter = useCallback(async () => {
        const {former, starter} = await __.ui.poiManager.setStarter(thePOI)
        if (starter) {
            UIToast.success({
                                caption: `${thePOI.title}`,
                                text:    'Set as new starter POI.',
                            })
            $pois.list.set(former.id, former)
            $pois.list.set(starter.id, starter)
        }
        else {
            UIToast.warning({
                                caption: `${thePOI.title}`,
                                text:    'Change failed.',
                            })
        }
    }, [thePOI, $pois])

    const panoramic = useCallback(async () => {
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
        }
        __.ui.cameraManager.panoramic()
    }, [])

    const stopRotation = useCallback(async () => {
        await __.ui.cameraManager.stopRotate()
        const poi = $pois.list.get(thePOI.id)
        $pois.list.set(thePOI.id, {...poi, animated: false})
    }, [thePOI.id, $pois])

    const remove = useCallback(async () => {
        if (__.ui.cameraManager.isRotating()) {
            await stopRotation()
        }
        __.ui.poiManager.remove({id: thePOI.id}).then((result) => {
            if (result.success) {
                pois.filtered.global.delete(result.id)
                pois.filtered.journey.delete(result.id)
                pois.bulkList.delete(result.id)
                $pois.current = false
            }
        })
    }, [thePOI.id, pois, $pois])

    // Memoized menu items to avoid re-rendering
    const menuItems = useMemo(() => {
        const items = []
        if (thePOI.visible) {
            if (!settings.focusOnEdit) {
                items.push(
                    <SlMenuItem key="focus" onClick={focus} small>
                        <SlIcon slot="prefix" library="fa" name={ICON_CROSSHAIRS}/>
                        <span>Focus</span>
                    </SlMenuItem>,
                )
            }
            if (thePOI.type !== POI_STARTER_TYPE) {
                items.push(
                    <SlMenuItem key="setAsStarter" onClick={setAsStarter} small>
                        <SlIcon slot="prefix" library="fa" name={ICON_FLAG}/>
                        <span>Set as Starter</span>
                    </SlMenuItem>,
                )
            }
            if (thePOI.type !== POI_STARTER_TYPE && thePOI.type !== POI_FLAG_START && thePOI.type !== POI_FLAG_STOP) {
                items.push(
                    <SlMenuItem key="remove" onClick={remove} small>
                        <SlIcon slot="prefix" library="fa" name={ICON_TRASH}/>
                        <span>Remove</span>
                    </SlMenuItem>,
                )
            }
            if (thePOI.expanded) {
                items.push(
                    <SlMenuItem key="shrink" onClick={shrink} small>
                        <FontAwesomeIcon slot="prefix" icon={thePOI.categoryIcon()}/>
                        <span>Reduce</span>
                    </SlMenuItem>,
                )
            }
            if (!thePOI.expanded) {
                items.push(
                    <SlMenuItem key="expand" onClick={expand} small>
                        <SlIcon slot="prefix" library="fa" name={ICON_ARROWS}/>
                        <span>Expand</span>
                    </SlMenuItem>,
                )
            }
            items.push(
                <SlMenuItem key="hide" onClick={hide} small>
                    <SlIcon slot="prefix" library="fa" name={ICON_MASK}/>
                    <span>Hide</span>
                </SlMenuItem>,
                <sl-divider key="divider"/>,
            )
            if (!pois.list.get(thePOI.id)?.animated) {
                items.push(
                    <SlMenuItem key="rotationAround" onClick={rotationAround}>
                        <SlIcon slot="prefix" library="fa" name={ICON_ROTATE}/>
                        <span>Rotate Around</span>
                    </SlMenuItem>,
                    <SlMenuItem key="panoramic" onClick={panoramic}>
                        <SlIcon slot="prefix" library="fa" name={ICON_PANORAMA}/>
                        <span>Panoramic</span>
                    </SlMenuItem>,
                )
            }
            if (thePOI.id === pois.current && pois.list.get(thePOI.id)?.animated) {
                items.push(
                    <SlMenuItem key="stopRotation" onClick={stopRotation} loading>
                        <SlIcon slot="prefix" library="fa" name={ICON_STOP}/>
                        <span>Stop Rotation</span>
                    </SlMenuItem>,
                )
            }
        }
        else {
            items.push(
                <SlMenuItem key="show" onClick={show} small>
                    <FontAwesomeIcon slot="prefix" icon={thePOI.icon}/>
                    <span>Show</span>
                </SlMenuItem>,
            )
        }
        return items
    }, [thePOI, settings.focusOnEdit, pois.list, pois.current, hide, show, shrink, expand, focus, setAsStarter, remove, rotationAround, panoramic, stopRotation])

    if (!thePOI || thePOI.type === POI_STARTER_TYPE) {
        return null
    }

    return (
        <SlDropdown className="edit-poi-menu">
            <SlButton slot="trigger" caret size="small">
                <FontAwesomeIcon slot="prefix" icon={faLocationDot}/> Select an action
            </SlButton>
            <SlMenu>{menuItems}</SlMenu>
        </SlDropdown>
    )
})