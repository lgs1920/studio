/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditContent.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-09
 * Last modified: 2025-12-09
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { FontAwesomeIcon }                                         from '@Components/FontAwesomeIcon'
import {
    MapPOICategorySelector,
}                                                                  from '@Components/MainUI/MapPOI/MapPOICategorySelector'
import {
    MapPOIEditMenu,
}                                                                  from '@Components/MainUI/MapPOI/MapPOIEditMenu'
import {
    faClock, faCircleCheck, faCopy, faSquareQuestion,
}                                                                  from '@fortawesome/pro-regular-svg-icons'
import {
    SlColorPicker, SlDivider, SlIcon, SlIconButton, SlInput, SlTextarea, SlTooltip,
}                                                                  from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                   from '@Utils/FA2SL'
import { UIToast }                                                 from '@Utils/UIToast'
import { ELEVATION_UNITS, IMPERIAL, UnitUtils }                    from '@Utils/UnitUtils'
import classNames                                                  from 'classnames'
import parse                                                       from 'html-react-parser'
import { DateTime }                                                from 'luxon'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                             from 'valtio'

// Pre-calculated icons
const ICON_COPY = FA2SL.set(faCopy)
const ICON_HELP = FA2SL.set(faSquareQuestion)
const ICON_COPIED = FA2SL.set(faCircleCheck)

/**
 * Edit content for a POI using only its ID to ensure instant reactivity with Valtio.
 * Avoids any stale data or double rendering issues.
 *
 * @param {Object} props
 * @param {string} props.poi - The ID of the POI to edit
 * @returns {JSX.Element|null}
 */
