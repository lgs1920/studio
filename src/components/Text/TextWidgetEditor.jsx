/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextWidgetEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-13
 * Last modified: 2026-01-13
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextWidgetEditor.jsx
 ******************************************************************************/

import { TextEditorToolbar }                       from '@Components/Text/TextEditorToolbar'
import { WIDGET_RADIUS, WIDGET_SYSTEM_FONT_STACK } from '@Core/constants'
import { TextWidgetManager }                 from '@Core/ui/text-metrics/TextWidgetManager'
import {
    SlColorPicker, SlDivider, SlInput, SlOption, SlRange, SlSelect, SlSwitch, SlTextarea,
}                                                                 from '@shoelace-style/shoelace/dist/react'
import React, { memo, useCallback, useMemo } from 'react'
import { useSnapshot }                                            from 'valtio'

const OptimizedTextArea = memo(({value, onInput, dynamicVars}) => {
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.stopPropagation()
        }
    }

    return (
        <div style={dynamicVars} className="text-widget-preview-container">
            <SlTextarea
                className="text-widget-preview-area"
                size="small"
                value={value}
                onSlInput={onInput}
                onKeyDown={handleKeyDown}
                enterkeyhint="enter"
            />
        </div>
    )
})

export const TextWidgetEditor = ({entity}) => {
    const $configuration = lgs.settings.widgets['text-widget'].configuration
    const configuration = useSnapshot($configuration)
    const element = configuration?.elements?.[entity] ?? configuration.user ?? configuration.default

    // Consume the pre-rendered snapshot from the global store
    const widgetStore = useSnapshot(lgs.stores.ui.widget)
    const bgSnapshot = widgetStore.currentSnapshot

    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])
    const widgetManager = useMemo(() => TextWidgetManager.instance, [])

    const fastUpdate = useCallback((path, val) => {
        if (!$configuration) {
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
            const _key = _keys[i]
            if (!_curr[_key] || typeof _curr[_key] !== 'object') {
                _curr[_key] = {}
            }
            _curr = _curr[_key]
        }
        _curr[_keys[_keys.length - 1]] = val
    }, [$configuration, entity, element])

    const getColor = useCallback((item, alpha = false) => widgetManager.getColor(item, alpha), [widgetManager])

    const dynamicVars = useMemo(() => {
        return widgetManager.generateCSSVariables(
            element,
            bgSnapshot ? bgSnapshot.image : null,
            WIDGET_SYSTEM_FONT_STACK,
        )
    }, [element, bgSnapshot, widgetManager])

    if (!element) {
        return null
    }

    const hasVisibleContainer = element.background?.show || element.border?.show

    return (
        <div className="lgs-card text-widget-editor">
            <section>
                <header className="text-widget-editor-header">
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                        <TextEditorToolbar id={entity} color={true} align={true} style={true}/>
                    </div>
                    <TextEditorToolbar id={entity} fonts={true} color={false} align={false} style={false}/>
                </header>

                <OptimizedTextArea
                    value={element.text}
                    onInput={(e) => fastUpdate('text', e.target.value)}
                    dynamicVars={dynamicVars}
                />

                <div className="editor-controls-wrapper">
                    {/* Elevation */}
                    <SlSwitch align-right size="x-small" checked={element.shadow?.show ?? false}
                              onSlInput={(e) => fastUpdate('shadow.show', e.target.checked)}>
                        <label>Text elevation</label>
                    </SlSwitch>

                    {element.shadow?.show && (
                        <div className="drawer-horizontal-line three-columns">
                            <div className="drawer-horizontal-element">
                                <SlColorPicker size="small" swatches={swatches} value={getColor(element.shadow)}
                                               onSlInput={(e) => fastUpdate('shadow.color', e.target.value)}/>
                            </div>
                            <div className="drawer-horizontal-element">
                                <SlSelect hoist size="small" value={element.shadow?.value ?? 'normal'}
                                          onSlChange={(e) => fastUpdate('shadow.value', e.target.value)}>
                                    <SlOption value="small">Small</SlOption>
                                    <SlOption value="normal">Medium</SlOption>
                                    <SlOption value="large">Large</SlOption>
                                </SlSelect>
                            </div>
                            <div className="drawer-horizontal-element xlarge-element">
                                <SlRange min="0.1" max="1" step="0.05" value={element.shadow?.opacity ?? 1}
                                         onSlInput={(e) => fastUpdate('shadow.opacity', parseFloat(e.target.value))}/>
                            </div>
                        </div>
                    )}

                    <SlDivider/>

                    {/* Background */}
                    <SlSwitch align-right size="x-small" checked={element.background?.show ?? false}
                              onSlInput={(e) => fastUpdate('background.show', e.target.checked)}>
                        <label>Background</label>
                    </SlSwitch>

                    {element.background?.show && (
                        <div className="drawer-horizontal-line three-columns">
                            <div className="drawer-horizontal-element">
                                <SlColorPicker size="small" swatches={swatches} value={getColor(element.background)}
                                               onSlInput={(e) => fastUpdate('background.color', e.target.value)}/>
                            </div>
                            <div className="drawer-horizontal-element">
                                <SlSwitch
                                    align-right
                                    size="x-small"
                                    checked={element.background.blur ?? false}
                                    onSlChange={(e) => fastUpdate('background.blur', e.target.checked)}
                                >
                                    Blur&nbsp;
                                </SlSwitch>
                            </div>
                            <div className="drawer-horizontal-element xlarge-element">
                                <SlRange min="0.1" max="1" step="0.05" value={element.background.opacity ?? 0.5}
                                         onSlInput={(e) => fastUpdate('background.opacity', parseFloat(e.target.value))}/>
                            </div>
                        </div>
                    )}

                    <SlDivider/>

                    {/* Border */}
                    <SlSwitch align-right size="x-small" checked={element.border?.show ?? false}
                              onSlInput={(e) => fastUpdate('border.show', e.target.checked)}>
                        <span>Border</span>
                    </SlSwitch>

                    {element.border?.show && (
                        <>
                            <div className="drawer-horizontal-line three-columns">
                                <div className="drawer-horizontal-element">
                                    <SlColorPicker size="small" swatches={swatches} value={getColor(element.border)}
                                                   onSlInput={(e) => fastUpdate('border.color', e.target.value)}/>
                                </div>
                                <div className="drawer-horizontal-element">
                                    <SlInput type="number" min="1" max="10" value={element.border.thickness ?? 1}
                                             size="small"
                                             onSlInput={(e) => fastUpdate('border.thickness', parseInt(e.target.value))}/>
                                </div>
                                <div className="drawer-horizontal-element xlarge-element">
                                    <SlRange min="0.1" max="1" step="0.05" value={element.border.opacity ?? 1}
                                             onSlInput={(e) => fastUpdate('border.opacity', parseFloat(e.target.value))}/>
                                </div>
                            </div>

                            <div className="drawer-horizontal-line three-columns">
                                <div className="drawer-horizontal-element"/>
                                <div className="drawer-horizontal-element"/>
                                <div className="drawer-horizontal-element xlarge-element">
                                    Rounded <SlSelect hoist size="small"
                                                      value={element.border.radius ?? 'none'}
                                                      onSlChange={(e) => fastUpdate('border.radius', e.target.value)}>
                                    {[...WIDGET_RADIUS.entries()].map(([_key, _data]) => (
                                        <SlOption key={_key} value={_key}>
                                            {_data.name}
                                        </SlOption>
                                    ))}
                                </SlSelect>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Box Elevation */}
                    {hasVisibleContainer && (
                        <>
                            <SlDivider/>
                            <SlSwitch align-right size="x-small" checked={element.background?.shadow?.show ?? false}
                                      onSlInput={(e) => fastUpdate('background.shadow.show', e.target.checked)}>
                                <label>Box elevation</label>
                            </SlSwitch>

                            {element.background?.shadow?.show && (
                                <div className="drawer-horizontal-line three-columns">
                                    <div className="drawer-horizontal-element">
                                        <SlColorPicker size="small" swatches={swatches}
                                                       value={getColor(element.background.shadow)}
                                                       onSlInput={(e) => fastUpdate('background.shadow.color', e.target.value)}/>
                                    </div>
                                    <div className="drawer-horizontal-element">
                                        <SlSelect hoist size="small"
                                                  value={element.background.shadow?.value ?? 'normal'}
                                                  onSlChange={(e) => fastUpdate('background.shadow.value', e.target.value)}>
                                            <SlOption value="small">Small</SlOption>
                                            <SlOption value="normal">Medium</SlOption>
                                            <SlOption value="large">Large</SlOption>
                                        </SlSelect>
                                    </div>
                                    <div className="drawer-horizontal-element xlarge-element">
                                        <SlRange min="0.1" max="1" step="0.05"
                                                 value={element.background.shadow?.opacity ?? 1}
                                                 onSlInput={(e) => fastUpdate('background.shadow.opacity', parseFloat(e.target.value))}/>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </section>
        </div>
    )
}