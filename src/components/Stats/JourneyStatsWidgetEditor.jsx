/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyStatsWidgetEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-18
 * Last modified: 2026-02-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyStatsWidgetEditor.jsx
 *
 ******************************************************************************/

import { DurationInput }                                            from '@Components/MainUI/DurationInput'
import { JourneyMetricsInput }                                      from '@Components/MainUI/JourneyMetricsInput'
import { LGSScrollbars }                                            from '@Components/MainUI/LGSScrollbars'
import {
    BackgroundElement,
}                                                                   from '@Components/MainUI/widgets/editor/elements/BackgroundElement'
import {
    BorderElement,
}                                                                   from '@Components/MainUI/widgets/editor/elements/BorderElement'
import {
    RotationElement,
}                                                                   from '@Components/MainUI/widgets/editor/elements/RotationElement'
import {
    ShadowElement,
}                                                                   from '@Components/MainUI/widgets/editor/elements/ShadowElement'
import { faPenPaintbrush, faTableList }                             from '@fortawesome/pro-regular-svg-icons'
import {
    SlButton, SlButtonGroup, SlColorPicker, SlDivider, SlIcon, SlRange, SlSwitch, SlTab, SlTabGroup, SlTabPanel,
}                                                           from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                    from '@Utils/FA2SL'
import { DISTANCE_UNITS, ELEVATION_UNITS, PACE_UNITS, SPEED_UNITS } from '@Utils/UnitUtils'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { subscribe, useSnapshot }                           from 'valtio'

