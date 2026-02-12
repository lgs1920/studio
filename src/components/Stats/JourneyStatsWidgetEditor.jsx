/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyStatsWidgetEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-12
 * Last modified: 2026-02-12
 *
 *
 * Copyright © 2026 LGS1920
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
import { JourneyStats }                                             from '@Components/Stats/JourneyStats'
import { faPenPaintbrush, faTableList }                             from '@fortawesome/pro-regular-svg-icons'
import {
    SlDivider, SlIcon, SlTab, SlTabGroup, SlTabPanel, SlButton, SlButtonGroup, SlSwitch,
}                                                                   from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                    from '@Utils/FA2SL'
import { DISTANCE_UNITS, ELEVATION_UNITS, PACE_UNITS, SPEED_UNITS } from '@Utils/UnitUtils'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot, subscribe }                                   from 'valtio'
import './style.css'

export const JourneyStatsWidgetEditor = ({entity}) => {
    const _previewer = useRef(null)
    const unitSystem = useSnapshot(lgs.settings.unitSystem).current
    const $metrics = lgs.theJourney.metrics
    const metricsSnap = useSnapshot($metrics)

    const [activeTab, setActiveTab] = useState('style')
    const [localRotation, setLocalRotation] = useState(0)

    const _moveable = __.ui.widgetManager.getMoveable(entity)
    const widget = __.ui.widgetManager.getElementById(entity)
    const $widgetStore = lgs.stores.ui.widget
    const widgetStore = useSnapshot($widgetStore)
    const $current = lgs.stores.ui.widget.current

    const $configuration = lgs.settings.widgets['journey-stats-widget'].configuration
    const configuration = useSnapshot($configuration)
    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])

    const element = useMemo(() => {
        return configuration.elements?.[entity] ?? configuration.user ?? configuration.default
    }, [configuration, entity])

    const dataSource = element.dataSource || 'global'
    const previewBg = widgetStore.currentSnapshot?.image || null
    const previewStyle = useMemo(() => ({
        '--lgs-journey-stats-preview-bg': previewBg ? `url(${previewBg})` : 'none',
    }), [previewBg])

    const journeyMetrics = useMemo(() => {
        if (!$metrics) {
            return null
        }
        return lgs.theJourney.getMetrics()
    }, [metricsSnap, unitSystem])

    const hasExternal = useMemo(() => {
        return journeyMetrics?.external && Object.keys(journeyMetrics.external).length > 0
    }, [journeyMetrics])

    const hasUserOverrides = useMemo(() => {
        return metricsSnap.user && Object.keys(metricsSnap.user).length > 0
    }, [metricsSnap.user])

    const units = useMemo(() => ({
        elevation: ELEVATION_UNITS[unitSystem],
        distance:  DISTANCE_UNITS[unitSystem],
        pace:      PACE_UNITS[unitSystem],
        speed: SPEED_UNITS[unitSystem],
    }), [unitSystem])

    /**
     * Updates the proxy store. Valtio handles the propagation to all observers.
     */
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

    /**
     * Watches for manual metric changes and auto-switches to 'user' source.
     * Includes safety check for uninitialized user metrics store.
     */
    useEffect(() => {
        if (!$metrics?.user) {
            return
        }

        const unsubscribe = subscribe($metrics.user, () => {
            const userKeys = Object.keys($metrics.user)
            const hasOverrides = userKeys.length > 0

            if (hasOverrides && dataSource !== 'user') {
                updateValue('dataSource', 'user')
            }
        })
        return () => unsubscribe()
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
        if ($current) {
            $current.rotate = clampedVal
        }
    }

    if (!journeyMetrics) {
        return null
    }

    return (
        <div className="lgs-card lgs-widget-editor" key={`editor-${entity}`}>
            <div className="lgs-widget-preview">
                <div className="journey-stats-widget-preview-surface"
                     ref={_previewer}
                     style={{
                         background:         getColor(element.background),
                         backgroundSize:     'cover',
                         backgroundPosition: 'center',
                         border:             element.border?.width ? `${element.border.width}px solid ${getColor(element.border.color)}` : 'none',
                         boxShadow: element.shadow?.active ? `${element.shadow.x}px ${element.shadow.y}px ${element.shadow.blur}px ${getColor(element.shadow.color)}` : 'none',
                     }}>
                    <div className="journey-stats-widget-preview-chart" style={previewStyle}>
                        <JourneyStats
                            metrics={journeyMetrics.metrics}
                            id={entity}
                            units={units}
                            style={{transform: `scale(0.7) rotate(${localRotation}deg)`}}
                        />
                    </div>
                </div>
            </div>

            <SlTabGroup onSlTabShow={e => setActiveTab(e.detail.name)}>
                <SlTab slot="nav" panel="style"><SlIcon size="small" library="fa"
                                                        name={FA2SL.set(faPenPaintbrush)}/> Style</SlTab>
                <SlTab slot="nav" panel="data"><SlIcon size="small" library="fa"
                                                       name={FA2SL.set(faTableList)}/> Data</SlTab>

                {(hasExternal || hasUserOverrides) && (
                    <div className="source-selector-wrapper" slot="nav"
                         style={{display: activeTab === 'data' ? 'flex' : 'none'}}>
                        From
                        <SlButtonGroup size="small">
                            <SlButton size="small" variant={dataSource === 'global' ? 'primary' : 'default'}
                                      onClick={() => updateValue('dataSource', 'global')}>{'Data'}</SlButton>
                            {hasExternal &&
                                <SlButton size="small" variant={dataSource === 'external' ? 'warning' : 'neutral'}
                                          onClick={() => updateValue('dataSource', 'external')}>{'External'}</SlButton>}
                            <SlButton size="small" variant={dataSource === 'user' ? 'warning' : 'default'}
                                      onClick={() => updateValue('dataSource', 'user')}>{'User'}</SlButton>
                        </SlButtonGroup>
                    </div>
                )}

                <SlTabPanel name="style" className="journey-stats-widget-editor-scroll">
                    <LGSScrollbars>
                        <div className="lgs-widget-editor-controls-wrapper">
                            <RotationElement element={element} localRotation={localRotation}
                                             applyRotation={applyRotation} updateValue={updateValue}/>
                            <SlDivider/><ShadowElement element={element} swatches={swatches} getColor={getColor}
                                                       updateValue={updateValue}/>
                            <SlDivider/><BorderElement element={element} swatches={swatches} getColor={getColor}
                                                       updateValue={updateValue} showPill={false}/>
                            <SlDivider/><BackgroundElement element={element} swatches={swatches} getColor={getColor}
                                                           updateValue={updateValue}/>
                        </div>
                    </LGSScrollbars>
                </SlTabPanel>

                <SlTabPanel name="data" className="journey-stats-widget-editor-scroll">
                    <LGSScrollbars>
                        <div className="journey-stats-widget-editor-data">
                            <SlSwitch align-right size="x-small" checked={element.date ?? false}
                                      onSlInput={(e) => updateValue('date', e.target.checked)}>
                                <span>Date</span>
                            </SlSwitch>
                            <SlDivider/>
                            <div className="drawer-horizontal-line three-columns">
                                <div className="drawer-horizontal-element">
                                    <JourneyMetricsInput label={`Distance (${units.distance})`} path="distance"
                                                         unit={units.distance} dataSource={dataSource}/>
                                </div>
                                <div className="drawer-horizontal-element">
                                    <JourneyMetricsInput label={`Elevation (${units.elevation})`}
                                                         path="positive.elevation" unit={units.elevation} precision={0}
                                                         dataSource={dataSource}/>
                                </div>
                                <div className="drawer-horizontal-element">
                                    <DurationInput label="Duration" path="duration" dataSource={dataSource}/>
                                </div>
                            </div>
                            <SlDivider/>
                            <SlSwitch align-right size="x-small" checked={element.altitude ?? false}
                                      onSlInput={(e) => updateValue('altitude', e.target.checked)}>
                                <span>Altitude</span>
                            </SlSwitch>
                            {element.altitude && (
                                <div className="drawer-horizontal-line three-columns">
                                    <div className="drawer-horizontal-element">{`Altitude (${units.elevation})`}</div>
                                    <div className="drawer-horizontal-element">
                                        <JourneyMetricsInput label="Min" path="minHeight" unit={units.elevation}
                                                             precision={0} dataSource={dataSource}/>
                                    </div>
                                    <div className="drawer-horizontal-element">
                                        <JourneyMetricsInput label="Max" path="maxHeight" unit={units.elevation}
                                                             precision={0} dataSource={dataSource}/>
                                    </div>
                                </div>
                            )}
                            <SlDivider/>
                            <SlSwitch align-right size="x-small" checked={element.performance ?? false}
                                      onSlInput={(e) => updateValue('performance', e.target.checked)}>
                                <span>Speed/Pace</span>
                            </SlSwitch>
                            {element.performance && (
                                <div className="journey-stats-widget-editor-performance">
                                    <div className="drawer-horizontal-line three-columns">
                                        <div className="drawer-horizontal-element">{`Speed (${units.speed})`}</div>
                                        <div className="drawer-horizontal-element">
                                            <JourneyMetricsInput label="Avg" path="averageSpeed" unit={units.speed}
                                                                 precision={1} dataSource={dataSource}/>
                                        </div>
                                        <div className="drawer-horizontal-element">
                                            <JourneyMetricsInput label="Max" path="maxSpeed" unit={units.speed}
                                                                 precision={1} dataSource={dataSource}/>
                                        </div>
                                    </div>
                                    <div className="drawer-horizontal-line three-columns">
                                        <div className="drawer-horizontal-element">{`Pace (${units.pace})`}</div>
                                        <div className="drawer-horizontal-element">
                                            <DurationInput label="Avg" path="averagePace" minutes
                                                           dataSource={dataSource}/>
                                        </div>
                                        <div className="drawer-horizontal-element">
                                            <DurationInput label="Min" path="minPace" minutes dataSource={dataSource}/>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </LGSScrollbars>
                </SlTabPanel>
            </SlTabGroup>
        </div>
    )
}