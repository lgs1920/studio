/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: GeocodingUI.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-01-21
 * Last modified: 2026-11-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SelectLocation }              from '@Components/MainUI/geocoding/SelectLocation'
import { openPOIEditor }                from '@Components/MainUI/MapPOI/openPOIEditor'
import { POICreationToastContent }      from '@Components/MainUI/MapPOI/POICreationToastContent'
import { focusPOIInOpenList }           from '@Components/MainUI/MapPOI/focusPOIInOpenList'
import WaDialogNonModal                from '@Components/WaDialogNonModal'
import { POI_NEW_BADGE_DURATION, POI_STANDARD_TYPE, SECOND } from '@Core/constants'
import { UI_ACTIONS } from '@Core/ui/metadata/uiActionCatalog'
import {
    WaButton, WaDivider, WaIcon, WaInput, WaSwitch, WaTooltip,
}                                      from '@awesome.me/webawesome/dist/react'
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
    const geolocationRequestId = useRef(0)
    const _reopenAfterHide = useRef(false)
    const [exactMatch, setExactMatch] = useState(false)
    const [coordinates, setCoordinates] = useState(false)
    const [ddCoordinates, setDdCoordinates] = useState(false)
    const [isLocating, setIsLocating] = useState(false)
    const [locationError, setLocationError] = useState('')

    const resetSearchState = () => {
        __.ui.geocoder.init()
        store.list.clear()
        store.dialog.noResults = false
        store.dialog.moreResults = false
        store.dialog.error = false
    }

    const resetTransientState = ({keepInput = false} = {}) => {
        geolocationRequestId.current += 1

        resetSearchState()
        store.dialog.loading = false
        store.dialog.submitDisabled = true
        setIsLocating(false)
        setLocationError('')

        if (!keepInput && address.current) {
            address.current.value = ''
        }

        setCoordinates(false)
        setExactMatch(false)
        setDdCoordinates(false)
    }

    const requestClose = () => {
        _reopenAfterHide.current = false
        geolocationRequestId.current += 1

        store.dialog.visible = false
    }

    const isDialogLifecycleEvent = (event) => event.target === event.currentTarget

    const handleRequestClose = (event) => {
        if (!isDialogLifecycleEvent(event)) {
            return
        }

        requestClose()
    }

    /**
     * Finish closing the dialog without losing a reopen requested during its hide animation.
     * @param {CustomEvent} event - Web Awesome dialog lifecycle event.
     */
    const handleAfterHide = (event) => {
        if (!isDialogLifecycleEvent(event)) {
            return
        }

        resetTransientState()

        if (store.dialog.visible) {
            // Re-apply the open state after Web Awesome completes the previous close transition.
            _reopenAfterHide.current = true
            store.dialog.visible = false
            requestAnimationFrame(() => {
                if (!_reopenAfterHide.current) {
                    return
                }

                _reopenAfterHide.current = false
                if (store.dialog.mounted) {
                    store.dialog.visible = true
                }
            })
            return
        }

        store.dialog.mounted = false
    }

    /**
     * Resolve terrain height after a provisional POI has been created.
     * @param {Object} poi - POI whose terrain height should be resolved.
     * @param {Promise<number>} terrainHeightRequest - Terrain height request started during POI insertion.
     * @returns {Promise<void>} Resolves after the POI height update is attempted.
     */
    const resolvePOITerrainHeight = async (poi, terrainHeightRequest) => {
        let simulatedHeight = 0
        try {
            simulatedHeight = await terrainHeightRequest
        }
        catch {
            // Keep the same zero-height fallback used by the previous synchronous terrain lookup.
        }

        const currentPOI = __.ui.poiManager.get(poi.id)
        if (!currentPOI
            || currentPOI.longitude !== poi.longitude
            || currentPOI.latitude !== poi.latitude
            || !Number.isFinite(simulatedHeight)) {
            return
        }

        try {
            await __.ui.poiManager.updatePOI(poi.id, {simulatedHeight}, {
                immediate:          true,
                skipLocationUpdate: true,
            })
        }
        catch {
            // The POI remains visible at its provisional ground-clamped position if saving its height fails.
        }
    }

    /**
     * Focus a POI immediately after insertion and complete slower persistence and terrain work afterward.
     * @param {Object} geoPoint - GeoJSON point to display.
     * @param {{keepDialogOpen?: boolean, shouldContinue?: () => boolean}} [options] - Dialog and cancellation options.
     * @returns {Promise<Object|null>} The created POI, or null when creation is cancelled or rejected.
     */
    const showPOI = async (geoPoint, {keepDialogOpen = false, shouldContinue = () => true} = {}) => {
        const point = await __.ui.poiManager.getPointFromGeoJson(geoPoint, false)
        if (!shouldContinue()) {
            return null
        }

        // Search-created POIs follow the same persisted standard type as context-menu POIs.
        point.type = POI_STANDARD_TYPE
        point.newBadgeExpiresAt = Date.now() + POI_NEW_BADGE_DURATION
        const creation = __.ui.poiManager.add(point)
        const poi = __.ui.poiManager.get(point.id)
        if (!poi) {
            const rejectedPOI = await creation
            if (rejectedPOI) {
                return rejectedPOI
            }

            UIToast.warning({
                                caption: 'POI not created !',
                                text:    'This location is too closed to an existing POI!',
                            })
            return null
        }

        const terrainHeightRequest = Promise.resolve()
            .then(() => __.ui.poiManager.getHeightFromTerrain({
                coordinates: {
                    longitude: poi.longitude,
                    latitude:  poi.latitude,
                },
            }))
            .catch(() => 0)

        focusPOIInOpenList(poi.id)

        void __.ui.sceneManager.focus(poi, {
            target:     poi,
            lookAt:     true,
            infinite:   false,
            rotate:     lgs.settings.ui.poi.rotate,
            rpm:        lgs.settings.ui.poi.rpm,
            flyingTime: 2,
            callback: async (focusedPOI) => {
                if (!shouldContinue()) {
                    return
                }

                await __.ui.poiManager.updatePOI(poi.id, {camera: focusedPOI.camera})
            },
        })

        if (!keepDialogOpen) {
            requestClose()
        }

        const createdPOI = await creation
        if (createdPOI) {
            void resolvePOITerrainHeight(createdPOI, terrainHeightRequest)
        }

        return createdPOI
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

    /**
     * Add the selected search result and show the success toast after persistence completes.
     * @param {string|number} placeId - Geocoder result identifier.
     * @returns {Promise<void>} Resolves after selection handling completes.
     */
    const handleSelect = async (placeId) => {
        const point = store.list.get(placeId)
        if (!point) {
            return
        }
        let createdPOI
        try {
            createdPOI = await showPOI(point)
        }
        catch {
            UIToast.error({
                caption: 'POI creation failed.',
                text:    'The selected location could not be added to the map.',
            })
            return
        }
        if (!createdPOI) {
            return
        }

        UIToast.success({
                            caption: 'POI created.',
                            text:    <POICreationToastContent
                                         poi={createdPOI}
                                         canEdit
                                         onEdit={() => openPOIEditor(createdPOI.id)}
                                     />,
                        }, 8 * SECOND)
    }

    /**
     * Synchronize search validation and coordinate mode with the current input value.
     * @param {{preserveGeolocationRequest?: boolean}} [options] - Whether the current location request remains active.
     */
    const handleChange = ({preserveGeolocationRequest = false} = {}) => {
        if (!preserveGeolocationRequest) {
            geolocationRequestId.current += 1
            setIsLocating(false)
        }

        const value = (address.current?.value || '').trimStart()
        setLocationError('')
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

    /**
     * Resolve the device position and place a readable location or its coordinates in the search field.
     * @returns {Promise<void>} Resolves after the current position has been handled.
     */
    const handleLocate = async () => {
        const geolocation = globalThis.navigator?.geolocation

        if (!geolocation) {
            setLocationError('Device location is not available in this browser.')
            return
        }

        const requestId = ++geolocationRequestId.current
        let isDisplayingLocation = false
        setIsLocating(true)
        setLocationError('')

        try {
            const position = await new Promise((resolve, reject) => {
                geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: false,
                    maximumAge:         60_000,
                    timeout:             15_000,
                })
            })

            if (requestId !== geolocationRequestId.current) {
                return
            }

            const {latitude, longitude} = position.coords
            const coordinateLabel = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
            if (!address.current) {
                return
            }

            address.current.value = coordinateLabel
            handleChange({preserveGeolocationRequest: true})
            isDisplayingLocation = true

            void __.ui.geocoder.getCoordinateLocationDetails({longitude, latitude})
                .then(details => {
                    if (requestId !== geolocationRequestId.current
                        || !address.current
                        || address.current.value !== coordinateLabel
                        || !details.location) {
                        return
                    }

                    address.current.value = details.location
                    handleChange({preserveGeolocationRequest: true})
                })
                .catch(() => {
                    // Keep the coordinates in the search field when reverse geocoding fails.
                })

            await showPOI(turf.point([longitude, latitude]), {
                keepDialogOpen: true,
                shouldContinue: () => requestId === geolocationRequestId.current,
            })
        }
        catch (error) {
            if (requestId !== geolocationRequestId.current) {
                return
            }

            const message = isDisplayingLocation
                ? 'The device location was found but could not be displayed on the map.'
                : error?.code === 1
                    ? 'Location permission was denied. Allow location access in your browser settings and try again.'
                    : error?.code === 2
                        ? 'Your current location is unavailable.'
                        : error?.code === 3
                            ? 'The location request timed out. Please try again.'
                            : 'The device location could not be retrieved.'

            setLocationError(message)
        }
        finally {
            if (requestId === geolocationRequestId.current) {
                setIsLocating(false)
            }
        }
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
            _reopenAfterHide.current = false
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
                <WaIcon {...UI_ACTIONS.searchLocation.icon}/>
                <span>{UI_ACTIONS.searchLocation.label}</span>
                <WaTooltip for="geocoder-use-current-location" placement="top">
                    {'Use my current location'}
                </WaTooltip>
                <WaButton
                    id="geocoder-use-current-location"
                    className="square-button geocoding-location-button"
                    appearance="outlined"
                    size="s"
                    type="button"
                    aria-label="Use my current location"
                    aria-busy={isLocating}
                    loading={isLocating}
                    disabled={isLocating}
                    onClick={handleLocate}
                >
                    <WaIcon name="location-crosshairs"/>
                </WaButton>
            </div>

            <div className="geocoding-dialog">
                {locationError &&
                    <p className="geocoding-location-error" role="alert">
                        {locationError}
                    </p>
                }
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
                        <WaIcon slot="start" {...UI_ACTIONS.close.icon}/>
                        {UI_ACTIONS.close.label}
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
