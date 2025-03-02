/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIBulkActionsMenu.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-03-02
 * Last modified: 2025-03-02
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { faArrowsFromLine, faArrowsToLine, faLocationDot, faTrashCan } from '@fortawesome/pro-regular-svg-icons'
import { faEye, faMask }                                               from '@fortawesome/pro-solid-svg-icons'
import { FontAwesomeIcon }                                             from '@fortawesome/react-fontawesome'
import { SlButton, SlDropdown, SlIcon, SlMenu, SlMenuItem }            from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                       from '@Utils/FA2SL'
import { useEffect, useState }                                         from 'react'
import { useSnapshot }                                                 from 'valtio'
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
export const MapPOIBulkActionsMenu = () => {

    const store = lgs.mainProxy.components.pois
    const pois = useSnapshot(store)
    const [disabled, setDisabled] = useState(false)

    const hide = async () => {
        store.bulkList.forEach((state, id) => {
            if (state) {
                __.ui.poiManager.hide(id).then()
            }
        })
    }
    const show = async () => {
        store.bulkList.forEach((state, id) => {
            if (state) {
                __.ui.poiManager.show(id).then()
            }
        })
    }

    const shrink = async () => {
        store.bulkList.forEach((state, id) => {
            if (state) {
                __.ui.poiManager.shrink(id).then()
            }
        })
    }

    const expand = async () => {
        store.bulkList.forEach((state, id) => {
            if (state) {
                __.ui.poiManager.expand(id).then()
            }
        })
    }

    /**
     * Removes the selected Poinst of Interest and associated UI elements.
     *
     * Postcondition:
     * - Camera rotation is stopped if it was active.
     */
    const remove = async () => {
        if (__.ui.cameraManager.isRotating()) {
            await __.ui.cameraManager.stopRotate()
        }
        // Check if current is in list
        const needToChangeCurrent = store.bulkList.has(pois.current.id)
        const actions = []
        store.bulkList.forEach(async (state, id) => {
            if (state) {
                actions.push(__.ui.poiManager.remove(id, true))
            }
        })
        Promise.all(actions).then(results => {
            let poi = 0
            results.forEach(result => {
                if (result.success) {
                    store.filteredList.delete(result.id)
                }
            })
        })

        // Change current id needed (false if the list is empty)
        if (needToChangeCurrent) {
            store.current = store.filteredList.size > 0 ? store.filteredList.entries().next().value : false
        }

        store.bulkList.clear()
    }

    useEffect(() => {
        setDisabled(Array.from(pois.bulkList.values()).every((value) => value === false))
    }, [store.bulkList.values()])

    return (
        <SlDropdown disabled={disabled}>
            <SlButton slot="trigger" size="small" caret>
                <FontAwesomeIcon slot="prefix" icon={faLocationDot}/>&nbsp;{'Select a bulk action'}
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