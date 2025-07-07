/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditContent.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-27
 * Last modified: 2025-06-27
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { FontAwesomeIcon }                                   from '@Components/FontAwesomeIcon'
import { MapPOICategorySelector }                                  from '@Components/MainUI/MapPOI/MapPOICategorySelector'
import {
    MapPOIEditMenu,
}                                                                  from '@Components/MainUI/MapPOI/MapPOIEditMenu'
import {
    faClock, faCopy, faSquareQuestion,
}                                                                  from '@fortawesome/pro-regular-svg-icons'
import {
    SlColorPicker, SlDivider, SlIconButton, SlInput, SlTextarea, SlTooltip,
}                                                                  from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                   from '@Utils/FA2SL'
import { UIToast }                                                 from '@Utils/UIToast'
import { ELEVATION_UNITS, foot, IMPERIAL, INTERNATIONAL, UnitUtils } from '@Utils/UnitUtils'
import classNames                                                  from 'classnames'
import parse                                                       from 'html-react-parser'
import { DateTime }                                                from 'luxon'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                             from 'valtio'

// Pre-calculated icons for better performance
const ICON_COPY = FA2SL.set(faCopy)
const ICON_HELP = FA2SL.set(faSquareQuestion)

/**
 * A React component for editing the content of a Point of Interest (POI).
 * Provides functionality to edit POI properties including title, description,
 * coordinates, altitude, colors, and category.
 *
 * @param {Object} props - Component props
 * @param {Object} props.poi - The POI object to edit
 * @param {string} props.poi.id - Unique identifier of the POI
 * @returns {JSX.Element|null} The rendered edit content or null if no POI exists
 */
