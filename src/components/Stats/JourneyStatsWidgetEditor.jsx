/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyStatsWidgetEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-11
 * Last modified: 2026-04-11
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
import { DISTANCE_UNITS, ELEVATION_UNITS, PACE_UNITS, SPEED_UNITS } from '@Utils/UnitUtils'
import {
    WaButton, WaButtonGroup, WaCard, WaColorPicker, WaDivider, WaIcon, WaSlider, WaSwitch, WaTab,
    WaTabGroup,
    WaTabPanel,
}                                                                   from '@web.awesome.me/webawesome-pro/dist/react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { subscribe, useSnapshot }                           from 'valtio'

/**
 * Configuration for slider elements in the editor
 */
const JOURNEY_STATS_SLIDERS = {
    'separator.opacity': {
        fallback: 1,
        getValue: element => element.separator?.opacity,
        max:      1,
        min:      0,
        step:     0.05,
    },
    'text.opacity':      {
        fallback: 1,
        getValue: element => element.text?.opacity,
        max:      1,
        min:      0,
        step:     0.05,
    },
}

export const JourneyStatsWidgetEditor = ({entity}) => {
    const $unitSystem = lgs.settings.unitSystem
    const unitSystem = useSnapshot($unitSystem).current

    const $metrics = lgs.theJourney.metrics
    const metricsSnap = useSnapshot($metrics)

    const [activeTab, setActiveTab] = useState('style')
    const [localRotation, setLocalRotation] = useState(0)
    const sliderRefs = useRef({})

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

    /**
     * Ensures slider values remain within defined bounds
     */
    const sanitizeSliderValue = useCallback((rawValue, fallback, options = {}) => {
        const value = Array.isArray(rawValue) ? rawValue[0] : rawValue
        const numericValue = Number(value)

        if (!Number.isFinite(numericValue)) {
            return fallback
        }

        const min = Number(options.min)
        const max = Number(options.max)
        let finalValue = numericValue

        if (Number.isFinite(min)) {
            finalValue = Math.max(min, finalValue)
        }

        if (Number.isFinite(max)) {
            finalValue = Math.min(max, finalValue)
        }

        return finalValue
    }, [])

    /**
     * Updates widget configuration store
     */
    const updateValue = useCallback((path, val) => {
        if (typeof val === 'number' && Number.isNaN(val)) {
            return
        }

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

    const setSliderRef = useCallback((path) => {
        return (node) => {
            sliderRefs.current[path] = node
        }
    }, [])

    const getSliderValue = useCallback((path) => {
        const config = JOURNEY_STATS_SLIDERS[path]

        if (!config) {
            return 0
        }

        return sanitizeSliderValue(config.getValue(element), config.fallback, config)
    }, [element, sanitizeSliderValue])

    const handleSliderInput = useCallback((path, rawValue) => {
        const config = JOURNEY_STATS_SLIDERS[path]

        if (!config) {
            return
        }

        updateValue(path, sanitizeSliderValue(rawValue, config.fallback, config))
    }, [sanitizeSliderValue, updateValue])

    /**
     * Auto-switch to user data source when new user metrics are available
     */
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

    /**
     * Sync slider values with element configuration
     */
    useEffect(() => {
        Object.entries(JOURNEY_STATS_SLIDERS).forEach(([path, config]) => {
            const rawValue = config.getValue(element)
            const sanitizedValue = sanitizeSliderValue(rawValue, config.fallback, config)
            const slider = sliderRefs.current[path]

            if (slider) {
                slider.value = sanitizedValue
            }

            if (rawValue !== undefined && rawValue !== null && rawValue !== sanitizedValue) {
                updateValue(path, sanitizedValue)
            }
        })
    }, [element, sanitizeSliderValue, updateValue])

    const getColor = (item, alpha = false) => __.ui.ui.resolveItemColor(item, alpha)

    /**
     * Applies rotation to the widget and updates store
     */
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

    // Logic to determine if the source selector should be displayed
    const hasUserData = metricsSnap.user && Object.keys(metricsSnap.user).length > 0
    const isDataTabWithExternal = activeTab === 'data' && hasExternal
    const isUserOrExternalAvailable = (metricsSnap.user || hasExternal) && hasUserData

    let sourceSelector = null

    if (isDataTabWithExternal || isUserOrExternalAvailable) {
        sourceSelector = (
            <div className="source-selector-wrapper" style={{marginLeft: 'auto'}}>
                <WaButtonGroup size="small">
                    <WaButton
                        size="small"
                        variant={dataSource === 'global' ? 'warning' : 'neutral'}
                        onClick={() => updateValue('dataSource', 'global')}
                    >
                        Data
                    </WaButton>
                    {hasExternal && (
                        <WaButton
                            size="small"
                            variant={dataSource === 'external' ? 'warning' : 'neutral'}
                            onClick={() => updateValue('dataSource', 'external')}
                        >
                            Other
                        </WaButton>
                    )}
                    <WaButton
                        size="small"
                        variant={dataSource === 'user' ? 'warning' : 'default'}
                        onClick={() => updateValue('dataSource', 'user')}
                    >
                        User
                    </WaButton>
                </WaButtonGroup>
            </div>
        )
    }
    else {
        sourceSelector = (
            <div className="source-selector-wrapper" style={{marginLeft: 'auto'}}>
                <WaButton disabled size="small" variant="brand">{'Data'}</WaButton>
            </div>)
    }

    return (
        <div className="lgs-widget-editor" key={`editor-${entity}`}>
            <WaTabGroup
                className="editor-tabs"
                onWaTabShow={e => setActiveTab(e.detail.name)}
            >
                <WaTab slot="nav" panel="style">
                    <WaIcon size="small" name="pen-paintbrush"/> Style
                </WaTab>
                <WaTab slot="nav" panel="data">
                    <WaIcon size="small" name="money-check-pen"/> Data editor
                </WaTab>

                <WaTabPanel name="style">
                    <LGSScrollbars>
                        <WaCard appearance="filled" orientation="vertical"
                                className="lgs-widget-editor-controls-wrapper">
                            <RotationElement element={element} localRotation={localRotation}
                                             applyRotation={applyRotation} updateValue={updateValue}/>
                            <WaDivider/>
                            <div className="drawer-horizontal-line"><span>Text color</span></div>
                            <div className="drawer-horizontal-line three-columns">
                                <div className="drawer-horizontal-element">
                                    <WaColorPicker size="small" swatches={swatches} value={getColor(element.text)}
                                                   onInput={(e) => updateValue('text.color', e.target.value)}/>
                                </div>
                                <div className="drawer-horizontal-element xlarge-element"></div>
                                <div className="drawer-horizontal-element xlarge-element">
                                    <WaSlider ref={setSliderRef('text.opacity')}
                                              size="small"
                                              label="Opacity"
                                              min={JOURNEY_STATS_SLIDERS['text.opacity'].min}
                                              max={JOURNEY_STATS_SLIDERS['text.opacity'].max}
                                              step={JOURNEY_STATS_SLIDERS['text.opacity'].step}
                                              label-at-start
                                              withTooltip
                                              placement="top"
                                              valueFormatter={v => `${Math.floor(v * 100)}%`}
                                              defaultValue={getSliderValue('text.opacity')}
                                              onInput={(e) => handleSliderInput('text.opacity', e.target.value)}/>
                                </div>
                            </div>
                            <WaDivider/>
                            <WaSwitch label-at-start size="xsmall" checked={element.separator?.show ?? false}
                                      onInput={(e) => updateValue('separator.show', e.target.checked)}><span>Separator</span></WaSwitch>
                            {element.separator?.show && (
                                <div className="drawer-horizontal-line three-columns">
                                    <div className="drawer-horizontal-element">
                                        <WaColorPicker size="small" swatches={swatches}
                                                       value={getColor(element.separator)}
                                                       onInput={(e) => updateValue('separator.color', e.target.value)}/>
                                    </div>
                                    <div className="drawer-horizontal-element xlarge-element"></div>
                                    <div className="drawer-horizontal-element xlarge-element">
                                        <WaSlider ref={setSliderRef('separator.opacity')}
                                                  size="small"
                                                  label="Opacity"
                                                  min={JOURNEY_STATS_SLIDERS['separator.opacity'].min}
                                                  max={JOURNEY_STATS_SLIDERS['separator.opacity'].max}
                                                  step={JOURNEY_STATS_SLIDERS['separator.opacity'].step}
                                                  label-at-start
                                                  withTooltip
                                                  placement="top"
                                                  valueFormatter={v => `${Math.floor(v * 100)}%`}
                                                  defaultValue={getSliderValue('separator.opacity')}
                                                  onInput={(e) => handleSliderInput('separator.opacity', e.target.value)}/>
                                    </div>
                                </div>
                            )}
                            <WaDivider/><ShadowElement element={element} swatches={swatches} getColor={getColor}
                                                       updateValue={updateValue}/>
                            <WaDivider/><BorderElement element={element} swatches={swatches} getColor={getColor}
                                                       updateValue={updateValue} showPill={false}/>
                            <WaDivider/><BackgroundElement element={element} swatches={swatches} getColor={getColor}
                                                           updateValue={updateValue}/>
                        </WaCard>
                    </LGSScrollbars>
                </WaTabPanel>

                <WaTabPanel name="data">
                    <LGSScrollbars>
                        <WaCard appearance="filled" orientation="vertical"
                                className="journey-stats-widget-editor-data">
                            <div className="drawer-horizontal-element">
                                {'Source'} {sourceSelector}
                            </div>
                            <WaSwitch label-at-start size="xsmall" checked={element.date ?? false}
                                      onInput={(e) => updateValue('date', e.target.checked)}><span>Date</span></WaSwitch>
                            <WaDivider/>
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
                            <WaDivider/>
                            <WaSwitch label-at-start size="xsmall" checked={element.altitude ?? false}
                                      onInput={(e) => updateValue('altitude', e.target.checked)}><span>Altitude</span></WaSwitch>
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
                            <WaDivider/>
                            <WaSwitch label-at-start size="xsmall" checked={element.performance ?? false}
                                      onInput={(e) => updateValue('performance', e.target.checked)}><span>Speed/Pace</span></WaSwitch>
                            {element.performance && (
                                <div className="journey-stats-widget-editor-performance">
                                    <div className="drawer-horizontal-line three-columns">
                                        <div className="drawer-horizontal-element">{`Speed (${units.speed})`}</div>
                                        <div className="drawer-horizontal-element">
                                            <JourneyMetricsInput label={'Average'}
                                                                 path="averageSpeed"
                                                                 unit={units.speed}
                                                                 precision={1}
                                                                 dataSource={dataSource}/>
                                        </div>
                                        <div className="drawer-horizontal-element">
                                            <JourneyMetricsInput label={'Max'}
                                                                 path="maxSpeed"
                                                                 unit={units.speed}
                                                                 precision={1}
                                                                 dataSource={dataSource}/>
                                        </div>
                                    </div>
                                    <div className="drawer-horizontal-line three-columns">
                                        <div className="drawer-horizontal-element">{`Pace (${units.pace})`}</div>
                                        <div className="drawer-horizontal-element">
                                            <DurationInput label={'Average'}
                                                           path="averagePace"
                                                           minutes
                                                           dataSource={dataSource}/>
                                        </div>
                                        <div className="drawer-horizontal-element">
                                            <DurationInput label={'Max'}
                                                           path="minPace"
                                                           minutes
                                                           dataSource={dataSource}/>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </WaCard>
                    </LGSScrollbars>
                </WaTabPanel>
            </WaTabGroup>
        </div>
    )
}