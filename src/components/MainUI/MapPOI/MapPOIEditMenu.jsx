/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditMenu.jsx
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

import { POI_FLAG_START, POI_FLAG_STOP, POI_STANDARD_TYPE, POI_STARTER_TYPE, POI_TMP_TYPE } from '@Core/constants'
import {
    faArrowRotateRight, faArrowsFromLine, faArrowsToLine, faCrosshairsSimple, faFlag, faLocationDot, faPanorama,
    faTrashCan, faXmark,
}                                                                                           from '@fortawesome/pro-regular-svg-icons'
import { faMask }                                                         from '@fortawesome/pro-solid-svg-icons'
import { SlButton, SlDropdown, SlIcon, SlIconButton, SlMenu, SlMenuItem } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                          from '@Utils/FA2SL'
import { UIToast }                                                                          from '@Utils/UIToast'
import React, { memo, useMemo } from 'react'
import { useSnapshot }                                                                      from 'valtio'
import './style.css'

const ICON_CROSSHAIRS = FA2SL.set(faCrosshairsSimple)
const ICON_FLAG = FA2SL.set(faFlag)
const ICON_TRASH = FA2SL.set(faTrashCan)
const ICON_EXPAND = FA2SL.set(faArrowsFromLine)
const ICON_REDUCE = FA2SL.set(faArrowsToLine)
const ICON_MASK = FA2SL.set(faMask)
const ICON_ROTATE = FA2SL.set(faArrowRotateRight)
const ICON_PANORAMA = FA2SL.set(faPanorama)

/**
 * A memoized React component for interacting with Points of Interest (POI) on the map.
 * @param {Object} props - Component props
 * @param {Object} props.point - The POI object to interact with
 * @returns {JSX.Element|null} The rendered dropdown menu or null if no point
 */