export const MapPOIEditContent = memo(({poi}) => {
    // Store references and state
    const $pois = lgs.stores.main.components.pois
    const {list: poisList, current: poisCurrent} = useSnapshot($pois)
    const unitSystem = lgs.settings.unitSystem
    const swatchesList = lgs.settings.getSwatches.list
    const poiColor = useRef(null)
    const poiBgColor = useRef(null)

    // Get specific POI data directly from snapshot
    const point = poisList.get(poi.id) || {}
    const {id, title, description, latitude, longitude, height, simulatedHeight, color, bgColor, time, visible} = point

    // State to track if altitude is simulated or real
    const [simulated, setSimulated] = useState(height === undefined || height === simulatedHeight)

    /**
     * Debounced handlers for updating POI properties
     */
    const handleChangeAltitude = useCallback(__.tools.debounce(async (event) => {
        if (window.isOK) {
            const value = event.target.value * 1
            const updatedPoint = await __.ui.poiManager.updatePOI(id, {
                height: unitSystem.current === IMPERIAL ? UnitUtils.convertFeetToMeters(value) : value,
            })
            setSimulated(updatedPoint.height === updatedPoint.simulatedHeight)
        }
    }, 300), [id, unitSystem.current])

    const handleChangeColor = useCallback(__.tools.debounce(async (event) => {
        if (!window.isOK) {
            return
        }

        let updateData = {}
        if (event.target === poiColor.current) {
            updateData.color = event.target.value
        }
        if (event.target === poiBgColor.current) {
            updateData.bgColor = event.target.value
        }

        if (Object.keys(updateData).length > 0) {
            await __.ui.poiManager.updatePOI(id, updateData)
        }

        event.preventDefault()
        event.stopPropagation()
    }, 300), [id])

    const handleChangeLatitude = useCallback(__.tools.debounce(async (event) => {
        if (window.isOK) {
            await __.ui.poiManager.updatePOI(id, {
                latitude: event.target.value * 1,
            })
        }
    }, 300), [id])

    const handleChangeLongitude = useCallback(__.tools.debounce(async (event) => {
        if (window.isOK) {
            await __.ui.poiManager.updatePOI(id, {
                longitude: event.target.value * 1,
            })
        }
    }, 300), [id])

    const handleChangeTitle = useCallback(__.tools.debounce(async (event) => {
        if (window.isOK) {
            await __.ui.poiManager.updatePOI(id, {
                title: event.target.value,
            })
            $pois.current = id
        }
    }, 300), [id])

    const handleChangeDescription = useCallback(__.tools.debounce(async (event) => {
        if (window.isOK) {
            await __.ui.poiManager.updatePOI(id, {
                description: event.target.value,
            })
        }
    }, 300), [id])

    /**
     * Memoized color swatches for color pickers
     */
    const swatches = useMemo(() => swatchesList.join(';'), [swatchesList])

    /**
     * Memoized latitude and longitude with default values
     */
    const displayLatitude = useMemo(() => latitude ?? '', [latitude])
    const displayLongitude = useMemo(() => longitude ?? '', [longitude])

    /**
     * Memoized altitude input component
     */
    const altitudeInput = useMemo(() => (
        <div className="map-poi-edit-row-coordinates">
            <div className="map-poi-edit-item">
                {simulated ? 'Simulated alt.' : 'Altitude'}
            </div>
            <SlInput
                className={classNames('map-poi-edit-item', 'map-poi', simulated ? 'map-poi-edit-warning-altitude' : '')}
                size="small"
                type="number"
                onSlChange={handleChangeAltitude}
                onSlInput={handleChangeAltitude}
                value={Math.round(height || simulatedHeight).toString()}
            >
                <span slot="suffix">{parse(ELEVATION_UNITS[unitSystem.current] + ' ')}</span>
            </SlInput>
            {simulated && (
                <SlTooltip content="Enter the real altitude to replace the simulated value." className="tooltip-help">
                    <SlIconButton
                        className="edit-poi-copy-coordinates"
                        library="fa"
                        name={ICON_HELP}
                    />
                </SlTooltip>
            )}
        </div>
    ), [simulated, height, simulatedHeight, unitSystem.current, handleChangeAltitude])

    /**
     * Handles copying coordinates to clipboard
     */
    const handleCopy = useCallback(() => {
        const poiData = poisList.get(id) || {}
        __.ui.poiManager.copyCoordinatesToClipboard({
                                                        id,
                                                        title:     poiData.title ?? '',
                                                        latitude:  poiData.latitude ?? '',
                                                        longitude: poiData.longitude ?? '',
                                                    }).then(() => {
            UIToast.success({
                                caption: poiData.title ?? '',
                                text:    'Coordinates copied to the clipboard <br/>under the form: latitude, longitude',
                            })
        })
    }, [id, poisList])

    /**
     * Effect to update simulated state when POI height changes
     */
    useEffect(() => {
        setSimulated(height === undefined || height === simulatedHeight)
    }, [height, simulatedHeight])

    // Return null if point doesn't exist
    if (!point || !id) {
        return null
    }

    return (
        <>
            <SlDivider/>
            <div className="edit-map-poi-wrapper" id={`edit-map-poi-content-${id}`}>
                <div className="map-poi-color-actions">
                    <SlTooltip content="Background Color">
                        <SlColorPicker
                            size="small"
                            label="Color"
                            value={bgColor ?? lgs.colors.poiDefaultBackground}
                            swatches={swatches}
                            onSlChange={handleChangeColor}
                            disabled={!visible}
                            noFormatToggle
                            ref={poiBgColor}
                        />
                    </SlTooltip>
                    <SlTooltip content="Foreground Color">
                        <SlColorPicker
                            size="small"
                            label="Color"
                            value={color ?? lgs.colors.poiDefault}
                            swatches={swatches}
                            onSlChange={handleChangeColor}
                            disabled={!visible}
                            noFormatToggle
                            ref={poiColor}
                        />
                    </SlTooltip>
                    <MapPOIEditMenu point={point}/>
                </div>

                <div>
                    <SlInput
                        size="small"
                        value={title ?? ''}
                        onSlChange={handleChangeTitle}
                        className="edit-title-map-poi-input"
                    >
                        <span slot="label" className="edit-title-map-poi">Title</span>
                    </SlInput>
                </div>
                <MapPOICategorySelector point={point}/>

                <div>
                    <SlTextarea
                        size="small"
                        value={description ?? ''}
                        onSlChange={handleChangeDescription}
                        className="edit-title-map-poi-input"
                    >
                        <span slot="label" className="edit-title-map-poi">Description</span>
                    </SlTextarea>
                </div>

                {time && (
                    <div className="poi-time">
                        <FontAwesomeIcon icon={faClock}/>
                        {DateTime.fromISO(time).toLocaleString(DateTime.DATE_FULL)} -{' '}
                        {DateTime.fromISO(time).toLocaleString(DateTime.TIME_SIMPLE)}
                    </div>
                )}

                <div className="map-poi-edit-row-coordinates">
                    <SlInput
                        className="map-poi-edit-item"
                        size="small"
                        noSpinButtons
                        onSlChange={handleChangeLatitude}
                        value={displayLatitude}
                        label="Latitude"
                    />
                    <SlInput
                        className="map-poi-edit-item"
                        size="small"
                        noSpinButtons
                        onSlChange={handleChangeLongitude}
                        value={displayLongitude}
                        label="Longitude"
                    />
                    <SlTooltip content="Copy Coordinates">
                        <SlIconButton
                            className="edit-poi-copy-coordinates"
                            onClick={handleCopy}
                            library="fa"
                            name={ICON_COPY}
                        />
                    </SlTooltip>
                </div>
                {altitudeInput}
            </div>
        </>
    )
}, (prevProps, nextProps) => prevProps.poi.id === nextProps.poi.id)