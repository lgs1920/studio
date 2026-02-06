/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyStatsWidgetEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-06
 * Last modified: 2026-02-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

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
import { SlColorPicker, SlDivider, SlInput, SlRange, SlSwitch }     from '@shoelace-style/shoelace/dist/react'
import { DISTANCE_UNITS, ELEVATION_UNITS, PACE_UNITS, SPEED_UNITS } from '@Utils/UnitUtils'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                              from 'valtio'
import './style.css'

/**
 * Editor for the Profile Widget configuration using a plain Object
 * @param {Object} props
 * @param {string} props.entity - The unique ID of the widget
 * @returns {JSX.Element}
 */
export const JourneyStatsWidgetEditor = ({entity}) => {

    const _previewer = useRef(null)
    const unitSystem = useSnapshot(lgs.settings.unitSystem).current
    const [localRotation, setLocalRotation] = useState(0)

    const _moveable = __.ui.widgetManager.getMoveable(entity)
    const widget = __.ui.widgetManager.getElementById(entity)
    const $widgetStore = lgs.stores.ui.widget
    const widgetStore = useSnapshot($widgetStore)
    const $current = lgs.stores.ui.widget.current

    const $configuration = lgs.settings.widgets['journey-stats-widget'].configuration
    const configuration = useSnapshot($configuration)
    const element = (configuration?.elements?.[entity] ?? configuration.user ?? configuration.default)
    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])

    const journeyMetrics = useMemo(() => {
        if (!lgs.theJourney?.metrics) {
            return null
        }
        return {...lgs.theJourney.getMetrics()}
    }, [lgs.theJourney, unitSystem])

    const updateValue = useCallback((path, val) => {
        if (!$configuration.elements) {
            $configuration.elements = {}
        }
        if (!$configuration.elements[entity]) {
            $configuration.elements[entity] = JSON.parse(JSON.stringify(element))
        }

        const _keys = path.split('.')
        let _curr = $configuration.elements[entity]
        let _source = element

        for (let i = 0; i < _keys.length - 1; i++) {
            const _key = _keys[i]
            if (!_curr[_key] || typeof _curr[_key] !== 'object') {
                _curr[_key] = _source?.[_key] ? JSON.parse(JSON.stringify(_source[_key])) : {}
            }
            _curr = _curr[_key]
            _source = _source?.[_key]
        }

        _curr[_keys[_keys.length - 1]] = val

        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
    }, [$configuration, element, entity, _moveable])

    const units = useMemo(() => ({
        elevation: ELEVATION_UNITS[unitSystem],
        distance:  DISTANCE_UNITS[unitSystem],
        pace:      PACE_UNITS[unitSystem],
        speed:     SPEED_UNITS[unitSystem],
    }), [unitSystem])

    /**
     * Sync local rotation on activeId change or store rotation update
     */
    useEffect(() => {
        const transform = __.ui.widgetManager.getTransform(widget)
        const currentRotate = widgetStore.current?.rotate ?? transform.rotate ?? 0
        setLocalRotation(Math.ceil(currentRotate))
    }, [widget, widgetStore.current?.rotate])

    const getColor = useCallback((item, alpha = false) => __.ui.ui.resolveItemColor(item, alpha), [])

    /**
     * Update rotation in DOM and stores
     * @param {number} val - The logical value (positive = clockwise)
     */
    const applyRotation = async (val) => {
        const clampedVal = parseFloat(val) || 0
        setLocalRotation(clampedVal)
        const {translate, scale} = __.ui.widgetManager.getTransform(widget)

        const targetRotate = clampedVal

        __.ui.widgetManager.setTransform(widget, {translate, scale, rotate: targetRotate})
        if (_moveable?.current) {
            _moveable.current.updateRect()
        }

        if ($current) {
            $current.rotate = targetRotate
        }

        const initConfig = await __.ui.widgetManager.getWidgetConfig(entity)
        const config = await __.ui.widgetManager.retrieveConfig(entity, initConfig)
        config.rotate = targetRotate
        __.ui.widgetManager.saveWidgetPosition(entity, config)
    }

    const previewBg = widgetStore.currentSnapshot?.image || null
    const previewStyle = useMemo(() => ({
        '--lgs-journey-stats-preview-bg': previewBg ? `url(${previewBg})` : 'none',
    }), [previewBg])

    return (
        <div className="lgs-card lgs-widget-editor" key={`journey-stats-widget-editor-${entity}`}>

            <div className="journey-stats-widget-preview">
                <div className="journey-stats-widget-preview-surface" ref={_previewer}>
                    <div className="journey-stats-widget-preview-chart" style={previewStyle}>
                        <JourneyStats metrics={journeyMetrics?.metrics} units={units} preview
                                      style={{
                                          transform:       `scale(0.7) rotate(${localRotation}deg)`,
                                          transformOrigin: 'center center',
                                      }}/>
                    </div>
                </div>
            </div>
            <div className="journey-stats-widget-editor-scroll">
                <LGSScrollbars>
                    <div className="lgs-widget-editor-controls-wrapper">
                        <RotationElement element={element}
                                         localRotation={localRotation}
                                         applyRotation={applyRotation}
                                         updateValue={updateValue}/>

                        <SlDivider/>
                        <div className="drawer-horizontal-line">
                            <span style={{'lineHeight': 1}}>{'Text color'}<br/></span>
                        </div>
                        <div className="drawer-horizontal-line">
                            <div className="drawer-horizontal-line three-columns">
                                <div className="drawer-horizontal-element">
                                    <SlColorPicker size="small" swatches={swatches}
                                                   value={getColor(element.border)}
                                                   onSlInput={(e) => updateValue('separator.color', e.target.value)}/>
                                </div>
                                <div className="drawer-horizontal-element xlarge-element"></div>
                                <div className="drawer-horizontal-element xlarge-element">
                                    <SlRange label="Opacity" min="0" max="1" step="0.05" align-right tooltip="top"
                                             tooltipFormatter={value => `${Math.floor(value * 100)}%`}
                                             value={element.border.opacity ?? 1}
                                             onSlInput={(e) => updateValue('separator.opacity', parseFloat(e.target.value))}/>
                                </div>
                            </div>
                        </div>

                        <SlDivider/>
                        <ShadowElement element={element} swatches={swatches} getColor={getColor}
                                       updateValue={updateValue}/>

                        <SlDivider/>
                        <div className="drawer-horizontal-line">
                            <SlSwitch align-right size="x-small" checked={element.separator?.show ?? false}
                                      onSlInput={(e) => updateValue('separator.show', e.target.checked)}>
                                <span>{'Separator'}</span>
                            </SlSwitch>
                        </div>

                        {element.separator?.show && (
                            <div className="drawer-horizontal-line three-columns">
                                <div className="drawer-horizontal-element">
                                    <SlColorPicker size="small" swatches={swatches}
                                                   value={getColor(element.border)}
                                                   onSlInput={(e) => updateValue('separator.color', e.target.value)}/>
                                </div>
                                <div className="drawer-horizontal-element xlarge-element"></div>
                                <div className="drawer-horizontal-element xlarge-element">
                                    <SlRange label="Opacity" min="0" max="1" step="0.05" align-right tooltip="top"
                                             tooltipFormatter={value => `${Math.floor(value * 100)}%`}
                                             value={element.border.opacity ?? 1}
                                             onSlInput={(e) => updateValue('separator.opacity', parseFloat(e.target.value))}/>
                                </div>
                            </div>
                        )}

                        <SlDivider/>
                        <BackgroundElement element={element} swatches={swatches} getColor={getColor}
                                           updateValue={updateValue}/>
                        <SlDivider/>
                        <BorderElement element={element} swatches={swatches} getColor={getColor}
                                       updateValue={updateValue}
                                       showPill={false}/>

                        <SlDivider/>
                        <div className="journey-stats-widget-editor-data">

                            <SlSwitch align-right size="x-small" checked={element.date ?? false}
                                      onSlInput={(e) => updateValue('date', e.target.checked)}>
                                <span>{'Date'}</span>
                            </SlSwitch>

                            <SlDivider/>
                            <div className="drawer-horizontal-line three-columns">
                                <div className="drawer-horizontal-element">
                                    <SlInput label={`Distance (${units.distance})`}
                                             size="small"
                                             type="number"
                                    />
                                </div>
                                <div className="drawer-horizontal-element">
                                    <SlInput label={`Elevation (${units.elevation})`}
                                             size="small"
                                             type="number"
                                    />
                                </div>
                                <div className="drawer-horizontal-element">
                                    <SlInput label={`Duration`}
                                             size="small"
                                             type="number"
                                    />
                                </div>
                            </div>

                            <SlDivider/>
                            <SlSwitch align-right size="x-small" checked={element.altitude ?? false}
                                      onSlInput={(e) => updateValue('altitude', e.target.checked)}>
                                <span>{'Altitude'}</span>
                            </SlSwitch>
                            {element.altitude &&
                                <div className="drawer-horizontal-line three-columns">
                                    <div
                                        className="drawer-horizontal-element">{`Altitude (${units.elevation})`}</div>
                                    <div className="drawer-horizontal-element">
                                        <SlInput label={`Min`}
                                                 size="small"
                                                 type="number"
                                        />
                                    </div>
                                    <div className="drawer-horizontal-element">
                                        <SlInput label={`Max`}
                                                 size="small"
                                                 type="number"
                                        />
                                    </div>
                                </div>
                            }

                            <SlDivider/>
                            <SlSwitch align-right size="x-small" checked={element.performance ?? false}
                                      onSlInput={(e) => updateValue('performance', e.target.checked)}>
                                <span>{'Speed/Pace'}</span>
                            </SlSwitch>
                            {element.performance &&
                                <>
                                    <div className="drawer-horizontal-line three-columns">
                                        <div className="drawer-horizontal-element">{`Speed (${units.speed})`}</div>
                                        <div className="drawer-horizontal-element">
                                            <SlInput label={`Average`}
                                                     size="small"
                                                     type="number"
                                            />
                                        </div>
                                        <div className="drawer-horizontal-element">
                                            <SlInput label={`Max`}
                                                     size="small"
                                                     type="number"
                                            />
                                        </div>
                                    </div>
                                    <div className="drawer-horizontal-line three-columns">
                                        <div className="drawer-horizontal-element">{`Pace (${units.pace})`}</div>
                                        <div className="drawer-horizontal-element">
                                            <SlInput label={`Average`}
                                                     size="small"
                                                     type="number"
                                            />
                                        </div>
                                        <div className="drawer-horizontal-element">
                                            <SlInput label={`Max`}
                                                     size="small"
                                                     type="number"
                                            />
                                        </div>
                                    </div>
                                </>
                            }
                        </div>
                    </div>
                </LGSScrollbars>
            </div>
        </div>
    )
}