export const MapPOIEditMenu = memo(({point}) => {
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)

    if (!point) {
        return null
    }

    const hide = async () => {
        await __.ui.poiManager.updatePOI(point.id, {
            visible: false,
        })
        point.utils.toggleVisibility(point)
    }

    const show = async () => {
        await __.ui.poiManager.updatePOI(point.id, {
            visible: true,
        })
        point.utils.toggleVisibility(point)
    }

    const shrink = async () => {
        await __.ui.poiManager.updatePOI(point.id, {
            expanded: false,
        })
    }

    const expand = async () => {
        await __.ui.poiManager.updatePOI(point.id, {
            expanded: true,
        })
    }

    const focus = async () => {
        $pois.current = point.id
        const camera = lgs.stores.main.components.camera
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
        }
        __.ui.sceneManager.focus(point, {
            target: point,
            heading:    camera.position.heading,
            pitch:      camera.position.pitch,
            roll:       camera.position.roll,
            range:      camera.position.range,
            infinite:   true,
            rotate:     false,
            panoramic:  false,
            flyingTime: 2,
        })
    }

    const rotationAround = async () => {
        $pois.current = point.id
        const current = pois.list.get(point.id)
        const camera = lgs.stores.main.components.camera

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

        // Correction : Utilisation de point.id au lieu de starter non défini
        await __.ui.poiManager.updatePOI(point.id, {animated: true})
    }

    const setAsStarter = async () => {
        const {former, starter} = await __.ui.poiManager.setStarter(point)
        if (starter) {
            UIToast.success({
                                caption: `${point.title}`,
                                text:    'Set as new starter POI.',
                            })
            // Correction : update n'existait pas, on passe l'objet directement
            await __.ui.poiManager.updatePOI(former.id, {type: POI_STANDARD_TYPE})
            await __.ui.poiManager.updatePOI(starter.id, {type: POI_STARTER_TYPE})
        }
        else {
            UIToast.warning({
                                caption: `${point.title}`,
                                text:    'Change failed.',
                            })
        }
    }

    const saveAsStandardPOI = () => {
        __.ui.poiManager.updatePOI(point.id, {
            type:     POI_STANDARD_TYPE,
            category: POI_STANDARD_TYPE,
        })
    }

    const panoramic = async () => {
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
        }
        __.ui.cameraManager.panoramic()
    }

    const stopRotation = async () => {
        await __.ui.cameraManager.stopRotate()
        await __.ui.poiManager.updatePOI(point.id, {animated: false})
    }

    const remove = async () => {
        if (__.ui.cameraManager.isRotating()) {
            await stopRotation()
        }
        __.ui.poiManager.remove({id: point.id}).then((result) => {
            if (result.success) {
                $pois.filtered.global.delete(result.id)
                $pois.filtered.journey.delete(result.id)
                $pois.bulkList.delete(result.id)
                $pois.current = false
            }
        })
    }

    const menuItems = useMemo(() => {
        const items = []
        if (point.visible) {
            items.push(
                <SlMenuItem key="focus" onClick={focus}>
                    <SlIcon slot="prefix" library="fa" name={ICON_CROSSHAIRS}/>
                    <span>{'Focus'}</span>
                </SlMenuItem>
            )

            if (point.type !== POI_TMP_TYPE) {
                if (point.type !== POI_STARTER_TYPE) {
                    items.push(
                        <SlMenuItem key="setAsStarter" onClick={setAsStarter}>
                            <SlIcon slot="prefix" library="fa" name={ICON_FLAG}/>
                            <span>Set as Starter</span>
                        </SlMenuItem>
                    )
                }
            }
            else {
                items.push(
                    <SlMenuItem key="setAsStarter" onClick={saveAsStandardPOI}>
                        <SlIcon slot="prefix" library="fa" name={ICON_FLAG}/>
                        <span>{'Add to library'}</span>
                    </SlMenuItem>
                )
            }

            if (point.type !== POI_STARTER_TYPE && point.type !== POI_FLAG_START && point.type !== POI_FLAG_STOP) {
                items.push(
                    <SlMenuItem key="remove" onClick={remove}>
                        <SlIcon slot="prefix" library="fa" name={ICON_TRASH}/>
                        <span>{'Remove'}</span>
                    </SlMenuItem>
                )
            }

            if (point.expanded) {
                items.push(
                    <SlMenuItem key="shrink" onClick={shrink}>
                        <SlIcon slot="prefix" library="fa" name={ICON_REDUCE}/>
                        <span>{'Reduce'}</span>
                    </SlMenuItem>
                )
            }
            else {
                items.push(
                    <SlMenuItem key="expand" onClick={expand}>
                        <SlIcon slot="prefix" library="fa" name={ICON_EXPAND}/>
                        <span>{'Expand'}</span>
                    </SlMenuItem>
                )
            }

            items.push(
                <SlMenuItem key="hide" onClick={hide}>
                    <SlIcon slot="prefix" library="fa" name={ICON_MASK}/>
                    <span>{'Hide'}</span>
                </SlMenuItem>,
                <sl-divider key="divider"/>,
            )

            if (!pois.list.get(point.id)?.animated) {
                items.push(
                    <SlMenuItem key="rotationAround" onClick={rotationAround}>
                        <SlIcon slot="prefix" library="fa" name={ICON_ROTATE}/>
                        <span>{'Rotate Around'}</span>
                    </SlMenuItem>,
                    <SlMenuItem key="panoramic" onClick={panoramic}>
                        <SlIcon slot="prefix" library="fa" name={ICON_PANORAMA}/>
                        <span>{'Panoramic'}</span>
                    </SlMenuItem>,
                )
            }

            if (point.id === pois.current && pois.list.get(point.id)?.animated) {
                items.push(
                    <SlMenuItem key="stopRotation" onClick={stopRotation} loading>
                        <span>{'Stop Rotation'}</span>
                    </SlMenuItem>
                )
            }
        }
        return items
    }, [point, pois.current, pois.list.get(point.id)?.animated])

    return (
        <>
            {point.visible ? (
                <SlDropdown className="edit-poi-menu">
                    <SlButton slot="trigger" caret size="small">
                        <SlIconButton size="small" slot="prefix"
                                      library="fa"
                                      name={FA2SL.set(faLocationDot)}
                        />{'Select an action'}
                    </SlButton>
                    <SlMenu>{menuItems}</SlMenu>
                </SlDropdown>
            ) : (
                 <SlButton onClick={show} size="small">
                     <SlIconButton size="small" slot="prefix"
                                   library="fa"
                                   name={FA2SL.set(faLocationDot)}
                     />{'Show'}
                 </SlButton>
             )}
        </>
    )
})