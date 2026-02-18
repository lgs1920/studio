/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileWidgetEditor.jsx
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
 * File: ProfileWidgetEditor.jsx
 * * Production-ready editor focused on form controls.
 *
 ******************************************************************************/

import { BackgroundElement } from '@Components/MainUI/widgets/editor/elements/BackgroundElement'
import {
    BorderElement,
}                            from '@Components/MainUI/widgets/editor/elements/BorderElement'

import { SlColorPicker, SlDivider, SlRange, SlSwitch, SlIconButton } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                     from '@Utils/FA2SL'
import { faArrowRotateLeft }                                         from '@fortawesome/pro-regular-svg-icons'
import { colord }                                                    from 'colord'
import React, { useCallback, useMemo }                               from 'react'
import { useSnapshot }                                               from 'valtio'

export const ProfileWidgetEditor = ({entity}) => {
    const $configuration = lgs.settings.widgets['profile-widget'].configuration
    const configuration = useSnapshot($configuration)
    const $element = $configuration.elements?.[entity]
    const element = configuration.elements?.[entity]

    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])

    const getColor = useCallback((item, alpha = false) => {
        if (!item) {
            return 'transparent'
        }
        let colorStr = item?.color ?? '#ffffff'
        if (colorStr.startsWith('--')) {
            colorStr = __.ui.css.getCSSVariable(colorStr)
        }
        const c = colord(colorStr)
        return (alpha ? c.alpha(item.opacity ?? 1) : c).toRgbString()
    }, [])

    const updateValue = useCallback((path, value) => {
        if (!$element) {
            return
        }
        const keys = path.split('.')
        let curr = $element
        for (let i = 0; i < keys.length - 1; i++) {
            if (!curr[keys[i]]) {
                curr[keys[i]] = {}
            }
            curr = curr[keys[i]]
        }
        curr[keys[keys.length - 1]] = value
    }, [$element])

    if (!element) {
        return null
    }

    return (
        <div className="lgs-widget-editor-controls-wrapper">
            {/* General elements */}
            <BackgroundElement element={element} swatches={swatches} getColor={getColor} updateValue={updateValue}/>
            <SlDivider/>
            <BorderElement element={element} swatches={swatches} getColor={getColor} updateValue={updateValue}
                           showRadius={false}/>
            <SlDivider/>

            {/* Distance Section */}
            <div className="drawer-horizontal-line">
                <div className="drawer-horizontal-element xlarge-element">{'Distance:'}</div>
                <div className="drawer-horizontal-line three-columns">
                    <div className="drawer-horizontal-element">
                        {'Axis'}&nbsp;
                        <SlSwitch size="x-small" checked={element.xAxis.main}
                                  onSlInput={(e) => updateValue('xAxis.main', e.target.checked)}/>
                    </div>
                    <div className="drawer-horizontal-element">
                        {'Grid'}&nbsp;
                        <SlSwitch size="x-small" checked={element.xAxis.second}
                                  onSlInput={(e) => updateValue('xAxis.second', e.target.checked)}/>
                    </div>
                    <div className="drawer-horizontal-element">
                        {'Labels'}&nbsp;
                        <SlSwitch size="x-small" checked={element.xAxis.labels}
                                  onSlInput={(e) => updateValue('xAxis.labels', e.target.checked)}/>
                    </div>
                    <div className="drawer-horizontal-element">
                        {'Units'}&nbsp;
                        <SlSwitch size="x-small" checked={element.xAxis.units}
                                  disabled={!element.xAxis.labels}
                                  onSlInput={(e) => updateValue('xAxis.units', e.target.checked)}/>
                    </div>
                </div>
            </div>

            {/* Elevation Section */}
            <div className="drawer-horizontal-line">
                <div className="drawer-horizontal-element xlarge-element">{'Elevation:'}</div>
                <div className="drawer-horizontal-line three-columns">
                    <div className="drawer-horizontal-element">
                        {'Axis'}&nbsp;
                        <SlSwitch size="x-small" checked={element.yAxis.main}
                                  onSlInput={(e) => updateValue('yAxis.main', e.target.checked)}/>
                    </div>
                    <div className="drawer-horizontal-element">
                        {'Grid'}&nbsp;
                        <SlSwitch size="x-small" checked={element.yAxis.second}
                                  onSlInput={(e) => updateValue('yAxis.second', e.target.checked)}/>
                    </div>
                    <div className="drawer-horizontal-element">
                        {'Labels'}&nbsp;
                        <SlSwitch size="x-small" checked={element.yAxis.labels}
                                  onSlInput={(e) => updateValue('yAxis.labels', e.target.checked)}/>
                    </div>
                    <div className="drawer-horizontal-element">
                        {'Units'}&nbsp;
                        <SlSwitch size="x-small" checked={element.yAxis.units}
                                  disabled={!element.yAxis.labels}
                                  onSlInput={(e) => updateValue('yAxis.units', e.target.checked)}/>
                    </div>
                </div>
            </div>

            <SlDivider/>

            {/* Gradient Section */}
            <SlSwitch align-right size="x-small" checked={element.gradient?.show ?? false}
                      onSlInput={(e) => updateValue('gradient.show', e.target.checked)}>
                <span>{'Gradient'}</span>
            </SlSwitch>

            {element.gradient?.show && (
                <div className="drawer-horizontal-line three-columns">
                    <div className="drawer-horizontal-element">
                        <div style={{display: 'flex', alignItems: 'center', gap: 'var(--sl-spacing-x-small)'}}>
                            <SlColorPicker size="small" swatches={swatches}
                                           value={element.gradient?.color ? getColor(element.gradient) : '#3b82f6'}
                                           onSlInput={(e) => updateValue('gradient.color', e.target.value)}/>
                            {element.gradient?.color && (
                                <SlIconButton className="reset-profile-widget-color"
                                              library="fa" name={FA2SL.set(faArrowRotateLeft)}
                                              onClick={() => updateValue('gradient.color', null)}/>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Axis Style */}
            {(element.xAxis.main || element.yAxis.main || element.xAxis.labels || element.yAxis.labels) && (
                <>
                    <SlDivider/>
                    <div>{'Main'}</div>
                    <div className="drawer-horizontal-line three-columns">
                        <div className="drawer-horizontal-element">
                            <SlColorPicker size="small" swatches={swatches} value={getColor(element.mainAxis)}
                                           onSlInput={(e) => updateValue('mainAxis.color', e.target.value)}/>
                        </div>
                        <div className="drawer-horizontal-element xlarge-element">
                            <SlRange label="Width" min="0.5" max="10" step="0.5" align-right
                                     value={element.mainAxis.thickness ?? 1}
                                     onSlInput={(e) => updateValue('mainAxis.thickness', parseFloat(e.target.value))}/>
                        </div>
                        <div className="drawer-horizontal-element xlarge-element">
                            <SlRange label="Opacity" min="0.1" max="1" step="0.05" align-right
                                     value={element.mainAxis.opacity ?? 0.8}
                                     onSlInput={(e) => updateValue('mainAxis.opacity', parseFloat(e.target.value))}/>
                        </div>
                    </div>
                </>
            )}

            {/* Grid Style */}
            {(element.xAxis.second || element.yAxis.second) && (
                <>
                    <SlDivider/>
                    <div>{'Grid'}</div>
                    <div className="drawer-horizontal-line three-columns">
                        <div className="drawer-horizontal-element">
                            <SlColorPicker size="small" swatches={swatches} value={getColor(element.secondAxis)}
                                           onSlInput={(e) => updateValue('secondAxis.color', e.target.value)}/>
                        </div>
                        <div className="drawer-horizontal-element xlarge-element">
                            <SlRange label="Width" min="0.5" max="10" step="0.5" align-right
                                     value={element.secondAxis.thickness ?? 0.5}
                                     onSlInput={(e) => updateValue('secondAxis.thickness', parseFloat(e.target.value))}/>
                        </div>
                        <div className="drawer-horizontal-element xlarge-element">
                            <SlRange label="Opacity" min="0.1" max="1" step="0.05" align-right
                                     value={element.secondAxis.opacity ?? 0.5}
                                     onSlInput={(e) => updateValue('secondAxis.opacity', parseFloat(e.target.value))}/>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}