/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: GeocodingUI.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SelectLocation }              from '@Components/MainUI/geocoding/SelectLocation'
import WaDialogNonModal                from '@Components/WaDialogNonModal'
import { SECOND }                      from '@Core/constants'
import {
    WaButton, WaDivider, WaIcon, WaInput, WaSwitch, WaTooltip,
}                                      from '@web.awesome.me/webawesome-pro/dist/react'
import * as turf                       from '@turf/helpers'
import { UIToast }                     from '@Utils/UIToast'
import { useManagedStylesheet }        from '@Utils/useManagedStylesheet'
import { convert }                     from 'geo-coordinates-parser'
import { useEffect, useRef, useState } from 'react'
import { useSnapshot }                 from 'valtio'
import geocodingStylesheetHref         from './style.css?url'

const GEOCODING_STYLESHEET_ID = 'geocoding'

export const GeocodingUI = () => {
    useManagedStylesheet(GEOCODING_STYLESHEET_ID, geocodingStylesheetHref)

    const store = lgs.stores.main.components.geocoder
    const geocoder = useSnapshot(store)
    const address = useRef(null)
    const [exactMatch, setExactMatch] = useState(false)
    const [coordinates, setCoordinates] = useState(false)
    const [ddCoordinates, setDdCoordinates] = useState(false)

    const resetSearchState = () => {
        __.ui.geocoder.init()
        store.list.clear()
        store.dialog.noResults = false
        store.dialog.moreResults = false
        store.dialog.error = false
    }

    const resetTransientState = ({keepInput = false} = {}) => {
        resetSearchState()
        store.dialog.loading = false
        store.dialog.submitDisabled = true

        if (!keepInput && address.current) {
            address.current.value = ''
        }

        setCoordinates(false)
        setExactMatch(false)
        setDdCoordinates(false)
    }

    const requestClose = () => {
        store.dialog.visible = false
    }

    const isDialogLifecycleEvent = (event) => event.target === event.currentTarget

    const handleRequestClose = (event) => {
        if (!isDialogLifecycleEvent(event)) {
            return
        }

        requestClose()
    }

    const handleAfterHide = (event) => {
        if (!isDialogLifecycleEvent(event)) {
            return
        }

        resetTransientState()
        store.dialog.mounted = false
    }

    const showPOI = async (geoPoint) => {
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
                        return true
                    }
                    UIToast.warning({
                                        caption: 'POI not created !',
                                        text:    'This location is too closed to an existing POI!',
                                    })
                    return false
                },
            })
        })

        requestClose()
    }

    const handleSubmit = async (event) => {
        event?.preventDefault?.()

        if (!address.current) {
            return
        }

        store.dialog.loading = true
        store.dialog.noResults = false
        store.dialog.moreResults = false
        store.dialog.error = false

        try {
            if (exactMatch && coordinates) {
                const regex = /\s*,\s*|\s+/
                let latitude
                let longitude

                if (ddCoordinates) {
                    [latitude, longitude] = address.current.value.split(regex)
                }
                else {
                    [latitude, longitude] = convert(address.current.value).decimalCoordinates.split(regex)
                }

                await showPOI(turf.point([longitude * 1, latitude * 1]))
                return
            }

            if (store.dialog.submitDisabled) {
                return
            }

            const results = await __.ui.geocoder.search(address.current.value)
            if (results.error) {
                store.dialog.error = {message: results.error}
                return
            }

            if (results.size > 0) {
                results.forEach((value, key) => {
                    store.list.set(key, value)
                })
                store.dialog.moreResults = results.size === __.ui.geocoder.limit
                return
            }

            store.dialog.noResults = true
        }
        finally {
            store.dialog.loading = false
        }
    }

    const handlePrimarySubmit = (event) => {
        resetSearchState()
        void handleSubmit(event)
    }

    const handleSelect = async (placeId) => {
        lgs.stores.main.components.pois.current = false
        const point = store.list.get(placeId)
        if (!point) {
            return
        }
        await showPOI(point)
        UIToast.warning({
                            caption: 'Temporary POI created.',
                            text:    `It won't be saved permanently until you edit it and add it to POIs library.`,
                        }, 8 * SECOND)
    }

    const handleChange = () => {
        const value = (address.current?.value || '').trimStart()
        if (address.current && address.current.value !== value) {
            address.current.value = value
        }

        resetSearchState()

        const ddRegex = /^-?([1-8]?\d(\.\d+)?|90(\.0+)?)[ ,\s]+-?(1[0-7]\d(\.\d+)?|180(\.0+)?|\d{1,2}(\.\d+)?)$/
        const dmsRegex = /^-?\d{1,3}° \d{1,2}' \d{1,2}(?:\.\d+)?"[ ,]+-?\d{1,3}° \d{1,2}' \d{1,2}(?:\.\d+)?"$/
        const isDD = ddRegex.test(value)
        const isDMS = dmsRegex.test(value)
        const isCoordinates = isDD || isDMS

        setDdCoordinates(isDD)
        setCoordinates(isCoordinates)
        setExactMatch(isCoordinates)
        store.dialog.submitDisabled = !isCoordinates && value.length < lgs.settings.ui.geocoder.minQuery
    }

    useEffect(() => {
        if (!geocoder.dialog.visible) {
            return
        }

        handleChange()
        requestAnimationFrame(() => {
            address.current?.focus?.()
        })
    }, [geocoder.dialog.visible])

    useEffect(() => {
        return () => {
            resetTransientState()
            store.dialog.visible = false
            store.dialog.mounted = false
        }
    }, [])

    return (
        <WaDialogNonModal
            open={geocoder.dialog.visible}
            className="geocoding-widget-dialog"
            appearance="outlined"
            withFooter
            onWaHide={handleRequestClose}
            onWaAfterHide={handleAfterHide}
        >
            <div slot="label" className="geocoding-dialog-title">
                <WaIcon name="map-location-dot" variant="regular"/>
                <span>{'Search location'}</span>
            </div>

            <div className="geocoding-dialog">
                <form onSubmit={handlePrimarySubmit}>
                    <div className="geocoding-form">
                        <WaInput
                            appearance="filled"
                            name="location"
                            ref={address}
                            id="geocoder-search-location"
                            placeholder="Address or coordinates (lat,lon)"
                            onChange={handleChange}
                            onInput={handleChange}
                            withClear
                        />

                        <WaTooltip for="geocoder-search-location-submit">
                            {exactMatch ? 'Show on map' : 'Search nearest'}
                        </WaTooltip>
                        <WaButton
                            size="s"
                            className="square-button"
                            type="submit"
                            id="geocoder-search-location-submit"
                            loading={geocoder.dialog.loading}
                            disabled={geocoder.dialog.submitDisabled}
                            variant="brand"
                        >
                            <WaIcon name={exactMatch ? 'bullseye-pointer' : 'search'} variant="regular"/>
                        </WaButton>
                    </div>
                </form>

                {coordinates &&
                    <WaSwitch
                        label-at-start width-auto
                        size="xs"
                        checked={exactMatch}
                        onChange={(event) => setExactMatch(event.target.checked)}
                    >
                        {'Exact Match'}
                    </WaSwitch>
                }

                <SelectLocation select={handleSelect}/>
            </div>

            <div slot="footer" className="geocoding-dialog-footer">
                <WaDivider/>
                <div className="buttons-bar">
                    <WaButton appearance="outlined" onClick={requestClose}>
                        <WaIcon slot="start" name="xmark" variant="regular"/>
                        {'Close'}
                    </WaButton>
                    {geocoder.dialog.moreResults &&
                        <WaButton autofocus variant="brand" appearance="accent" onClick={handleSubmit}>
                            <WaIcon slot="start" name="search" variant="regular"/>
                            {'More results'}
                        </WaButton>
                    }
                </div>
            </div>
        </WaDialogNonModal>
    )
}
