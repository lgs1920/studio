import { SelectLocation }                                          from '@Components/MainUI/geocoding/SelectLocation'
import { faBullseyePointer, faSearch }                             from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlInput, SlPopup, SlSwitch, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import * as turf                                                   from '@turf/helpers'
import { FA2SL }                                                   from '@Utils/FA2SL'
import { UIToast }                                                 from '@Utils/UIToast'
import React, { useEffect, useRef, useState }                      from 'react'
import { useSnapshot }                                             from 'valtio'

import './style.css'

export const GeocodingUI = () => {
    const store = lgs.mainProxy.components.geocoder
    const snap = useSnapshot(store)
    const settings = useSnapshot(lgs.settings.ui.menu)

    const address = useRef(null)
    const [poi, setPoi] = useState(null)
    const [exactMatch, setExactMatch] = useState(false)
    const [coordinates, setCoordinates] = useState(false)

    const handleSubmit = async (event) => {
        event.preventDefault()
        store.dialog.loading = true
        store.dialog.noResults = false
        store.dialog.error = false
        store.dialog.loading = false

        if (exactMatch && coordinates) {
            // Get latitude and longitude from input field.
            // Separator is spaces or comma or both
            const [latitude, longitude] = address.current.value.split(/\s*,\s*|\s+/)
            await showPOI(turf.point([longitude * 1, latitude * 1]))
            return
        }

        if (!store.dialog.submitDisabled) {
            __.ui.geocoder.search(address.current.value).then((results) => {

                if (results.error) {
                    store.dialog.error = {message: results.error}
                    return
                }

                if (results.size > 0) {
                    results.forEach((value, key) => {
                        store.list.set(key, value)
                    })
                    store.dialog.moreResults = results.size === __.ui.geocoder.limit
                }
                else {
                    store.dialog.noResults = true
                }
            })
        }
    }

    const handleSubmitAfterClear = (event) => {
        __.ui.geocoder.init()
        setCoordinates(false)
        setExactMatch(false)
        store.dialog.error = false

        handleSubmit(event)
    }

    /**
     *
     * @param geoPoint GeoJSON point
     */
    const showPOI = async geoPoint => {
        const point = {
            longitude: geoPoint.geometry.coordinates[0],
            latitude:  geoPoint.geometry.coordinates[1],
            title:     geoPoint.properties.name,
        }
        try {
            point.simulatedHeight = await __.ui.poiManager.getElevationFromTerrain({
                                                                                       longitude: geoPoint.geometry.coordinates[0],
                                                                                       latitude:  geoPoint.geometry.coordinates[1],
                                                                                   })
        }
        catch {
            point.simulatedHeight = 0
        }


        __.ui.sceneManager.focus(point, {
            lookAt:   true,
            infinite: false,
            rotate:   true,
            callback: (poi) => {
                const newPoi = __.ui.poiManager.add(poi)
                if (newPoi) {
                    setPoi(newPoi)
                    return true
                }
                UIToast.warning({
                                    caption: `POI not created !`,
                                    text: `This location is too closed to an existing POI!`,
                                })
                return false
            },
        })

        // Clear current values and states
        __.ui.geocoder.init()
        store.list.clear()
        address.current.value = ''
        store.dialog.visible = false
        store.dialog.noResults = false
        store.dialog.submitDisabled = true
    }

    /**
     * We show the selected address
     *
     * @param event
     */
    const handleSelect = async (event) => {
        await showPOI(store.list.get(event.target.parentElement.id * 1))
    }

    const handleChange = () => {
        store.dialog.noResults = false
        store.dialog.error = false
        address.current.value = address.current.value.trimStart()
        store.dialog.submitDisabled = address.current.value.length < lgs.settings.ui.geocoder.minQuery
        __.ui.geocoder.init()
        store.list.clear()
        store.dialog.noResults = false

        // Check if it is lat,lon in degrees with spaces or comma or both as separateur
        const regex = /^-?([1-8]?\d(\.\d+)?|90(\.0+)?)[ ,\s]+-?(1[0-7]\d(\.\d+)?|180(\.0+)?|\d{1,2}(\.\d+)?)$/
        if (regex.test(address.current.value)) {
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
            store.dialog.visible = false
            store.dialog.noResults = true
            store.dialog.error = false

            setCoordinates(false)
            setExactMatch(false)
        })

    }, [])

    return (
        <>
            <SlPopup active={snap.dialog.visible}
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
                            <SlTooltip placement="top" open={!snap.dialog.submitDisabled}>
                                <SlButton size={'small'} className={'square-icon'} type="submit"
                                          id="geocoder-search-location-submit"
                                          loading={snap.dialog.loading}
                                          disabled={snap.dialog.submitDisabled}>
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
