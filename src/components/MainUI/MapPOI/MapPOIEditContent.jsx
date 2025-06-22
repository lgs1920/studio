/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditContent.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-22
 * Last modified: 2025-06-22
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { FontAwesomeIcon }                                   from '@Components/FontAwesomeIcon'
import {
    MapPOICategorySelector,
}                                                            from '@Components/MainUI/MapPOI/MapPOICategorySelector'
import {
    MapPOIEditMenu,
}                                                            from '@Components/MainUI/MapPOI/MapPOIEditMenu'
import {
    faClock, faCopy, faSquareQuestion,
}                                                            from '@fortawesome/pro-regular-svg-icons'
import {
    SlColorPicker, SlDivider, SlIconButton, SlInput, SlTextarea, SlTooltip,
}                                                            from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                             from '@Utils/FA2SL'
import { UIToast }                                           from '@Utils/UIToast'
import { ELEVATION_UNITS, foot, IMPERIAL, INTERNATIONAL, UnitUtils } from '@Utils/UnitUtils'
import classNames                                            from 'classnames'
import parse                                                 from 'html-react-parser'
import { DateTime }                                          from 'luxon'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                       from 'valtio'

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
export const MapPOIEditContent = ({poi}) => {
    // Store references and state
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    const settings = lgs.settings
    const poiColor = useRef(null)
    const poiBgColor = useRef(null)
    let point = pois.list.get(poi.id)

    // State to track if altitude is simulated or real
    const [simulated, setSimulated] = useState(point?.height === undefined || point?.height === point?.simulatedHeight)

    /**
     * Calculates the altitude value based on the current unit system
     * @returns {number} The altitude in the appropriate units
     */
    const altitude = useMemo(() => {
        const height = point?.height || point?.simulatedHeight
        return settings.unitSystem.current === INTERNATIONAL
               ? height
               : __.convert(height).to(foot)
    }, [point?.height, point?.simulatedHeight, settings.unitSystem.current])

    /**
     * Memoized color swatches for color pickers
     * @returns {string} Semicolon-separated list of color swatches
     */
    const swatches = useMemo(() => settings.getSwatches.list.join(';'), [settings.getSwatches.list])

    /**
     * Converts latitude to the current coordinate system
     * @returns {number} Latitude in the current coordinate system
     */
    const latitude = useMemo(() => __.convert(point?.latitude).to(settings.coordinateSystem.current), [point?.latitude, settings.coordinateSystem.current])

    /**
     * Converts longitude to the current coordinate system
     * @returns {number} Longitude in the current coordinate system
     */
    const longitude = useMemo(() => __.convert(point?.longitude).to(settings.coordinateSystem.current), [point?.longitude, settings.coordinateSystem.current])

    /**
     * Handles altitude change events
     * Updates the POI's height property and persists to database
     *
     * @param {Event} event - The input change event
     */
    const handleChangeAltitude = async (event) => {
        if (window.isOK) {
            const height = event.target.value * 1
            point = await __.ui.poiManager.updatePOI(point.id, {
                height: settings.unitSystem.current === IMPERIAL ? UnitUtils.convertFeetToMeters(height) : height,
            })
            setSimulated(point.height === point.simulatedHeight)
        }
    }

    /**
     * Handles color change events for both foreground and background colors
     * Updates the POI's color properties and syncs with filtered collections
     *
     * @param {Event} event - The color picker change event
     */
    const handleChangeColor = async event => {
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

        // updatePOI fait TOUT le travail automatiquement
        if (Object.keys(updateData).length > 0) {
            point = await __.ui.poiManager.updatePOI(point.id, updateData);
        }

        event.preventDefault()
        event.stopPropagation()
    }

    /**
     * Handles latitude change events
     * Updates the POI's latitude property and persists to database
     *
     * @param {Event} event - The input change event
     */
    const handleChangeLatitude = async event => {
        await __.ui.poiManager.updatePOI(point.id, {
            latitude: event.target.value * 1,
        })
    }

    /**
     * Handles longitude change events
     * Updates the POI's longitude property and persists to database
     *
     * @param {Event} event - The input change event
     */
    const handleChangeLongitude = async event => {
        if (window.isOK) {
            await __.ui.poiManager.updatePOI(point.id, {
                longitude: event.target.value * 1,
            })
        }
    }

    /**
     * Handles title change events
     * Updates the POI's title property and persists to database
     *
     * @param {Event} event - The input change event
     */
    const handleChangeTitle = async event => {
        if (window.isOK) {
            await __.ui.poiManager.updatePOI(point.id, {
                title: event.target.value,
            })
        }
    }

    /**
     * Handles description change events
     * Updates the POI's description property and persists to database
     *
     * @param {Event} event - The textarea change event
     */
    const handleChangeDescription = async event => {
        if (window.isOK) {
            await __.ui.poiManager.updatePOI(point.id, {
                description: event.target.value,
            })
        }
    }

    /**
     * Handles copying coordinates to clipboard
     * Shows a success toast notification when completed
     */
    const handleCopy = useCallback(() => {
        __.ui.poiManager.copyCoordinatesToClipboard(point).then(() => {
            UIToast.success({
                                caption: `${point.title}`,
                                text:    'Coordinates copied to the clipboard <br/>under the form: latitude, longitude',
                            })
        })
    }, [point])

    /**
     * Effect to update simulated state when POI height changes
     */
    useEffect(() => {
        if (point && pois.current) {
            setSimulated(point.height === undefined || point.height === point.simulatedHeight)
        }
    }, [point?.height, point?.simulatedHeight, pois.current])

    // Return null if point doesn't exist
    if (!point) {
        return null
    }

    /**
     * Memoized altitude input component
     * Displays different styling and tooltip for simulated vs real altitude
     */
    const altitudeInput = useMemo(() => (
        <div className="map-poi-edit-row-coordinates">
            <div className="map-poi-edit-item">
                {simulated ? ('Simulated alt.') : ('Altitude')}
            </div>

            <SlInput
                className={classNames('map-poi-edit-item', 'map-poi', simulated ? 'map-poi-edit-warning-altitude' : '')}
                size="small"
                type="number"
                onSlChange={handleChangeAltitude}
                onSlInput={handleChangeAltitude}
                value={Math.round(altitude).toString()}
            >
                <span slot="suffix">{parse(ELEVATION_UNITS[settings.unitSystem.current] + ' ')}</span>
            </SlInput>
            {simulated &&
                <SlTooltip content={'Enter the real altitude to replace the simulated value.'}
                           className={'tooltip-help'}>
                    <SlIconButton
                        className="edit-poi-copy-coordinates"
                        library="fa"
                        name={ICON_HELP}
                    />
                </SlTooltip>
            }
        </div>
    ), [simulated, altitude, handleChangeAltitude, settings.unitSystem.current])

    return (
        <>
            <SlDivider/>
            <div className="edit-map-poi-wrapper" id={`edit-map-poi-content-${point.id}`}>
                <div className="map-poi-color-actions">
                    <SlTooltip content="Background Color">
                        <SlColorPicker
                            size="small"
                            label="Color"
                            value={point?.bgColor ?? lgs.colors.poiDefaultBackground}
                            swatches={swatches}
                            onSlChange={(e) => handleChangeColor(e, 'bgColor')}
                            disabled={!point?.visible}
                            noFormatToggle
                            ref={poiBgColor}
                        />
                    </SlTooltip>
                    <SlTooltip content="Foreground Color">
                        <SlColorPicker
                            size="small"
                            label="Color"
                            value={point?.color ?? lgs.colors.poiDefault}
                            swatches={swatches}
                            onSlChange={(e) => handleChangeColor(e, 'color')}
                            disabled={!point?.visible}
                            noFormatToggle
                            ref={poiColor}
                        />
                    </SlTooltip>
                    <MapPOIEditMenu point={point}/>
                </div>

                <div>
                    <SlInput
                        size="small"
                        value={point.title}
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
                        value={point.description ?? ''}
                        onSlChange={handleChangeDescription}
                        className="edit-title-map-poi-input"
                    >
                        <span slot="label" className="edit-title-map-poi">Description</span>
                    </SlTextarea>
                </div>

                {point.time && (
                    <div className="poi-time">
                        <FontAwesomeIcon icon={faClock}/>
                        {DateTime.fromISO(point.time).toLocaleString(DateTime.DATE_FULL)} -{' '}
                        {DateTime.fromISO(point.time).toLocaleString(DateTime.TIME_SIMPLE)}
                    </div>
                )}

                <div className="map-poi-edit-row-coordinates">
                    <SlInput
                        className="map-poi-edit-item"
                        size="small"
                        noSpinButtons
                        onSlChange={handleChangeLatitude}
                        value={latitude}
                        label="Latitude"
                    />
                    <SlInput
                        className="map-poi-edit-item"
                        size="small"
                        noSpinButtons
                        onSlChange={handleChangeLongitude}
                        value={longitude}
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
}