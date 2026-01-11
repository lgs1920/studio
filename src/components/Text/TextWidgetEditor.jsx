/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextWidgetEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-11
 * Last modified: 2026-01-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { TextEditorToolbar }                                      from '@Components/Text/TextEditorToolbar'
import { WIDGET_SYSTEM_FONT_STACK } from '@Core/constants'
import { TextWidgetManager }        from '@Core/ui/text-metrics/TextWidgetManager'
import {
    SlColorPicker, SlDivider, SlInput, SlOption, SlRange, SlSelect, SlSwitch, SlTextarea,
}                                                                 from '@shoelace-style/shoelace/dist/react'
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useSnapshot }                                            from 'valtio'

/**
 * Optimized sub-component to isolate text input renders
 */
const OptimizedTextArea = memo(({value, onInput, styleVars}) => {
    const handleKeyDown = (e) => {
        // Si Enter est pressé (sans Shift pour autoriser le comportement natif)
        if (e.key === 'Enter') {
            e.stopPropagation()
        }
    }

    return (
        <SlTextarea
            className="text-widget-preview-area"
            size="small"
            value={value}
            onSlInput={onInput}
            onKeyDown={handleKeyDown}
            style={styleVars}
            enterkeyhint="enter"
        />
    )
})

export const TextWidgetEditor = ({entity}) => {
    const $configuration = lgs.settings.widgets['text-widget'].configuration
    const configuration = useSnapshot($configuration)

    const $element = $configuration.elements?.[entity]
    const element = configuration.elements?.[entity]

    const [bgSnapshot, setBgSnapshot] = useState(null)
    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])

    useEffect(() => {
        const viewer = lgs.viewer
        if (!viewer) {
            return
        }

        const capture = () => {
            const {canvas} = viewer
            const size = 512
            const x = (canvas.width - size) / 2
            const y = (canvas.height - size) / 2
            const tmp = document.createElement('canvas')
            tmp.width = size
            tmp.height = size
            const ctx = tmp.getContext('2d')
            ctx.drawImage(canvas, x, y, size, size, 0, 0, size, size)
            setBgSnapshot(tmp.toDataURL('image/webp', 0.6))
        }

        const off = viewer.scene.postRender.addEventListener(() => {
            capture()
            off()
        })
        return () => {
            setBgSnapshot(null)
            off()
        }
    }, [entity])

    const fastUpdate = useCallback((path, val) => {
        if (!$element) {
            return
        }
        const keys = path.split('.')
        let curr = $element
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i]
            if (!curr[key] || typeof curr[key] !== 'object') {
                curr[key] = {}
            }
            curr = curr[key]
        }
        curr[keys[keys.length - 1]] = val
    }, [$element])

    const widgetManager = useMemo(() => TextWidgetManager.instance, [])

    const getColor = useCallback((item, alpha = false) => {
        return widgetManager.getColor(item, alpha)
    }, [widgetManager])

    if (!element) {
        return null
    }

    const hasVisibleContainer = element.background?.show || element.border?.show

    const dynamicVars = widgetManager.generateCSSVariables(element, bgSnapshot, WIDGET_SYSTEM_FONT_STACK)

    return (
        <div className="lgs-card text-widget-editor" style={dynamicVars}>
            <section>
                <header className="text-widget-editor-header">
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                        <TextEditorToolbar id={entity} color={true} align={true} style={true}/>
                    </div>
                    <TextEditorToolbar id={entity} fonts={true} color={false} align={false} style={false}/>
                </header>

                <OptimizedTextArea
                    key={`${element.lineHeight}-${element.fontFamily}`}
                    value={element.text}
                    onInput={(e) => fastUpdate('text', e.target.value)}
                />

                <SlSwitch align-right size="x-small" checked={element.shadow?.show ?? false}
                          onSlInput={(e) => fastUpdate('shadow.show', e.target.checked)}>
                    <label>{'Text shadow'}</label>
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
                                <SlOption value="small">{'Small'}</SlOption>
                                <SlOption value="normal">{'Medium'}</SlOption>
                                <SlOption value="large">{'Large'}</SlOption>
                            </SlSelect>
                        </div>
                        <div className="drawer-horizontal-element xlarge-element">
                            <SlRange min="0.1" max="1" step="0.05" value={element.shadow?.opacity ?? 1}
                                     onSlInput={(e) => fastUpdate('shadow.opacity', parseFloat(e.target.value))}/>
                        </div>
                    </div>
                )}

                <SlDivider/>

                <SlSwitch align-right size="x-small" checked={element.background?.show ?? false}
                          onSlInput={(e) => fastUpdate('background.show', e.target.checked)}>
                    <label>{'Background'}</label>
                </SlSwitch>

                {element.background?.show && (
                    <div className="drawer-horizontal-line three-columns">
                        <div className="drawer-horizontal-element">
                            <SlColorPicker size="small" swatches={swatches} value={getColor(element.background)}
                                           onSlInput={(e) => fastUpdate('background.color', e.target.value)}/>
                        </div>
                        <div className="drawer-horizontal-element">
                            <SlSwitch align-right size="x-small" checked={element.background.blur ?? false}
                                      onSlChange={(e) => fastUpdate('background.blur', e.target.checked)}>{'Blur'}</SlSwitch>
                        </div>
                        <div className="drawer-horizontal-element xlarge-element">
                            <SlRange min="0.1" max="1" step="0.05" value={element.background.opacity ?? 0.5}
                                     onSlInput={(e) => fastUpdate('background.opacity', parseFloat(e.target.value))}/>
                        </div>
                    </div>
                )}

                <SlDivider/>

                <SlSwitch align-right size="x-small" checked={element.border?.show ?? false}
                          onSlInput={(e) => fastUpdate('border.show', e.target.checked)}>
                    <span>{'Border'}</span>
                </SlSwitch>

                {element.border?.show && (
                    <div className="drawer-horizontal-line three-columns">
                        <div className="drawer-horizontal-element">
                            <SlColorPicker size="small" swatches={swatches} value={getColor(element.border)}
                                           onSlInput={(e) => fastUpdate('border.color', e.target.value)}/>
                        </div>
                        <div className="drawer-horizontal-element">
                            <SlInput type="number" min="1" max="10" value={element.border.thickness ?? 1} size="small"
                                     onSlInput={(e) => fastUpdate('border.thickness', parseInt(e.target.value))}/>
                        </div>
                        <div className="drawer-horizontal-element xlarge-element">
                            <SlRange min="0.1" max="1" step="0.05" value={element.border.opacity ?? 1}
                                     onSlInput={(e) => fastUpdate('border.opacity', parseFloat(e.target.value))}/>
                        </div>
                    </div>
                )}

                {hasVisibleContainer && (
                    <>
                        <SlDivider/>
                        <SlSwitch align-right size="x-small" checked={element.background?.shadow?.show ?? false}
                                  onSlInput={(e) => fastUpdate('background.shadow.show', e.target.checked)}>
                            <label>{'Box shadow'}</label>
                        </SlSwitch>

                        {element.background?.shadow?.show && (
                            <div className="drawer-horizontal-line three-columns">
                                <div className="drawer-horizontal-element">
                                    <SlColorPicker size="small" swatches={swatches}
                                                   value={getColor(element.background.shadow)}
                                                   onSlInput={(e) => fastUpdate('background.shadow.color', e.target.value)}/>
                                </div>
                                <div className="drawer-horizontal-element">
                                    <SlSelect hoist size="small" value={element.background.shadow?.value ?? 'normal'}
                                              onSlChange={(e) => fastUpdate('background.shadow.value', e.target.value)}>
                                        <SlOption value="small">{'Small'}</SlOption>
                                        <SlOption value="normal">{'Medium'}</SlOption>
                                        <SlOption value="large">{'Large'}</SlOption>
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
            </section>
        </div>
    )
}