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
    const element = configuration?.elements?.[entity] ?? configuration.user ?? configuration.default

    const [bgSnapshot, setBgSnapshot] = useState(null)
    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])
    const widgetManager = useMemo(() => TextWidgetManager.instance, [])

    /**
     * Captures the background area and updates bgSnapshot.
     */
    useEffect(() => {
        const widgetEl = __.ui.widgetManager.getElementById(entity)
        const sourceCanvas = lgs.canvas

        if (!widgetEl || !sourceCanvas) {
            return
        }

        lgs.scene.render()

        const canvasRect = sourceCanvas.getBoundingClientRect()
        const widgetRect = widgetEl.getBoundingClientRect()

        const centerX = (widgetRect.left - canvasRect.left) + (widgetRect.width / 2)
        const centerY = (widgetRect.top - canvasRect.top) + (widgetRect.height / 2)

        const sourceX = Math.max(0, Math.min(centerX - (PREVIEW_SIZE / 2), canvasRect.width - PREVIEW_SIZE))
        const sourceY = Math.max(0, Math.min(centerY - (PREVIEW_SIZE / 2), canvasRect.height - PREVIEW_SIZE))

        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = PREVIEW_SIZE
        tempCanvas.height = PREVIEW_SIZE
        const ctx = tempCanvas.getContext('2d')

        ctx.drawImage(
            sourceCanvas,
            sourceX, sourceY, PREVIEW_SIZE, PREVIEW_SIZE,
            0, 0, PREVIEW_SIZE, PREVIEW_SIZE,
        )

        const dataUrl = tempCanvas.toDataURL('image/webp', 0.8)

        setBgSnapshot({
                          image:     dataUrl,
                          offset:    {x: sourceX, y: sourceY},
                          widgetPos: {x: widgetRect.left - canvasRect.left, y: widgetRect.top - canvasRect.top},
                      })

        return () => {
            tempCanvas.width = 0
            tempCanvas.height = 0
        }
    }, [entity])

    /**
     * Path-based store update.
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

        const keys = path.split('.')
        let curr = $configuration.elements[entity]
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i]
            if (!curr[key] || typeof curr[key] !== 'object') {
                curr[key] = {}
            }
            curr = curr[key]
        }
        curr[keys[keys.length - 1]] = val
    }, [$configuration, entity, element])

    const getColor = useCallback((item, alpha = false) => widgetManager.getColor(item, alpha), [widgetManager])

    /**
     * Compute variables: Ensure bgSnapshot is tracked in dependencies.
     * We pass the image only if it exists to avoid 'none' being stuck.
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
                    <SlSwitch align-right size="x-small" checked={element.shadow?.show ?? false}
                              onSlInput={(e) => fastUpdate('shadow.show', e.target.checked)}>
                        <label>Text elevation</label>
                    </SlSwitch>

                    {element.shadow?.show && (
                        <div className="drawer-horizontal-line three-columns">
                            <SlColorPicker size="small" swatches={swatches} value={getColor(element.shadow)}
                                           onSlInput={(e) => fastUpdate('shadow.color', e.target.value)}/>
                            <SlSelect hoist size="small" value={element.shadow?.value ?? 'normal'}
                                      onSlChange={(e) => fastUpdate('shadow.value', e.target.value)}>
                                <SlOption value="small">Small</SlOption>
                                <SlOption value="normal">Medium</SlOption>
                                <SlOption value="large">Large</SlOption>
                            </SlSelect>
                            <SlRange min="0.1" max="1" step="0.05" value={element.shadow?.opacity ?? 1}
                                     onSlInput={(e) => fastUpdate('shadow.opacity', parseFloat(e.target.value))}/>
                        </div>
                    )}

                    <SlDivider/>

                    <SlSwitch align-right size="x-small" checked={element.background?.show ?? false}
                              onSlInput={(e) => fastUpdate('background.show', e.target.checked)}>
                        <label>Background</label>
                    </SlSwitch>

                    {element.background?.show && (
                        <div className="drawer-horizontal-line three-columns">
                            <SlColorPicker size="small" swatches={swatches} value={getColor(element.background)}
                                           onSlInput={(e) => fastUpdate('background.color', e.target.value)}/>
                            <SlSwitch align-right size="x-small" checked={element.background.blur ?? false}
                                      onSlChange={(e) => fastUpdate('background.blur', e.target.checked)}>Blur</SlSwitch>
                            <SlRange min="0.1" max="1" step="0.05" value={element.background.opacity ?? 0.5}
                                     onSlInput={(e) => fastUpdate('background.opacity', parseFloat(e.target.value))}/>
                        </div>
                    )}

                    <SlDivider/>

                    <SlSwitch align-right size="x-small" checked={element.border?.show ?? false}
                              onSlInput={(e) => fastUpdate('border.show', e.target.checked)}>
                        <span>Border</span>
                    </SlSwitch>

                    {element.border?.show && (
                        <>
                            <div className="drawer-horizontal-line three-columns">
                                <SlColorPicker size="small" swatches={swatches} value={getColor(element.border)}
                                               onSlInput={(e) => fastUpdate('border.color', e.target.value)}/>
                                <SlInput type="number" min="1" max="10" value={element.border.thickness ?? 1}
                                         size="small"
                                         onSlInput={(e) => fastUpdate('border.thickness', parseInt(e.target.value))}/>
                                <SlRange min="0.1" max="1" step="0.05" value={element.border.opacity ?? 1}
                                         onSlInput={(e) => fastUpdate('border.opacity', parseFloat(e.target.value))}/>
                            </div>

                            <div className="drawer-horizontal-line three-columns">
                                <div/>
                                <div/>
                                <div className="drawer-horizontal-element xlarge-element">
                                    Rounded <SlSelect hoist size="small"
                                                      value={element.border.radius ?? 'normal'}
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

                    {hasVisibleContainer && (
                        <>
                            <SlDivider/>
                            <SlSwitch align-right size="x-small" checked={element.background?.shadow?.show ?? false}
                                      onSlInput={(e) => fastUpdate('background.shadow.show', e.target.checked)}>
                                <label>Box elevation</label>
                            </SlSwitch>

                            {element.background?.shadow?.show && (
                                <div className="drawer-horizontal-line three-columns">
                                    <SlColorPicker size="small" swatches={swatches}
                                                   value={getColor(element.background.shadow)}
                                                   onSlInput={(e) => fastUpdate('background.shadow.color', e.target.value)}/>
                                    <SlSelect hoist size="small"
                                              value={element.background.shadow?.value ?? 'normal'}
                                              onSlChange={(e) => fastUpdate('background.shadow.value', e.target.value)}>
                                        <SlOption value="small">Small</SlOption>
                                        <SlOption value="normal">Medium</SlOption>
                                        <SlOption value="large">Large</SlOption>
                                    </SlSelect>
                                    <SlRange min="0.1" max="1" step="0.05"
                                             value={element.background.shadow?.opacity ?? 1}
                                             onSlInput={(e) => fastUpdate('background.shadow.opacity', parseFloat(e.target.value))}/>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </section>
        </div>
    )
}