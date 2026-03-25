/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditContent.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-25
 * Last modified: 2026-03-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    MapPOICategorySelector,
}                                                                  from '@Components/MainUI/MapPOI/MapPOICategorySelector'
import {
    MapPOIEditMenu,
}                                                                  from '@Components/MainUI/MapPOI/MapPOIEditMenu'
import { POI_STANDARD_TYPE, POI_TMP_TYPE }                         from '@Core/constants'

import { UIToast }                                                 from '@Utils/UIToast'
import { ELEVATION_UNITS, IMPERIAL, UnitUtils } from '@Utils/UnitUtils'
import {
    WaButton, WaCallout, WaColorPicker, WaDivider, WaIcon, WaInput, WaTextarea, WaTooltip,
}                                               from '@web.awesome.me/webawesome-pro/dist/react'
import classNames                               from 'classnames'
import parse                                                       from 'html-react-parser'
import { DateTime }                                                from 'luxon'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                             from 'valtio'

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
        event.stopPropagation()
        event.preventDefault()

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

    const handleAddToLibrary = useCallback(async () => {
        await __.ui.poiManager.updatePOI(poi, {type: POI_STANDARD_TYPE})
    })

    const swatches = useMemo(() => swatchesList.join(';'), [swatchesList, poi.id])

    useEffect(() => {
        setSimulated(!height || height === simulatedHeight)
    }, [height, simulatedHeight])

    const altitudeInput = useMemo(() => (
        <div className="map-poi-edit-row-coordinates">
            <div className="map-poi-edit-item label-on-left">
                {simulated ? 'Simulated alt.' : 'Altitude'}
            </div>
            <WaInput
                className={classNames('map-poi-edit-item', 'map-poi', {'map-poi-edit-warning-altitude': simulated})}
                size="small"
                withoutSpinButtons
                type="number" inputMode="numeric"
                value={Math.round(height ?? simulatedHeight ?? 0)}
                onInput={handleChangeAltitude}
                onChange={handleChangeAltitude}
                disabled={!point.visible}
            >
                <span slot="end">{parse(ELEVATION_UNITS[unitSystem])}</span>
            </WaInput>
            {simulated && point.visible && (
                <>
                    <WaTooltip content="Enter the real altitude to replace the simulated value."></WaTooltip>
                    <WaIcon name="circle-help" variant="regular"/>
                </>
            )}
        </div>
    ), [simulated, height, point.visible, simulatedHeight, unitSystem, handleChangeAltitude])
    return (
        <>
            <WaDivider/>

            {point.type === POI_TMP_TYPE &&
                <WaCallout variant="warning" className="edit-map-poi-warning" open>
                    <WaIcon slot="icon" variant="regular" name="location-exclamation"/>
                    <div>
                        {'This POI is temporary and won\'t be saved. Add it to the library to save it.'}
                        <WaButton size="small" slot="end" variant="warning" onClick={handleAddToLibrary}>
                            <WaIcon slot="start" name="location-dot" variant="regular"/>{'Add it'}
                        </WaButton>
                    </div>
                </WaCallout>
            }

            <div className="edit-map-poi-wrapper" id={`edit-map-poi-content-${id}`}>
                <WaInput
                    size="small"
                    value={title}
                    onChange={handleChangeTitle}
                    className="edit-title-map-poi-input"
                    readOnly={!point.visible}
                >
                    <div className="map-poi-header-actions" slot="label">
                        {'Title'}
                        <div>
                            {point.visible &&
                                <>
                                    <WaTooltip for={`map-poi-bg-${poi.id}`}>{'Background Color'}</WaTooltip>
                                    <WaColorPicker
                                        id={`map-poi-bg-${poi.id}`}
                                        size="small"
                                        value={bgColor ?? lgs.colors.poiDefaultBackground}
                                        swatches={swatches}
                                        onChange={handleChangeColor}
                                        disabled={!visible}
                                        noFormatToggle
                                        ref={_poiBgColor}
                                        hoist
                                    />

                                    <WaTooltip for={`map-poi-fg-${poi.id}`}>{'Foreground Color'}</WaTooltip>
                                    <WaColorPicker
                                        id={`map-poi-fg-${poi.id}`}
                                        size="small"
                                        value={color ?? lgs.colors.poiDefault}
                                        swatches={swatches}
                                        onChange={handleChangeColor}
                                        disabled={!visible}
                                        noFormatToggle
                                        ref={_poiColor}
                                        hoist
                                    />

                                </>
                            }
                            <MapPOIEditMenu poiId={id}/>
                        </div>
                    </div>
                </WaInput>
                {point.visible &&
                    <MapPOICategorySelector point={point}/>
                }

                <WaTextarea
                    size="small"
                    value={description}
                    onChange={handleChangeDescription}
                    className="edit-title-map-poi-input"
                    label="Description"
                    disabled={!point.visible}
                />

                {time && (
                    <div className="poi-time">
                        <WaIcon name="clock" variant="regular"/>
                        &nbsp;{DateTime.fromISO(time).toLocaleString(DateTime.DATE_FULL)} - {DateTime.fromISO(time).toLocaleString(DateTime.TIME_SIMPLE)}
                    </div>
                )}

                <div className="map-poi-edit-row-coordinates">
                    <WaInput
                        size="small"
                        type="number" inputMode="decimal"
                        step="any"
                        withoutSpinButtons
                        value={latitude ?? ''}
                        onChange={handleChangeLatitude}
                        label="Latitude"
                        disabled={!point.visible}
                    />
                    <WaInput
                        size="small"
                        type="number" inputMode="decimal"
                        step="any"
                        withoutSpinButtons
                        value={longitude ?? ''}
                        onChange={handleChangeLongitude}
                        label="Longitude"
                        disabled={!point.visible}
                    />
                    <WaTooltip for="ma-poi-copy-coordinates">{'Copy Coordinates'}</WaTooltip>
                    <WaButton size="small"
                              variant={copied ? 'success' : 'brand'}
                              onClick={handleCopy}
                              id="ma-poi-copy-coordinates">
                        <WaIcon name={copied ? 'circle-check' : 'copy'}
                                variant={'regular'}
                                className={classNames({'altitude-copied': copied})}/>
                    </WaButton>
                </div>

                {altitudeInput}
            </div>
        </>
    )
}, (prev, next) => prev.poi === next.poi)
