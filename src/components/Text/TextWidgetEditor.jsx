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

import { TextEditorToolbar }                       from '@Components/Text/TextEditorToolbar'
import { WIDGET_RADIUS, WIDGET_SYSTEM_FONT_STACK } from '@Core/constants'
import {
    TextWidgetManager,
}                                                  from '@Core/ui/text-metrics/TextWidgetManager'
import {
    SlColorPicker, SlDivider, SlInput, SlOption, SlRange, SlSelect, SlSwitch, SlTextarea,
}                                                                 from '@shoelace-style/shoelace/dist/react'
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useSnapshot }                                            from 'valtio'

const PREVIEW_SIZE = 512

/**
 * Optimized text area for preview.
 * Receives computed CSS variables for background snapshot and styling.
 */
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

    // Fallback to user or default configuration if entity-specific data is missing
    const element = configuration?.elements?.[entity] ?? configuration.user ?? configuration.default

    const [bgSnapshot, setBgSnapshot] = useState(null)
    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])
    const widgetManager = useMemo(() => TextWidgetManager.instance, [])

    /**
     * Captures a localized snapshot of the canvas behind the widget.
     * This snapshot is used to simulate backdrop-filter blur in the preview area.
     */
    useEffect(() => {
        const _widgetEl = __.ui.widgetManager.getElementById(entity)
        const _sourceCanvas = lgs.canvas

        if (!_widgetEl || !_sourceCanvas) {
            return
        }

        lgs.scene.render()

        const _canvasRect = _sourceCanvas.getBoundingClientRect()
        const _widgetRect = _widgetEl.getBoundingClientRect()

        const _centerX = (_widgetRect.left - _canvasRect.left) + (_widgetRect.width / 2)
        const _centerY = (_widgetRect.top - _canvasRect.top) + (_widgetRect.height / 2)

        const _sourceX = Math.max(0, Math.min(_centerX - (PREVIEW_SIZE / 2), _canvasRect.width - PREVIEW_SIZE))
        const _sourceY = Math.max(0, Math.min(_centerY - (PREVIEW_SIZE / 2), _canvasRect.height - PREVIEW_SIZE))

        const _tempCanvas = document.createElement('canvas')
        _tempCanvas.width = PREVIEW_SIZE
        _tempCanvas.height = PREVIEW_SIZE
        const _ctx = _tempCanvas.getContext('2d')

        _ctx.drawImage(
            _sourceCanvas,
            _sourceX, _sourceY, PREVIEW_SIZE, PREVIEW_SIZE,
            0, 0, PREVIEW_SIZE, PREVIEW_SIZE,
        )

        const _dataUrl = _tempCanvas.toDataURL('image/webp', 0.8)

        setBgSnapshot({
                          image:     _dataUrl,
                          offset:    {x: _sourceX, y: _sourceY},
                          widgetPos: {x: _widgetRect.left - _canvasRect.left, y: _widgetRect.top - _canvasRect.top},
                      })

        return () => {
            _tempCanvas.width = 0
            _tempCanvas.height = 0
        }
    }, [entity])

    /**
     * Updates the proxy store using a deep path.
     * Automatically initializes the elements map for the specific entity if required.
     */
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

    /**
     * Regenerates CSS variables for the preview area.
     * Dependencies include the background snapshot and the element's current state.
     */
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
                    {/* Shadow Settings */}
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

                    {/* Background Settings including Blur control */}
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
                                <div>
                                <SlSwitch
                                    align-right
                                    size="x-small"
                                    checked={element.background.blur ?? false}
                                    onSlChange={(e) => fastUpdate('background.blur', e.target.checked)}
                                >
                                    {'Blur'}&nbsp;
                                </SlSwitch>
                                </div>
                            </div>
                            <div className="drawer-horizontal-element xlarge-element">
                                <SlRange min="0.1" max="1" step="0.05" value={element.background.opacity ?? 0.5}
                                         onSlInput={(e) => fastUpdate('background.opacity', parseFloat(e.target.value))}/>
                            </div>
                        </div>
                    )}

                    <SlDivider/>

                    {/* Border & Radius Settings */}
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

                    {/* Container Elevation Settings */}
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