/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: GeocodingUI.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-17
 * Last modified: 2025-05-17
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { SelectLocation }              from '@Components/MainUI/geocoding/SelectLocation'
import { faBullseyePointer, faSearch } from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlInput, SlPopup, SlSwitch, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import * as turf                                                   from '@turf/helpers'
import { FA2SL }                                                   from '@Utils/FA2SL'
import { UIToast }                                                 from '@Utils/UIToast'

import { convert }                            from 'geo-coordinates-parser'
import React, { useEffect, useRef, useState } from 'react'
import { useSnapshot }                        from 'valtio'
import './style.css'


export const GeocodingUI = () => {
    const $geocoder = lgs.stores.main.components.geocoder
    const geocoder = useSnapshot($geocoder)
    const settings = useSnapshot(lgs.settings.ui.menu)

    const address = useRef(null)
    const [poi, setPoi] = useState(null)
    const [exactMatch, setExactMatch] = useState(false)
    const [coordinates, setCoordinates] = useState(false)
    const [ddCoordinates, setDdCoordinates] = useState(false)

    const handleSubmit = async (event) => {
        event.preventDefault()
        $geocoder.dialog.loading = true
        $geocoder.dialog.noResults = false
        $geocoder.dialog.error = false
        $geocoder.dialog.loading = false

        if (exactMatch && coordinates) {
            // Get latitude and longitude from input field.
            // Separator is spaces or comma or both
            let latitude, longitude, regex = /\s*,\s*|\s+/
            if (ddCoordinates) {
                [latitude, longitude] = address.current.value.split(regex)
            }
            else {
                [latitude, longitude] = convert(address.current.value).decimalCoordinates.split(regex)
            }
            await showPOI(turf.point([longitude * 1, latitude * 1]))
            return
        }

        if (!$geocoder.dialog.submitDisabled) {
            const value = ddCoordinates ? address.current.value : __.ui.geocoder.toDMS(address.current.value)
            __.ui.geocoder.search(address.current.value).then((results) => {

                if (results.error) {
                    $geocoder.dialog.error = {message: results.error}
                    return
                }

                if (results.size > 0) {
                    results.forEach((value, key) => {
                        $geocoder.list.set(key, value)
                    })
                    $geocoder.dialog.moreResults = results.size === __.ui.geocoder.limit
                }
                else {
                    $geocoder.dialog.noResults = true
                }
            })
        }
    }

    const handleSubmitAfterClear = (event) => {
        __.ui.geocoder.init()
        setCoordinates(false)
        setExactMatch(false)
        $geocoder.dialog.error = false

        handleSubmit(event)
    }

    /**
     *
     * @param geoPoint GeoJSON point
     */
    const showPOI = async geoPoint => {

        __.ui.poiManager.getPointFromGeoJson(geoPoint, true).then(point => {
            __.ui.sceneManager.focus(point, {
                target:     point,
                lookAt:     true,
                infinite:   false,
                rotate:     lgs.settings.ui.poi.rotate,
                rpm:        lgs.settings.ui.poi.rpm,
                flyingTime: 2,
                callback: async (poi) => {
                    const newPoi = await __.ui.poiManager.add(poi)

                    if (newPoi) {
                        setPoi(newPoi)
                        return true
                    }
                    UIToast.warning({
                                        caption: `POI not created !`,
                                        text:    `This location is too closed to an existing POI!`,
                                    })
                    return false
                },
            })
        })

        // Clear current values and states
        __.ui.geocoder.init()
        $geocoder.list.clear()
        address.current.value = ''
        $geocoder.dialog.visible = false
        $geocoder.dialog.noResults = false
        $geocoder.dialog.submitDisabled = true
    }

    /**
     * We show the selected address
     *
     * @param event
     */
    const handleSelect = async (event) => {
        lgs.stores.main.components.pois.current = false
        await showPOI($geocoder.list.get(event.target.parentElement.id * 1))
    }

    const handleChange = () => {
        $geocoder.dialog.noResults = false
        $geocoder.dialog.error = false
        address.current.value = address.current.value.trimStart()
        $geocoder.dialog.submitDisabled = address.current.value.length < lgs.settings.ui.geocoder.minQuery
        __.ui.geocoder.init()
        $geocoder.list.clear()
        $geocoder.dialog.noResults = false

        // Check if it is lat,lon in degrees with spaces or comma or both as separateur
        const ddRegex = /^-?([1-8]?\d(\.\d+)?|90(\.0+)?)[ ,\s]+-?(1[0-7]\d(\.\d+)?|180(\.0+)?|\d{1,2}(\.\d+)?)$/
        const dmsRegex = /^-?\d{1,3}° \d{1,2}' \d{1,2}(?:\.\d+)?\"[ ,]+-?\d{1,3}° \d{1,2}' \d{1,2}(?:\.\d+)?\"$/


        if (ddRegex.test(address.current.value) || dmsRegex.test(address.current.value)) {
            setDdCoordinates(ddRegex.test(address.current.value))
            setCoordinates(true)
            setExactMatch(true)
        }
        else {
            setCoordinates(false)
            setExactMatch(false)
        }

    }

    useEffect(() => {

        setCoordinates(false)
        setExactMatch(false)
        handleChange()


        return (() => {
            __.ui.geocoder.init()
            // store.list.clear()
            address.current.value = ''
            $geocoder.dialog.visible = false
            $geocoder.dialog.noResults = true
            $geocoder.dialog.error = false

            setCoordinates(false)
            setExactMatch(false)
        })

    }, [])

    return (
        <>
            <SlPopup active={geocoder.dialog.visible}
                     className={'lgs-theme'}
                     anchor="launch-the-geocoder"
                     placement={settings.toolBar.fromStart ? 'left-start' : 'right-start'}
                     distance={__.tools.rem2px(__.ui.css.getCSSVariable('lgs-gutter-xs'))}
            >

                <div className="geocoding-dialog">
                    <form onSubmit={handleSubmitAfterClear}>
                        <div className="geocoding-form">
                            <SlInput name="location" ref={address} id="geocoder-search-location"
                                     placeholder={'Address or coordinates (lat,lon)'}
                                     onChange={handleChange} onInput={handleChange}
                                     onFocus={handleChange}>

                            </SlInput>
                            <SlTooltip placement="top" open={!geocoder.dialog.submitDisabled}>
                                <SlButton size={'small'} className={'square-button'} type="submit"
                                          id="geocoder-search-location-submit"
                                          loading={geocoder.dialog.loading}
                                          disabled={geocoder.dialog.submitDisabled}>
                                    <SlIcon slot="prefix" library="fa"
                                            name={FA2SL.set(exactMatch ? faBullseyePointer : faSearch)}></SlIcon>
                                </SlButton>
                                <span slot="content">{exactMatch ? 'Show on map' : 'Search nearest'}</span>
                            </SlTooltip>
                        </div>
                    </form>

                    {coordinates &&
                        <div className="lgs-one-line-card exact-geocoding">
                            <SlSwitch align-right size="small" checked={exactMatch}
                                      onSlChange={(event) => setExactMatch(!exactMatch)}>
                                {'Exact Match'}</SlSwitch>
                        </div>
                    }

                    <SelectLocation select={handleSelect} address={address} submit={handleSubmit}/>

                </div>
            </SlPopup>
        </>
    )
}
