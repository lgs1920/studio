/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIEditContent.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-19
 * Last modified: 2025-05-19
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { FontAwesomeIcon }             from '@Components/FontAwesomeIcon'
import {
    MapPOICategorySelector,
}                                      from '@Components/MainUI/MapPOI/MapPOICategorySelector'
import {
    MapPOIEditMenu,
}                                      from '@Components/MainUI/MapPOI/MapPOIEditMenu'
import {
    faCopy, faSquareQuestion,
}                                                                    from '@fortawesome/pro-regular-svg-icons'
import {
    SlColorPicker, SlDivider, SlIconButton, SlInput, SlTextarea, SlTooltip,
}                                                                    from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                     from '@Utils/FA2SL'
import { UIToast }                                                   from '@Utils/UIToast'
import { ELEVATION_UNITS, foot, IMPERIAL, INTERNATIONAL, UnitUtils } from '@Utils/UnitUtils'
import Color                           from 'color'
import classNames                                                    from 'classnames'
import parse                                                         from 'html-react-parser'
import { useEffect, useState, useRef } from 'react'
import { useSnapshot }                                               from 'valtio/index'

export const MapPOIEditContent = ({poi}) => {

    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    let point = pois.list.get(poi.id)
    const [simulated, setSimulated] = useState(false)
    const poiColor = useRef(null)
    const poiBgColor = useRef(null)

    const handleChangeAltitude = async event => {
        const height = event.target.value * 1
        Object.assign(lgs.mainProxy.components.pois.list.get(point.id), {
            height: lgs.settings.unitSystem.current === IMPERIAL ? UnitUtils.convertFeetToMeters(height) : height,
        })
        await __.ui.poiManager.persistToDatabase(__.ui.poiManager.list.get(point.id))
        setSimulated(point.height === point.simulatedHeight)
    }

    const handleChangeColor = async event => {
        $pois.current = point.id
        if (event.target === poiColor.current) {
            Object.assign(lgs.mainProxy.components.pois.list.get(point.id), {
                color: event.target.value,
            })
        }
        if (event.target === poiBgColor.current) {
            __.ui.poiManager.list.get(point.id).color = __.ui.ui.hslaString2Hex(__.ui.css.getCSSVariable(__.ui.ui.colorContrast(event.target.value)))
            Object.assign(lgs.mainProxy.components.pois.list.get(point.id), {
                bgColor: event.target.value,
                color:   __.ui.poiManager.list.get(point.id).color,
            })

        }
        await __.ui.poiManager.persistToDatabase(__.ui.poiManager.list.get(point.id))

        event.preventDefault()
        event.stopPropagation()
    }

    const handleChangeLatitude = async event => {
        $pois.current = point.id
        Object.assign(lgs.mainProxy.components.pois.list.get(point.id), {
            latitude: event.target.value * 1,
        })
        await __.ui.poiManager.persistToDatabase(__.ui.poiManager.list.get(point.id))
    }

    const handleChangeLongitude = async event => {
        $pois.current = point.id
        Object.assign(lgs.mainProxy.components.pois.list.get(point.id), {
            longitude: event.target.value * 1,
        })
        await __.ui.poiManager.persistToDatabase(__.ui.poiManager.list.get(point.id))
    }

    const handleChangeTitle = async event => {
        if (window.isOK) {
            $pois.current = point.id
            Object.assign(lgs.mainProxy.components.pois.list.get(point.id), {
                title: event.target.value,
            })
            await __.ui.poiManager.persistToDatabase(__.ui.poiManager.list.get(point.id))
        }
    }

    const handleChangeDescription = async event => {
        if (window.isOK) {
            $pois.current = point.id
            Object.assign(lgs.mainProxy.components.pois.list.get(point.id), {
                description: event.target.value,
            })
            await __.ui.poiManager.persistToDatabase(__.ui.poiManager.list.get(point.id))
        }
    }
    /**
     * Copies the coordinates (latitude,longitude of the currently selected point of interest (POI) to the clipboard.
     *
     * Postconditions:
     * - The context menu is hidden.
     */
    const handleCopy = () => {
        __.ui.poiManager.copyCoordinatesToClipboard(point)
            .then(() => {
                UIToast.success({
                                    caption: `${point.title}`,
                                    text:    'Coordinates copied to the clipboard <br/>under the form: latitude, longitude',
                                })
            })
    }

    useEffect(() => {
        if (point && pois.current) {
            setSimulated(point.height === undefined || point.height === point.simulatedHeight)
        }

    }, [point])

    // Bail if point does not exist
    if (!point) {
        return false
    }

    const altitude = lgs.settings.unitSystem.current === INTERNATIONAL
                     ? point?.height || point?.simulatedHeight
                     : __.convert(point?.height || point?.simulatedHeight).to(foot)


    return (

        <>
            <SlDivider/>
            <div className="edit-map-poi-wrapper">

                <div className={'map-poi-color-actions'}>
                    <SlTooltip content={'Background Color'}>
                    <SlColorPicker size={'small'}
                                   label={'Color'}
                                   value={point?.bgColor ?? lgs.colors.poiDefaultBackground}
                                   swatches={lgs.settings.getSwatches.list.join(';')}
                                   onSlChange={handleChangeColor}
                                   onSlInput={handleChangeColor}
                                   disabled={!point?.visible}
                                   noFormatToggle
                                   ref={poiBgColor}
                    />
                    </SlTooltip>
                    <SlTooltip content={'Foreground Color'}>
                        <SlColorPicker size={'small'}
                                       label={'Color'}
                                       value={point?.color ?? lgs.colors.poiDefault}
                                       swatches={lgs.settings.getSwatches.list.join(';')}
                                       onSlChange={handleChangeColor}
                                       onSlInput={handleChangeColor}
                                       disabled={!point?.visible}
                                       noFormatToggle
                                       ref={poiColor}

                        />
                    </SlTooltip>
                    <MapPOIEditMenu point={point}/>
                </div>

                <div>
                    <SlInput size="small" value={point.title}
                             onSlChange={handleChangeTitle}
                             onInput={handleChangeTitle}
                             className="edit-title-map-poi-input">
                        <span slot="label" className="edit-title-map-poi">{'Title'}</span>
                    </SlInput>
                </div>
                <MapPOICategorySelector point={point}/>

                <div>
                    <SlTextarea size="small" value={point.description ?? ''}
                                onSlChange={handleChangeDescription}
                                onInput={handleChangeDescription}
                                className="edit-title-map-poi-input">
                        <span slot="label" className="edit-title-map-poi">{'Description'}</span>
                    </SlTextarea>
                </div>

                <div className="map-poi-edit-row">
                    <SlTooltip content={'Copy Coordinates'}>
                        <SlIconButton className="edit-poi-copy-coordinates" onClick={handleCopy}
                                      library="fa" name={FA2SL.set(faCopy)}/>
                    </SlTooltip>
                    <SlInput className={'map-poi-edit-item'} size="small" noSpinButtons
                             onSlChange={handleChangeLatitude}
                             value={__.convert(point.latitude).to(lgs.settings.coordinateSystem.current)}
                             label={'Latitude'} readonly/>
                    <SlInput className={'map-poi-edit-item'} size="small" noSpinButtons
                             onSlChange={handleChangeLongitude}
                             value={__.convert(point.longitude).to(lgs.settings.coordinateSystem.current)}
                             label={'Longitude'} readonly/>
                    <SlInput
                        className={classNames('map-poi-edit-item map-poi', simulated ? 'map-poi-edit-warning-altitude' : '')}
                        size="small" type="number"
                        onSlChange={handleChangeAltitude}
                        onSlInput={handleChangeAltitude}
                        value={Math.round(altitude).toString()}
                    >
                        <div slot={'label'}>
                            {simulated ?
                             <>
                                 {'Simulated alt. '}
                                 <SlTooltip content={'Enter the actual altitude to end the simulation.'}>
                                             <span>
                                             <FontAwesomeIcon icon={faSquareQuestion}/>
                                             </span>
                                 </SlTooltip>
                             </>
                                       : <>{'Altitude'}</>
                            }
                        </div>

                        <span slot="suffix">{parse(ELEVATION_UNITS[lgs.settings.unitSystem.current] + '&nbsp;')}</span>
                    </SlInput>
                </div>

            </div>
        </>


    )
}