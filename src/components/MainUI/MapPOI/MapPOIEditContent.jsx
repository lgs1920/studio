/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditContent.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-15
 * Last modified: 2025-06-15
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { FontAwesomeIcon }                           from '@Components/FontAwesomeIcon'
import {
    MapPOICategorySelector,
}                                                    from '@Components/MainUI/MapPOI/MapPOICategorySelector'
import {
    MapPOIEditMenu,
}                                                    from '@Components/MainUI/MapPOI/MapPOIEditMenu'
import {
    faClock, faCopy, faSquareQuestion,
}                                                    from '@fortawesome/pro-regular-svg-icons'
import {
    SlColorPicker, SlDivider, SlIconButton, SlInput, SlTextarea, SlTooltip,
}                                                    from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                     from '@Utils/FA2SL'
import { UIToast }                                   from '@Utils/UIToast'
import { ELEVATION_UNITS, foot, IMPERIAL, INTERNATIONAL, UnitUtils } from '@Utils/UnitUtils'
import classNames                                    from 'classnames'
import parse                                         from 'html-react-parser'
import { DateTime }                                  from 'luxon'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSnapshot }                               from 'valtio'

// Pre-calculated icon
const ICON_COPY = FA2SL.set(faCopy)
const ICON_HELP = FA2SL.set(faSquareQuestion)


/**
 * A React component for editing the content of a Point of Interest (POI).
 * @param {Object} props - Component props
 * @param {Object} props.poi - The POI object to edit
 * @returns {JSX.Element|null} The rendered edit content or null if no POI
 */
export const MapPOIEditContent = (({poi}) => {
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    const settings = lgs.settings

    // Stabilize point based on poi.id
    const point = useMemo(() => pois.list.get(poi.id), [poi.id, pois.list])

    const [simulated, setSimulated] = useState(point?.height === undefined || point?.height === point?.simulatedHeight)

    // Memoized altitude calculation
    const altitude = useMemo(() => {
        const height = point?.height || point?.simulatedHeight
        return settings.unitSystem.current === INTERNATIONAL
               ? height
               : __.convert(height).to(foot)
    }, [point?.height, point?.simulatedHeight, settings.unitSystem.current])

    // Memoized swatches
    const swatches = useMemo(() => settings.getSwatches.list.join(';'), [settings.getSwatches.list])

    // Memoized coordinate conversions
    const latitude = useMemo(() => __.convert(point?.latitude).to(settings.coordinateSystem.current), [point?.latitude, settings.coordinateSystem.current])
    const longitude = useMemo(() => __.convert(point?.longitude).to(settings.coordinateSystem.current), [point?.longitude, settings.coordinateSystem.current])

    // Memoized event handlers
    const handleChangeAltitude = async (event) => {
        if (window.isOK) {
            const height = event.target.value * 1
            const newPoint = {
                ...$pois.list.get(point.id),
                height: settings.unitSystem.current === IMPERIAL ? UnitUtils.convertFeetToMeters(height) : height,
            }
            $pois.list.set(point.id, newPoint)
            await __.ui.poiManager.persistToDatabase(newPoint)
            setSimulated(newPoint.height === newPoint.simulatedHeight)
        }
    }

    const handleChangeColor = async (event, type) => {
        const value = event.target.value
        const newPoint = {
            ...$pois.list.get(point.id),
            [type]: value,
        }
        $pois.list.set(point.id, newPoint)

        if ($pois.filtered.global.has(point.id)) {
            $pois.filtered.global.set(point.id, {
                ...$pois.filtered.global.get(point.id),
                color:   newPoint.color,
                bgColor: newPoint.bgColor,
            })
        }
        if ($pois.filtered.journey.has(point.id)) {
            $pois.filtered.journey.set(point.id, {
                ...$pois.filtered.journey.get(point.id),
                color:   newPoint.color,
                bgColor: newPoint.bgColor,
            })
        }
        await __.ui.poiManager.persistToDatabase(newPoint)

        event.preventDefault()
        event.stopPropagation()
    }

    const handleChangeLatitude = async (event) => {
        const newPoint = {
            ...$pois.list.get(point.id),
            latitude: event.target.value * 1,
        }
        $pois.list.set(point.id, newPoint)
        await __.ui.poiManager.persistToDatabase(newPoint)
    }

    const handleChangeLongitude = async (event) => {
        if (window.isOK) {
            const newPoint = {
                ...$pois.list.get(point.id),
                longitude: event.target.value * 1,
            }
            $pois.list.set(point.id, newPoint)
            await __.ui.poiManager.persistToDatabase(newPoint)
        }
    }

    const handleChangeTitle = async (event) => {
        if (window.isOK) {
            const newPoint = {
                ...$pois.list.get(point.id),
                title: event.target.value,
            }
            $pois.list.set(point.id, newPoint)
            await __.ui.poiManager.persistToDatabase(newPoint)
        }
    }

    const handleChangeDescription = useCallback(async (event) => {
        if (window.isOK) {
            const newPoint = {
                ...$pois.list.get(point.id),
                description: event.target.value,
            }
            $pois.list.set(point.id, newPoint)
            await __.ui.poiManager.persistToDatabase(newPoint)
        }
    }, [point.id, $pois])

    const handleCopy = useCallback(() => {
        __.ui.poiManager.copyCoordinatesToClipboard(point).then(() => {
            UIToast.success({
                                caption: `${point.title}`,
                                text:    'Coordinates copied to the clipboard <br/>under the form: latitude, longitude',
                            })
        })
    }, [point])

    // Optimize useEffect
    useEffect(() => {
        if (point && pois.current) {
            setSimulated(point.height === undefined || point.height === point.simulatedHeight)
        }
    }, [point?.height, point?.simulatedHeight, pois.current])

    // Bail if point does not exist
    if (!point) {
        return null
    }

    // Memoized altitude input
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
            <SlTooltip content={'Enter the actual altitude to end the simulation.'} className={'tooltip-help'}>
                <SlIconButton
                    className="edit-poi-copy-coordinates"
                    library="fa"
                    name={ICON_HELP}
                />
            </SlTooltip>
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
})