/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyStatsWidgetEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-10
 * Last modified: 2026-02-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DurationInput } from '@Components/DurationInput'
import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import { BackgroundElement }                                                   from '@Components/MainUI/widgets/editor/elements/BackgroundElement'
import {
    BorderElement,
}                                                                              from '@Components/MainUI/widgets/editor/elements/BorderElement'
import {
    RotationElement,
}                                                                              from '@Components/MainUI/widgets/editor/elements/RotationElement'
import {
    ShadowElement,
}                                                                              from '@Components/MainUI/widgets/editor/elements/ShadowElement'
import { JourneyStats }                                                        from '@Components/Stats/JourneyStats'
import { faPenPaintbrush, faTableList }                                        from '@fortawesome/pro-regular-svg-icons'
import {
    SlDivider, SlIcon, SlInput, SlTab, SlTabGroup, SlTabPanel, SlButton, SlButtonGroup,
} from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                               from '@Utils/FA2SL'
import { DISTANCE_UNITS, ELEVATION_UNITS, PACE_UNITS, SPEED_UNITS, UnitUtils } from '@Utils/UnitUtils'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                                         from 'valtio'
import './style.css'

export const JourneyStatsWidgetEditor = ({entity}) => {
    const _previewer = useRef(null)
    const unitSystem = useSnapshot(lgs.settings.unitSystem).current
    const [localRotation, setLocalRotation] = useState(0)
    const [dataSource, setDataSource] = useState('user')

    const _moveable = __.ui.widgetManager.getMoveable(entity)
    const widget = __.ui.widgetManager.getElementById(entity)

    const $widgetStore = lgs.stores.ui.widget
    const widgetStore = useSnapshot($widgetStore)
    const $current = lgs.stores.ui.widget.current

    const $configuration = lgs.settings.widgets['journey-stats-widget'].configuration
    const configuration = useSnapshot($configuration)
    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])

    const metricsSnap = useSnapshot(lgs.theJourney.metrics)

    const element = useMemo(() => {
        return configuration.elements?.[entity] ?? configuration.user ?? configuration.default
    }, [configuration, entity])

    const previewBg = widgetStore.currentSnapshot?.image || null
    const previewStyle = useMemo(() => ({
        '--lgs-journey-stats-preview-bg': previewBg ? `url(${previewBg})` : 'none',
    }), [previewBg])

    /**
     * Get categorized metrics
     */
    const journeyMetrics = useMemo(() => {
        if (!lgs.theJourney?.metrics) {
            return null
        }
        return lgs.theJourney.getMetrics()
    }, [lgs.theJourney, metricsSnap, unitSystem])

    const hasExternal = useMemo(() => {
        return journeyMetrics?.external && Object.keys(journeyMetrics.external).length > 0
    }, [journeyMetrics])

    const hasUserOverrides = useMemo(() => {
        return journeyMetrics?.user && Object.keys(journeyMetrics.user).length > 0
    }, [journeyMetrics])

    const units = useMemo(() => ({
        elevation: ELEVATION_UNITS[unitSystem],
        distance:  DISTANCE_UNITS[unitSystem],
        pace:      PACE_UNITS[unitSystem],
        speed:     SPEED_UNITS[unitSystem],
    }), [unitSystem])

    const activeData = useMemo(() => {
        if (!journeyMetrics) {
            return {}
        }
        if (dataSource === 'global') {
            return journeyMetrics.global
        }
        if (dataSource === 'external') {
            return journeyMetrics.external
        }
        return journeyMetrics.metrics
    }, [journeyMetrics, dataSource])

    const getOriginClass = (path) => {
        if (dataSource !== 'user') {
            return ''
        }
        const _keys = path.split('.')
        let userVal = journeyMetrics.user
        let externalVal = journeyMetrics.external
        for (const key of _keys) {
            userVal = userVal?.[key]
            externalVal = externalVal?.[key]
        }
        if (userVal !== undefined && userVal !== null) {
            return 'origin-user'
        }
        if (externalVal !== undefined && externalVal !== null) {
            return 'origin-external'
        }
        return 'origin-global'
    }

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
            const _key = _keys[i]
            if (!_curr[_key] || typeof _curr[_key] !== 'object') {
                _curr[_key] = {}
            }
            _curr = _curr[_key]
        }
        _curr[_keys[_keys.length - 1]] = val
        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
    }, [$configuration, element, entity, _moveable])

    /**
     * Updates user metrics.
     * Deletes the key if value is empty.
     */
    const updateMetrics = (path, rawValue, unit = null) => {
        const $metrics = lgs.theJourney.metrics
        if (!$metrics) {
            return
        }
        if (!$metrics.user) {
            $metrics.user = {}
        }

        const isRemoving = rawValue === null || rawValue === undefined || rawValue === ''
        const _keys = path.split('.')
        let _curr = $metrics.user

        for (let i = 0; i < _keys.length - 1; i++) {
            const _key = _keys[i]
            if (isRemoving && (!_curr[_key] || typeof _curr[_key] !== 'object')) {
                return
            }
            if (!_curr[_key] || typeof _curr[_key] !== 'object') {
                _curr[_key] = {}
            }
            _curr = _curr[_key]
        }

        const lastKey = _keys[_keys.length - 1]
        if (isRemoving) {
            delete _curr[lastKey]
        }
        else {
            const finalValue = unit ? UnitUtils.revert(rawValue, unit) : rawValue
            _curr[lastKey] = finalValue
            setDataSource('user')
        }
    }

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

    const m = activeData

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
                         boxShadow:          element.shadow?.active ? `${element.shadow.x}px ${element.shadow.y}px ${element.shadow.blur}px ${getColor(element.shadow.color)}` : 'none',
                     }}>
                    <div className="journey-stats-widget-preview-chart" style={previewStyle}>
                        <JourneyStats
                            metrics={journeyMetrics.metrics}
                            id={entity}
                            units={units}
                            preview
                            style={{transform: `scale(0.7) rotate(${localRotation}deg)`}}
                        />
                    </div>
                </div>
            </div>

            <SlTabGroup>
                <SlTab slot="nav" panel="style"><SlIcon size="small" library="fa"
                                                        name={FA2SL.set(faPenPaintbrush)}/> {'Style'}</SlTab>
                <SlTab slot="nav" panel="data"><SlIcon size="small" library="fa"
                                                       name={FA2SL.set(faTableList)}/> {'Data'}</SlTab>

                <SlTabPanel name="style" className="journey-stats-widget-editor-scroll">
                    <LGSScrollbars>
                        <div className="lgs-widget-editor-controls-wrapper">
                            <RotationElement element={element} localRotation={localRotation}
                                             applyRotation={applyRotation} updateValue={updateValue}/>
                            <SlDivider/>
                            <ShadowElement element={element} swatches={swatches} getColor={getColor}
                                           updateValue={updateValue}/>
                            <SlDivider/>
                            <BorderElement element={element} swatches={swatches} getColor={getColor}
                                           updateValue={updateValue} showPill={false}/>
                            <SlDivider/>
                            <BackgroundElement element={element} swatches={swatches} getColor={getColor}
                                               updateValue={updateValue}/>
                        </div>
                    </LGSScrollbars>
                </SlTabPanel>

                <SlTabPanel name="data" className="journey-stats-widget-editor-scroll">
                    <LGSScrollbars>
                        <div className="journey-stats-widget-editor-data">

                            {(hasExternal || hasUserOverrides) && (
                                <div className="source-selector-wrapper">
                                    <SlButtonGroup size="small">
                                        <SlButton size="small" variant={dataSource === 'global' ? 'primary' : 'default'}
                                                  onClick={() => setDataSource('global')}>Global</SlButton>
                                        {hasExternal && (
                                            <SlButton size="small"
                                                      variant={dataSource === 'external' ? 'primary' : 'default'}
                                                      onClick={() => setDataSource('external')}>External</SlButton>
                                        )}
                                        <SlButton size="small" variant={dataSource === 'user' ? 'primary' : 'default'}
                                                  onClick={() => setDataSource('user')}>Merged</SlButton>
                                    </SlButtonGroup>
                                </div>
                            )}

                            <SlDivider/>

                            <div className="drawer-horizontal-line three-columns">
                                <div className="drawer-horizontal-element">
                                    <SlInput label={`Distance (${units.distance})`} size="small" type="number"
                                             className={getOriginClass('distance')}
                                             value={UnitUtils.formatMetric(m.distance, {
                                                 units:     units.distance,
                                                 precision: 2,
                                             }).value}
                                             onSlChange={(e) => updateMetrics('distance', e.target.value, units.distance)}/>
                                </div>
                                <div className="drawer-horizontal-element">
                                    <SlInput label={`Elevation (${units.elevation})`} size="small" type="number"
                                             className={getOriginClass('positive.elevation')}
                                             value={UnitUtils.formatMetric(m.positive?.elevation, {
                                                 units:     units.elevation,
                                                 precision: 0,
                                             }).value}
                                             onSlChange={(e) => updateMetrics('positive.elevation', e.target.value, units.elevation)}/>
                                </div>
                                <div className="drawer-horizontal-element">
                                    <DurationInput label="Duration" size="small"
                                                   className={getOriginClass('duration')}
                                                   value={m.duration}
                                                   onSlChange={(val) => updateMetrics('duration', val)}/>
                                </div>
                            </div>

                            <SlDivider/>
                            <div className="drawer-horizontal-line three-columns">
                                <div className="drawer-horizontal-element">{`Altitude (${units.elevation})`}</div>
                                <div className="drawer-horizontal-element">
                                    <SlInput label="Min" size="small" type="number"
                                             className={getOriginClass('minHeight')}
                                             value={UnitUtils.formatMetric(m.minHeight, {
                                                 units:     units.elevation,
                                                 precision: 0,
                                             }).value}
                                             onSlChange={(e) => updateMetrics('minHeight', e.target.value, units.elevation)}/>
                                </div>
                                <div className="drawer-horizontal-element">
                                    <SlInput label="Max" size="small" type="number"
                                             className={getOriginClass('maxHeight')}
                                             value={UnitUtils.formatMetric(m.maxHeight, {
                                                 units:     units.elevation,
                                                 precision: 0,
                                             }).value}
                                             onSlChange={(e) => updateMetrics('maxHeight', e.target.value, units.elevation)}/>
                                </div>
                            </div>

                            <SlDivider/>
                            <div className="journey-stats-widget-editor-performance">
                                <div className="drawer-horizontal-line three-columns">
                                    <div className="drawer-horizontal-element">{`Speed (${units.speed})`}</div>
                                    <div className="drawer-horizontal-element">
                                        <SlInput label="Avg" size="small" type="number"
                                                 className={getOriginClass('averageSpeed')}
                                                 value={UnitUtils.formatMetric(m.averageSpeed, {
                                                     units:     units.speed,
                                                     precision: 1,
                                                 }).value}
                                                 onSlChange={(e) => updateMetrics('averageSpeed', e.target.value, units.speed)}/>
                                    </div>
                                    <div className="drawer-horizontal-element">
                                        <SlInput label="Max" size="small" type="number"
                                                 className={getOriginClass('maxSpeed')}
                                                 value={UnitUtils.formatMetric(m.maxSpeed, {
                                                     units:     units.speed,
                                                     precision: 1,
                                                 }).value}
                                                 onSlChange={(e) => updateMetrics('maxSpeed', e.target.value, units.speed)}/>
                                    </div>
                                </div>
                                <div className="drawer-horizontal-line three-columns">
                                    <div className="drawer-horizontal-element">{`Pace (${units.pace})`}</div>
                                    <div className="drawer-horizontal-element">
                                        <SlInput label="Avg" size="small" type="number"
                                                 className={getOriginClass('averagePace')}
                                                 value={UnitUtils.formatMetric(m.averagePace, {
                                                     units:     units.pace,
                                                     precision: 0,
                                                 }).value}
                                                 onSlChange={(e) => updateMetrics('averagePace', e.target.value, units.pace)}/>
                                    </div>
                                    <div className="drawer-horizontal-element">
                                        <SlInput label="Max" size="small" type="number"
                                                 className={getOriginClass('minPace')}
                                                 value={UnitUtils.formatMetric(m.minPace, {
                                                     units:     units.pace,
                                                     precision: 0,
                                                 }).value}
                                                 onSlChange={(e) => updateMetrics('minPace', e.target.value, units.pace)}/>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </LGSScrollbars>
                </SlTabPanel>
            </SlTabGroup>
        </div>
    )
}