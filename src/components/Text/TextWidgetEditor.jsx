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
import {
    SlColorPicker, SlDivider, SlInput, SlOption, SlRange, SlSelect, SlSwitch, SlTextarea,
}                                                                 from '@shoelace-style/shoelace/dist/react'
import { colord }                                                 from 'colord'
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useSnapshot }                                            from 'valtio'

/**
 * Optimized sub-component to isolate text input renders
 */
const OptimizedTextArea = memo(({value, onInput, styleVars}) => (
    <SlTextarea
        className="text-widget-preview-area"
        resize="auto"
        size="small"
        value={value}
        onSlInput={onInput}
        style={styleVars}
    />
))

export const TextWidgetEditor = ({entity}) => {
    const $configuration = lgs.settings.widgets['text-widget'].configuration
    const configuration = useSnapshot($configuration)

    const $element = $configuration.elements?.[entity]
    const element = configuration.elements?.[entity]

    const [bgSnapshot, setBgSnapshot] = useState(null)
    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])
    const systemStack = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

    /**
     * Captures a 512px central square from the Cesium canvas
     */
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

    /**
     * High-speed mutation of the Valtio proxy.
     * Includes a type-safety check to recover from corrupted state (strings instead of objects).
     */
    const fastUpdate = useCallback((path, val) => {
        if (!$element) {
            return
        }
        const keys = path.split('.')
        let curr = $element
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i]
            // Ensure intermediate levels are objects, fixing potential string corruption
            if (!curr[key] || typeof curr[key] !== 'object') {
                curr[key] = {}
            }
            curr = curr[key]
        }
        curr[keys[keys.length - 1]] = val
    }, [$element])

    /**
     * Resolves color with alpha channel. Safe against missing items.
     */
    const getColor = useCallback((item, alpha = false) => {
        if (!item || !item.color) {
            return 'transparent'
        }
        const raw = item.color.startsWith('--') ? __.ui.css.getCSSVariable(item.color) : item.color
        const c = colord(raw)
        return alpha ? c.alpha(item.opacity ?? 1).toRgbString() : c.toRgbString()
    }, [])

    if (!element) {
        return null
    }

    const dynamicVars = {
        '--lgs-tx-tiles':    bgSnapshot ? `url(${bgSnapshot})` : 'none',
        '--lgs-tx-bg-color': element.background?.show ? getColor(element.background, true) : 'transparent',
        '--lgs-tx-color':    getColor(element, true),
        '--lgs-tx-font':     element.fontFamily === 'System' ? systemStack : element.fontFamily,
        '--lgs-tx-align':    element.align ?? 'left',
        '--lgs-tx-size':     `${element.size ?? 16}px`,
        '--lgs-tx-weight':   element.weight ?? 'normal',
        '--lgs-tx-style':    element.style ?? 'normal',
        '--lgs-tx-lh':       element.lineHeight ?? '1',
        '--lgs-tx-border':   element.border?.show ? `${element.border.thickness}px solid ${getColor(element.border, true)}` : 'none',
        '--lgs-tx-radius':   `${element.border?.radius ?? 0}px`,

        '--lgs-tx-elevation': element.shadow?.show ? (
            element.shadow.value === 'small' ? 'var(--sl-shadow-x-medium)' :
            element.shadow.value === 'large' ? 'var(--sl-shadow-x-large)' :
            'var(--sl-shadow-large)'
        ) : 'none',

        '--lgs-bg-elevation': element.background?.shadow?.show ? (
            element.background.shadow.value === 'small' ? 'var(--sl-shadow-small)' :
            element.background.shadow.value === 'large' ? 'var(--sl-shadow-x-large)' :
            'var(--sl-shadow-medium)'
        ) : 'none',

        '--lgs-tx-shadow': element.shadow?.show ? (
            element.shadow.value === 'small' ? `0 1px 2px ${getColor(element.shadow, true)}` :
            element.shadow.value === 'large' ? `0 4px 8px ${getColor(element.shadow, true)}` :
            `0 2px 4px ${getColor(element.shadow, true)}`
        ) : 'none',

        '--lgs-tx-blur': element.background?.blur ? 'blur(5px)' : 'none',
    }

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
                            <SlColorPicker
                                size="small"
                                swatches={swatches}
                                value={getColor(element.shadow)}
                                onSlInput={(e) => fastUpdate('shadow.color', e.target.value)}
                            />
                        </div>
                        <div className="drawer-horizontal-element">
                            <SlSelect
                                hoist
                                size="small"
                                value={element.shadow?.value ?? 'normal'}
                                onSlChange={(e) => fastUpdate('shadow.value', e.target.value)}
                            >
                                <SlOption value="small">{'Small'}</SlOption>
                                <SlOption value="normal">{'Medium'}</SlOption>
                                <SlOption value="large">{'Large'}</SlOption>
                            </SlSelect>
                        </div>
                        <div className="drawer-horizontal-element xlarge-element">
                            <SlRange
                                min="0.1" max="1" step="0.05"
                                value={element.shadow?.opacity ?? 1}
                                onSlInput={(e) => fastUpdate('shadow.opacity', parseFloat(e.target.value))}
                            />
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

                {element.border?.show || element.background?.show && (
                    <>
                        <SlDivider/>
                        <SlSwitch align-right size="x-small" checked={element.background.shadow?.show ?? false}
                                  onSlInput={(e) => fastUpdate('background.shadow.show', e.target.checked)}>
                            <label>{'Box shadow'}</label>
                        </SlSwitch>

                        {element.background.shadow?.show && (
                            <div className="drawer-horizontal-line three-columns">
                                <div className="drawer-horizontal-element">
                                    <SlColorPicker
                                        size="small"
                                        swatches={swatches}
                                        value={getColor(element.background.shadow)}
                                        onSlInput={(e) => fastUpdate('background.shadow.color', e.target.value)}
                                    />
                                </div>
                                <div className="drawer-horizontal-element">
                                    <SlSelect
                                        hoist
                                        size="small"
                                        value={element.background.shadow?.value ?? 'normal'}
                                        onSlChange={(e) => fastUpdate('background.shadow.value', e.target.value)}
                                    >
                                        <SlOption value="small">{'Small'}</SlOption>
                                        <SlOption value="normal">{'Medium'}</SlOption>
                                        <SlOption value="large">{'Large'}</SlOption>
                                    </SlSelect>
                                </div>
                                <div className="drawer-horizontal-element xlarge-element">
                                    <SlRange
                                        min="0.1" max="1" step="0.05"
                                        value={element.background.shadow?.opacity ?? 1}
                                        onSlInput={(e) => fastUpdate('background.shadow.opacity', parseFloat(e.target.value))}
                                    />
                                </div>
                            </div>
                        )}
                    </>
                )}

            </section>
        </div>
    )
}