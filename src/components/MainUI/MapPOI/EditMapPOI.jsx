/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 *
 * File: EditMapPOI.jsx
 * Path: /home/christian/devs/assets/lgs1920/studio/src/components/MainUI/MapPOI/EditMapPOI.jsx
 *
 * Author : Christian Denat
 * email: christian.denat@orange.fr
 *
 * Created on: 2025-02-22
 * Last modified: 2025-02-22
 *
 *
 * Copyright © 2025 LGS1920
 *
 ******************************************************************************/

import { MapPOIEditMenu }                               from '@Components/MainUI/MapPOI/MapPOIEditMenu'
import { faSquareQuestion }                             from '@fortawesome/pro-regular-svg-icons'
import { FontAwesomeIcon }                              from '@fortawesome/react-fontawesome'
import { SlColorPicker, SlDivider, SlInput, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { UIUtils }                                      from '@Utils/UIUtils'
import { ELEVATION_UNITS }                              from '@Utils/UnitUtils'
import classNames                                       from 'classnames'
import { useEffect, useState }                          from 'react'
import { useSnapshot }                                  from 'valtio'

export const EditMapPOI = ({poi}) => {

    const pois = useSnapshot(lgs.mainProxy.components.pois)
    const point = pois.list.get(poi.id)
    const [active, setActive] = useState(false)
    const [simulated, setSimulated] = useState(false)

    const handleChangeAltitude = event => {
        Object.assign(lgs.mainProxy.components.pois.list.get(point.id), {
            height:          event.target.value * 1,
            simulatedHeight: undefined,
        })
    }

    const handleChangeColor = async event => {
        Object.assign(lgs.mainProxy.components.pois.list.get(point.id), {
            color: event.target.value,
        })
        await __.ui.poiManager.saveInDB(__.ui.poiManager.list.get(point.id))

        event.preventDefault()
        event.stopPropagation()
    }

    const handleChangeLatitude = async event => {
        Object.assign(lgs.mainProxy.components.pois.list.get(point.id), {
            latitude: event.target.value * 1,
        })
        await __.ui.poiManager.saveInDB(__.ui.poiManager.list.get(point.id))
    }

    const handleChangeLongitude = async event => {
        Object.assign(lgs.mainProxy.components.pois.list.get(point.id), {
            longitude: event.target.value * 1,
        })
        await __.ui.poiManager.saveInDB(__.ui.poiManager.list.get(point.id))
    }

    const handleChangeTitle = async event => {
        if (window.isOK) {
            Object.assign(lgs.mainProxy.components.pois.list.get(point.id), {
                title: event.target.value,
            })
            await __.ui.poiManager.saveInDB(__.ui.poiManager.list.get(point.id))
        }
    }

    useEffect(() => {
        if (pois.current) {
            setActive(pois.current.id === poi.id)
            setSimulated(point.simulatedHeight !== undefined)
        }

    }, [pois.current, point])

    return (
        <>
            {active &&
                <>
                    <SlDivider/>
                    <div className="edit-map-poi-wrapper">

                        <div className={'map-poi-color-actions'}>
                            <SlColorPicker size={'small'}
                                           label={'Color'}
                                           value={point.color}
                                           swatches={lgs.settings.getSwatches.list.join(';')}
                                           onSlChange={handleChangeColor}
                                           onSlInput={handleChangeColor}
                                           disabled={!point.visible}
                                           noFormatToggle
                            />
                            <MapPOIEditMenu/>
                        </div>
                        <div>

                            <SlInput size="small" value={point.title} onSlChange={handleChangeTitle}
                                     className="edit-title-map-poi-input">
                                <span slot="label" className="edit-title-map-poi">{'Title'}</span>
                            </SlInput>
                        </div>

                        <div className={'map-poi-edit-row'}>
                            <SlInput className={'map-poi-edit-item'} size="small" type="number" noSpinButtons
                                     onSlChange={handleChangeLatitude}
                                     value={sprintf('%.5f', point.latitude)}
                                     pattern={'^-?(90(\.0+)?|[1-8]?\d(\.\d+)?)$'}
                                     label={'Latitude'} readonly/>
                            <SlInput className={'map-poi-edit-item'} size="small" type="number" noSpinButtons
                                     onSlChange={handleChangeLongitude}
                                     value={sprintf('%.5f', point.longitude)}
                                     pattern={/^-?(180(\.0+)?|1[0-7]?\d(\.\d+)?|0?\d{1,2}(\.\d+)?)$/}
                                     label={'Longitude'} readonly/>
                            <SlInput
                                className={classNames('map-poi-edit-item', simulated ? 'map-poi-edit-warning-altitude' : '')}
                                size="small" onSlChange={handleChangeAltitude} type="number"
                                pattern={/^\d+$/} min="0" max="8850"
                                value={Math.round(point.height | point.simulatedHeight)}
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

                                <span slot="suffix">{ELEVATION_UNITS[lgs.settings.unitSystem.current]}</span>
                            </SlInput>
                        </div>

                        <div className="map-poi-edit-row">
                            <SlInput className={'map-poi-edit-item'} size="small"
                                     value={UIUtils.toDMS(point.latitude)}
                                     readonly/>
                            <SlInput className={'map-poi-edit-item'} size="small"
                                     value={UIUtils.toDMS(point.longitude)}
                                     readonly/>
                            <span className="map-poi-edit-item"></span>
                        </div>
                    </div>
                </>}
        </>

    )
}