export const MapPOIEditContent = memo(({poi}) => {
    const $pois = lgs.stores.main.components.pois
    const {list} = useSnapshot($pois)
    const unitSystem = lgs.settings.unitSystem.current
    const swatchesList = lgs.settings.getSwatches.list

    // Always fresh data from Valtio snapshot — no ref, no stale, no flicker
    const $poi = lgs.stores.main.components.pois.list.get(poi)

    const point = useSnapshot($poi)
    if (!point) {
        return null
    }

    const {
              id          = poi,
              title       = '',
              description = '',
              latitude,
              longitude,
              height,
              simulatedHeight,
              color,
              bgColor,
              time,
              visible     = true,
          } = point

    const [simulated, setSimulated] = useState(!height || height === simulatedHeight)

    const _poiColor = useRef(null)
    const _poiBgColor = useRef(null)
    const _copyCoordinates = useRef(null)
    const [copied, setCopied] = useState(false)


    // Dependencies are stable: poi never changes, unitSystem is proxied
    const handleChangeAltitude = useCallback(async (event) => {
        if (!window.isOK) {
            return
        }
        const value = event.target.valueAsNumber
        const meters = unitSystem === IMPERIAL ? UnitUtils.convertFeetToMeters(value) : value
        const updated = await __.ui.poiManager.updatePOI(poi, {height: meters})
        setSimulated(!updated.height || updated.height === updated.simulatedHeight)
    }, [poi, unitSystem])

    const handleChangeColor = useCallback(async (event) => {
        if (!window.isOK) {
            return
        }
        const update = {}
        if (event.target === _poiColor.current) {
            update.color = event.target.value
        }
        if (event.target === _poiBgColor.current) {
            update.bgColor = event.target.value
        }
        if (Object.keys(update).length > 0) {
            await __.ui.poiManager.updatePOI(poi, update)
        }
    }, [poi])

    const makeCoordHandler = useCallback((key) => async (event) => {
        if (window.isOK) {
            await __.ui.poiManager.updatePOI(poi, {[key]: event.target.valueAsNumber})
        }
    }, [poi])

    const handleChangeLatitude = makeCoordHandler('latitude')
    const handleChangeLongitude = makeCoordHandler('longitude')
    const handleChangeTitle = useCallback(async (event) => {
        if (window.isOK) {
            await __.ui.poiManager.updatePOI(poi, {title: event.target.value})
        }
    }, [poi])
    const handleChangeDescription = useCallback(async (event) => {
        if (window.isOK) {
            await __.ui.poiManager.updatePOI(poi, {description: event.target.value})
        }
    }, [poi])

    const handleCopy = useCallback(() => {
        __.ui.poiManager.copyCoordinatesToClipboard({
                                                        id:        poi,
                                                        title:     $poi.title ?? '',
                                                        latitude:  $poi.latitude ?? '',
                                                        longitude: $poi.longitude ?? '',
                                                    }).then(() => {
            setCopied(true)
            setTimeout(() => {
                setCopied(false)
            }, 1500)

            UIToast.success({
                                caption: $poi.title ?? 'POI',
                                text:    'Coordinates copied<br/>Format: latitude, longitude',
                            })


        })
    }, [poi, $poi.title, $poi.latitude, $poi.longitude])

    const swatches = useMemo(() => swatchesList.join(';'), [swatchesList, poi.id])

    useEffect(() => {
        setSimulated(!height || height === simulatedHeight)
    }, [height, simulatedHeight])

    const altitudeInput = useMemo(() => (
        <div className="map-poi-edit-row-coordinates">
            <div className="map-poi-edit-item label-on-left">
                {simulated ? 'Simulated alt.' : 'Altitude'}
            </div>
            <SlInput
                className={classNames('map-poi-edit-item', 'map-poi', {'map-poi-edit-warning-altitude': simulated})}
                size="small"
                type="number"
                value={Math.round(height ?? simulatedHeight ?? 0)}
                onSlInput={handleChangeAltitude}
                onSlChange={handleChangeAltitude}
                disabled={!point.visible}
            >
                <span slot="suffix">{parse(ELEVATION_UNITS[unitSystem])}</span>
            </SlInput>
            {simulated && point.visible && (
                <SlTooltip content="Enter the real altitude to replace the simulated value.">
                    <SlIconButton library="fa" name={ICON_HELP}/>
                </SlTooltip>
            )}
        </div>
    ), [simulated, height, point.visible, simulatedHeight, unitSystem, handleChangeAltitude])

    return (
        <>
            <SlDivider/>
            <div className="edit-map-poi-wrapper" id={`edit-map-poi-content-${id}`}>
                <div className="map-poi-color-actions">
                    {point.visible &&
                        <>
                            <SlTooltip content="Background Color">
                                <SlColorPicker
                                    size="small"
                                    value={bgColor ?? lgs.colors.poiDefaultBackground}
                                    swatches={swatches}
                                    onSlChange={handleChangeColor}
                                    disabled={!visible}
                                    noFormatToggle
                                    ref={_poiBgColor}
                                    hoist
                                />
                            </SlTooltip>
                            <SlTooltip content="Foreground Color">
                                <SlColorPicker
                                    size="small"
                                    value={color ?? lgs.colors.poiDefault}
                                    swatches={swatches}
                                    onSlChange={handleChangeColor}
                                    disabled={!visible}
                                    noFormatToggle
                                    ref={_poiColor}
                                    hoist
                                />
                            </SlTooltip>
                        </>
                    }
                    <MapPOIEditMenu point={point}/>
                </div>

                <SlInput
                    size="small"
                    value={title}
                    onSlChange={handleChangeTitle}
                    className="edit-title-map-poi-input"
                    label="Title"
                    disabled={!point.visible}
                />
                {point.visible &&
                    <MapPOICategorySelector point={point}/>
                }

                <SlTextarea
                    size="small"
                    value={description}
                    onSlChange={handleChangeDescription}
                    className="edit-title-map-poi-input"
                    label="Description"
                    disabled={!point.visible}
                />

                {time && (
                    <div className="poi-time">
                        <FontAwesomeIcon icon={faClock}/>
                        {DateTime.fromISO(time).toLocaleString(DateTime.DATE_FULL)} - {DateTime.fromISO(time).toLocaleString(DateTime.TIME_SIMPLE)}
                    </div>
                )}

                <div className="map-poi-edit-row-coordinates">
                    <SlInput
                        size="small"
                        type="number"
                        step="any"
                        noSpinButtons
                        value={latitude ?? ''}
                        onSlChange={handleChangeLatitude}
                        label="Latitude"
                        disabled={!point.visible}
                    />
                    <SlInput
                        size="small"
                        type="number"
                        step="any"
                        noSpinButtons
                        value={longitude ?? ''}
                        onSlChange={handleChangeLongitude}
                        label="Longitude"
                        disabled={!point.visible}
                    />
                    <SlTooltip content="Copy Coordinates">
                        <SlIconButton onClick={handleCopy} library="fa"
                                      name={copied ? ICON_COPIED : ICON_COPY}
                                      className={classNames({'altitude-copied': copied})}/>
                    </SlTooltip>
                </div>

                {altitudeInput}
            </div>
        </>
    )
}, (prev, next) => prev.poi === next.poi)