export const JourneyStatsWidgetEditor = ({entity}) => {
    const $unitSystem = lgs.settings.unitSystem
    const unitSystem = useSnapshot($unitSystem).current

    const $metrics = lgs.theJourney.metrics
    const metricsSnap = useSnapshot($metrics)

    const [activeTab, setActiveTab] = useState('style')
    const [localRotation, setLocalRotation] = useState(0)

    const _moveable = __.ui.widgetManager.getMoveable(entity)
    const widget = __.ui.widgetManager.getElementById(entity)

    const $widgetStore = lgs.stores.ui.widget
    const widgetStore = useSnapshot($widgetStore)

    const $configuration = lgs.settings.widgets['journey-stats-widget'].configuration
    const configuration = useSnapshot($configuration)
    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])

    const element = useMemo(() => {
        return configuration.elements?.[entity] ?? configuration.user ?? configuration.default
    }, [configuration, entity])

    const dataSource = element.dataSource || 'global'

    const units = useMemo(() => ({
        elevation: ELEVATION_UNITS[unitSystem],
        distance:  DISTANCE_UNITS[unitSystem],
        pace:      PACE_UNITS[unitSystem],
        speed: SPEED_UNITS[unitSystem],
    }), [unitSystem])

    const updateValue = useCallback((path, val) => {
        if (!$configuration.elements) {
            $configuration.elements = {}
        }
        if (!$configuration.elements[entity]) {
            $configuration.elements[entity] = JSON.parse(JSON.stringify(element))
        }

        const _keys = path.split('.')
        let _curr = $configuration.elements[entity]
        for (let i = 0; i < _keys.length - 1; i++) {
            if (!_curr[_keys[i]]) {
                _curr[_keys[i]] = {}
            }
            _curr = _curr[_keys[i]]
        }
        _curr[_keys[_keys.length - 1]] = val

        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
    }, [$configuration, element, entity, _moveable])

    useEffect(() => {
        if (!$metrics?.user) {
            return
        }
        const unsub = subscribe($metrics.user, () => {
            if (Object.keys($metrics.user).length > 0 && dataSource !== 'user') {
                updateValue('dataSource', 'user')
            }
        })
        return () => unsub()
    }, [$metrics, dataSource, updateValue])

    useEffect(() => {
        const transform = __.ui.widgetManager.getTransform(widget)
        setLocalRotation(Math.ceil(widgetStore.current?.rotate ?? transform.rotate ?? 0))
    }, [widget, widgetStore.current?.rotate])

    const getColor = (item, alpha = false) => __.ui.ui.resolveItemColor(item, alpha)

    const applyRotation = async (val) => {
        const clampedVal = parseFloat(val) || 0
        setLocalRotation(clampedVal)
        const {translate, scale} = __.ui.widgetManager.getTransform(widget)
        __.ui.widgetManager.setTransform(widget, {translate, scale, rotate: clampedVal})
        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
        if ($widgetStore.current) {
            $widgetStore.current.rotate = clampedVal
        }
    }

    const hasExternal = useMemo(() => {
        const m = lgs.theJourney.getMetrics()
        return m?.external && Object.keys(m.external).length > 0
    }, [unitSystem])

    return (
        <div className="lgs-widget-editor" key={`editor-${entity}`}>
            {/* On s'assure que le TabGroup occupe l'espace nécessaire */}
            <SlTabGroup
                className="editor-tabs"
                onSlTabShow={e => setActiveTab(e.detail.name)}
            >
                <SlTab slot="nav" panel="style">
                    <SlIcon size="small" library="fa" name={FA2SL.set(faPenPaintbrush)}/> Style
                </SlTab>
                <SlTab slot="nav" panel="data">
                    <SlIcon size="small" library="fa" name={FA2SL.set(faTableList)}/> Data
                </SlTab>

                {/* Sélecteur de source déplacé en dehors du panel si nécessaire, ou intégré via slot nav */}
                {(hasExternal || (metricsSnap.user && Object.keys(metricsSnap.user).length > 0)) && (
                    <div className="source-selector-wrapper" slot="nav" style={{
                        display:      activeTab === 'data' ? 'flex' : 'none',
                        marginLeft:   'auto',
                        alignItems:   'center',
                        paddingRight: '10px',
                    }}>
                        <span style={{marginRight: '8px', fontSize: 'var(--sl-font-size-small)'}}>From</span>
                        <SlButtonGroup size="small">
                            <SlButton size="small" variant={dataSource === 'global' ? 'primary' : 'default'}
                                      onClick={() => updateValue('dataSource', 'global')}>Data</SlButton>
                            {hasExternal &&
                                <SlButton size="small" variant={dataSource === 'external' ? 'warning' : 'neutral'}
                                          onClick={() => updateValue('dataSource', 'external')}>External</SlButton>}
                            <SlButton size="small" variant={dataSource === 'user' ? 'warning' : 'default'}
                                      onClick={() => updateValue('dataSource', 'user')}>User</SlButton>
                        </SlButtonGroup>
                    </div>
                )}

                <SlTabPanel name="style">
                    <div className="lgs-widget-editor-controls-wrapper lgs-card">
                        <LGSScrollbars>
                            <div>
                                <RotationElement element={element} localRotation={localRotation}
                                                 applyRotation={applyRotation} updateValue={updateValue}/>
                                <SlDivider/>
                                <div className="drawer-horizontal-line"><span>Text color</span></div>
                                <div className="drawer-horizontal-line three-columns">
                                    <div className="drawer-horizontal-element">
                                        <SlColorPicker size="small" swatches={swatches} value={getColor(element.text)}
                                                       onSlInput={(e) => updateValue('text.color', e.target.value)}/>
                                    </div>
                                    <div className="drawer-horizontal-element xlarge-element"></div>
                                    <div className="drawer-horizontal-element xlarge-element">
                                        <SlRange label="Opacity" min="0" max="1" step="0.05" align-right tooltip="top"
                                                 tooltipFormatter={v => `${Math.floor(v * 100)}%`}
                                                 value={element.text.opacity ?? 1}
                                                 onSlInput={(e) => updateValue('text.opacity', parseFloat(e.target.value))}/>
                                    </div>
                                </div>
                                <SlDivider/>
                                <SlSwitch align-right size="x-small" checked={element.separator?.show ?? false}
                                          onSlInput={(e) => updateValue('separator.show', e.target.checked)}><span>Separator</span></SlSwitch>
                                {element.separator?.show && (
                                    <div className="drawer-horizontal-line three-columns">
                                        <div className="drawer-horizontal-element">
                                            <SlColorPicker size="small" swatches={swatches}
                                                           value={getColor(element.separator)}
                                                           onSlInput={(e) => updateValue('separator.color', e.target.value)}/>
                                        </div>
                                        <div className="drawer-horizontal-element xlarge-element"></div>
                                        <div className="drawer-horizontal-element xlarge-element">
                                            <SlRange label="Opacity" min="0" max="1" step="0.05" align-right
                                                     tooltip="top" tooltipFormatter={v => `${Math.floor(v * 100)}%`}
                                                     value={element.separator?.opacity ?? 1}
                                                     onSlInput={(e) => updateValue('separator.opacity', parseFloat(e.target.value))}/>
                                        </div>
                                    </div>
                                )}
                                <SlDivider/><ShadowElement element={element} swatches={swatches} getColor={getColor}
                                                           updateValue={updateValue}/>
                                <SlDivider/><BorderElement element={element} swatches={swatches} getColor={getColor}
                                                           updateValue={updateValue} showPill={false}/>
                                <SlDivider/><BackgroundElement element={element} swatches={swatches} getColor={getColor}
                                                               updateValue={updateValue}/>
                            </div>
                        </LGSScrollbars>
                    </div>
                </SlTabPanel>

                <SlTabPanel name="data">
                    <div className="lgs-widget-editor-controls-wrapper lgs-card">
                        <LGSScrollbars>
                            <div className="journey-stats-widget-editor-data">
                                <SlSwitch align-right size="x-small" checked={element.date ?? false}
                                          onSlInput={(e) => updateValue('date', e.target.checked)}><span>Date</span></SlSwitch>
                                <SlDivider/>
                                <div className="drawer-horizontal-line three-columns">
                                    <div className="drawer-horizontal-element"><JourneyMetricsInput
                                        label={`Distance (${units.distance})`} path="distance" unit={units.distance}
                                        dataSource={dataSource}/></div>
                                    <div className="drawer-horizontal-element"><JourneyMetricsInput
                                        label={`Elevation (${units.elevation})`} path="positive.elevation"
                                        unit={units.elevation} precision={0} dataSource={dataSource}/></div>
                                    <div className="drawer-horizontal-element"><DurationInput label="Duration"
                                                                                              path="duration"
                                                                                              dataSource={dataSource}/>
                                    </div>
                                </div>
                                <SlDivider/>
                                <SlSwitch align-right size="x-small" checked={element.altitude ?? false}
                                          onSlInput={(e) => updateValue('altitude', e.target.checked)}><span>Altitude</span></SlSwitch>
                                {element.altitude && (
                                    <div className="drawer-horizontal-line three-columns">
                                        <div
                                            className="drawer-horizontal-element">{`Altitude (${units.elevation})`}</div>
                                        <div className="drawer-horizontal-element"><JourneyMetricsInput label="Min"
                                                                                                        path="minHeight"
                                                                                                        unit={units.elevation}
                                                                                                        precision={0}
                                                                                                        dataSource={dataSource}/>
                                        </div>
                                        <div className="drawer-horizontal-element"><JourneyMetricsInput label="Max"
                                                                                                        path="maxHeight"
                                                                                                        unit={units.elevation}
                                                                                                        precision={0}
                                                                                                        dataSource={dataSource}/>
                                        </div>
                                    </div>
                                )}
                                <SlDivider/>
                                <SlSwitch align-right size="x-small" checked={element.performance ?? false}
                                          onSlInput={(e) => updateValue('performance', e.target.checked)}><span>Speed/Pace</span></SlSwitch>
                                {element.performance && (
                                    <div className="journey-stats-widget-editor-performance">
                                        <div className="drawer-horizontal-line three-columns">
                                            <div className="drawer-horizontal-element">{`Speed (${units.speed})`}</div>
                                            <div className="drawer-horizontal-element"><JourneyMetricsInput label="Avg"
                                                                                                            path="averageSpeed"
                                                                                                            unit={units.speed}
                                                                                                            precision={1}
                                                                                                            dataSource={dataSource}/>
                                            </div>
                                            <div className="drawer-horizontal-element"><JourneyMetricsInput label="Max"
                                                                                                            path="maxSpeed"
                                                                                                            unit={units.speed}
                                                                                                            precision={1}
                                                                                                            dataSource={dataSource}/>
                                            </div>
                                        </div>
                                        <div className="drawer-horizontal-line three-columns">
                                            <div className="drawer-horizontal-element">{`Pace (${units.pace})`}</div>
                                            <div className="drawer-horizontal-element"><DurationInput label="Avg"
                                                                                                      path="averagePace"
                                                                                                      minutes
                                                                                                      dataSource={dataSource}/>
                                            </div>
                                            <div className="drawer-horizontal-element"><DurationInput label="Max"
                                                                                                      path="minPace"
                                                                                                      minutes
                                                                                                      dataSource={dataSource}/>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                        </LGSScrollbars>
                    </div>

                </SlTabPanel>
            </SlTabGroup>
        </div>
    )
}