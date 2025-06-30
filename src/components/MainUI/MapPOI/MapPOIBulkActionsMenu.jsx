/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIBulkActionsMenu.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-30
 * Last modified: 2025-06-30
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { JOURNEY_EDITOR_DRAWER } from '@Core/constants'
import {
    faArrowsFromLine, faArrowsToLine, faFilter, faFilterSlash, faLocationDot, faTrashCan,
}                                                                         from '@fortawesome/pro-regular-svg-icons'
import { faEye, faMask }                                               from '@fortawesome/pro-solid-svg-icons'
import { FontAwesomeIcon }                                                from '@Components/FontAwesomeIcon'
import { SlButton, SlDropdown, SlIcon, SlIconButton, SlMenu, SlMenuItem } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                          from '@Utils/FA2SL'
import React, { useEffect, useState }                                     from 'react'
import { useSnapshot }                                                    from 'valtio'
import './style.css'

/**
 * Represents the context menu for interacting with Points of Interest (POI) on the map.
 *
 * This component provides a menu that appears when interacting with a POI on the map.
 * It includes various actions for managing POIs, including rotation, panoramic view,
 * copying coordinates, and removing a POI, among others.
 *
 * The component relies on the state of the application's POI data and uses the provided
 * UI functionalities to handle interactions with the POI and the map view.
 */
export const MapPOIBulkActionsMenu = (globals) => {

    const $pois = lgs.mainProxy.components.pois
    const pois = useSnapshot($pois)
    const [disabled, setDisabled] = useState(false)
    const drawers = useSnapshot(lgs.stores.ui.drawers)
    const onlyJourney = drawers.open === JOURNEY_EDITOR_DRAWER

    const hide = async () => {
        $pois.bulkList.forEach((canHide, id) => {
            if (canHide) {
                const poi = pois.list.get(id)
                poi.hide()
            }
        })
        $pois.bulkList.clear()

    }
    const show = async () => {
        $pois.bulkList.forEach((canShow, id) => {
            if (canShow) {
                const poi = pois.list.get(id)
                poi.show()
            }
        })
        $pois.bulkList.clear()
    }

    const shrink = async () => {
        $pois.bulkList.forEach((canReduce, id) => {
            if (canReduce) {
                const poi = pois.list.get(id)
                poi.shrink()
            }
        })
        $pois.bulkList.clear()
    }

    const expand = async () => {
        $pois.bulkList.forEach((canExpand, id) => {
            if (canExpand) {
                const poi = pois.list.get(id)
                poi.expand()
            }
        })
        $pois.bulkList.clear()
    }

    /**
     * Removes the selected Points of Interest and associated UI elements.
     *
     * Postcondition:
     * - Camera rotation is stopped if it was active.
     */
    const remove = async () => {
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
        }
        // Check if current is in list
        const needToChangeCurrent = $pois.bulkList.has(pois.current)
        const actions = []
        $pois.bulkList.forEach(async (canRemove, id) => {
            if (canRemove) {
                actions.push(__.ui.poiManager.remove({id: id}))
            }
        })
        Promise.all(actions).then(results => {
            let poi = 0
            results.forEach(result => {
                if (result.success) {
                    if (onlyJourney) {
                        $pois.filtered.journey.delete(result.id)
                    }
                    else {
                        $pois.filtered.global.delete(result.id)
                    }
                }
            })
        })

        // Change current if needed (false if the list is empty)
        if (needToChangeCurrent) {
            if (onlyJourney) {
                $pois.current = $pois.filtered.journey.size > 0 ? $pois.filtered.journey.entries().next().value : false
            }
            else {
                $pois.current = $pois.filtered.global.size > 0 ? $pois.filtered.global.entries().next().value : false
            }

        }

        $pois.bulkList.clear()
    }

    useEffect(() => {
        setDisabled(Array.from(pois.bulkList.values()).every((value) => value === false))
    }, [$pois.bulkList.values()])

    return (
        <SlDropdown disabled={disabled}>
            <SlButton slot="trigger" size="small" caret disabled={disabled}>
                <SlIconButton size="small" slot="prefix"
                              library="fa"
                              name={FA2SL.set(faLocationDot)}
                />{'Select an action'}
            </SlButton>

            <SlMenu small>
                <SlMenuItem onClick={remove}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faTrashCan)}></SlIcon>
                    <span>Remove</span>
                </SlMenuItem>

                <SlMenuItem onClick={shrink}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowsToLine)}></SlIcon>
                    <span>Reduce</span>
                </SlMenuItem>

                <SlMenuItem onClick={expand}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowsFromLine)}></SlIcon>
                    <span>Expand</span>
                </SlMenuItem>

                <SlMenuItem onClick={hide} small>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faMask)}></SlIcon>
                    <span>Hide</span>
                </SlMenuItem>

                <SlMenuItem onClick={show} small>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faEye)}></SlIcon>
                    <span>Show</span>
                </SlMenuItem>

            </SlMenu>
        </SlDropdown>
    )
}