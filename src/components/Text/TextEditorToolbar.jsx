/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextEditorToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-24
 * Last modified: 2026-02-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WIDGET_FONT_FAMILIES, WIDGET_SYSTEM_FONT_STACK } from '@Core/constants'
import {
    faDistributeSpacingVertical, faText, faTextSize,
}                                                         from '@fortawesome/pro-regular-svg-icons'
import {
    faAlignCenter, faAlignLeft, faAlignRight, faBold, faItalic,
}                                                         from '@fortawesome/pro-solid-svg-icons'
import {
    SlButton, SlButtonGroup, SlColorPicker, SlIcon, SlInput, SlOption, SlRange, SlSelect,
}                                                         from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                          from '@Utils/FA2SL'
import { colord }                                         from 'colord'
import { useCallback, useEffect, useMemo }                from 'react'
import { useSnapshot }                                    from 'valtio'

/**
 * Complete Text formatting toolbar
 */
export const TextEditorToolbar = ({id, fonts = false, color = true, align = true, style = true}) => {
    const $configuration = lgs.settings.widgets['text-widget'].configuration
    const configuration = useSnapshot($configuration)

    /** @type {Object} Proxy to the specific text element */
    const $element = $configuration?.elements?.[id] ?? $configuration.user ?? $configuration.default
    /** @type {Object} Snapshot of the specific text element */
    const element = configuration?.elements?.[id] ?? configuration.user ?? configuration.default

    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])
    const _moveable = __.ui.widgetManager.getMoveable(id)

    /**
     * Synchronizes visual color and opacity with CSS variables in the DOM
     */
    const syncCSS = useCallback((colorValue, opacityValue) => {
        const _sceneTarget = __.ui.widgetManager.getElementById(id)
        const _previewTarget = document.querySelector('.text-widget-preview .lgs-text-container')
        const finalColor = colord(colorValue || '#ffffff')
            .alpha(opacityValue !== undefined ? opacityValue : 1)
            .toRgbString()
        if (_sceneTarget) {
            __.ui.css.setCSSVariable('--lgs-tx-color', finalColor, _sceneTarget)
        }
        if (_previewTarget) {
            __.ui.css.setCSSVariable('--lgs-tx-color', finalColor, _previewTarget)
        }
    }, [id])

    const scheduleUpdate = useCallback(() => {
        if (!_moveable?.current) {
            return
        }

        requestAnimationFrame(() => {
            _moveable.current.updateRect()
            setTimeout(() => {
                _moveable.current?.updateRect()
            }, 50)
        })
    }, [_moveable])


    const alignmentDisabled = useMemo(() => {
        const text = element?.text?.content ?? ''
        return text.split('\n').filter(line => line.trim() !== '').length <= 1
    }, [element?.text?.content])

    useEffect(() => {
        if (alignmentDisabled && $element && $element.align !== 'left') {
            $element.align = 'left'
        }
    }, [alignmentDisabled, $element])

    /**
     * Handlers
     */
    const handleFontChange = useCallback((e) => {
        if ($element) {
            $element.fontFamily = e.target.value.replace(/_/g, ' ')
            scheduleUpdate()
        }
    }, [$element, scheduleUpdate])

    const handleSizeChange = useCallback((e) => {
        if ($element) {
            $element.size = Number(e.target.value)
            scheduleUpdate()
        }
    }, [$element, scheduleUpdate])

    const handleLineHeightChange = useCallback((e) => {
        if ($element) {
            $element.lineHeight = e.target.value
            scheduleUpdate()
        }
    }, [$element, scheduleUpdate])

    const handleColorChange = useCallback((e) => {
        if ($element) {
            $element.text.color = e.target.value
            syncCSS($element.text.color, $element.text.opacity)
            scheduleUpdate()
        }
    }, [$element, syncCSS, scheduleUpdate])

    const handleOpacityChange = useCallback((e) => {
        if ($element) {
            $element.text.opacity = parseFloat(e.target.value)
            syncCSS($element.text.color, $element.text.opacity)
        }
    }, [$element, syncCSS])

    const toggleBold = useCallback(() => {
        if ($element) {
            $element.weight = element?.weight === 'bold' ? 'normal' : 'bold'
            scheduleUpdate()
        }
    }, [$element, element?.weight, scheduleUpdate])

    const toggleItalic = useCallback(() => {
        if ($element) {
            $element.style = element?.style === 'italic' ? 'normal' : 'italic'
            scheduleUpdate()
        }
    }, [$element, element?.style, scheduleUpdate])

    const currentFont = element?.fontFamily ?? 'System'
    const appliedFontStack = currentFont === 'System' ? WIDGET_SYSTEM_FONT_STACK : currentFont

    return (
        <div className="drawer-horizontal-line three-columns">

            {color && (
                <div className="drawer-horizontal-element">
                    <SlColorPicker
                        value={element?.text?.color ?? 'white'}
                        onSlInput={handleColorChange}
                        size="small"
                        swatches={swatches}
                    />
                    <SlRange
                        min="0"
                        max="1"
                        step="0.05"
                        value={element?.text?.opacity ?? 1}
                        tooltipFormatter={v => `${Math.floor(v * 100)}%`}
                        onSlInput={handleOpacityChange}
                        style={{width: '100px'}}
                    />
                </div>
            )}

            {style && (
                <div className="drawer-horizontal-element">
                    <SlButtonGroup size="small">
                        <SlButton
                            size="small"
                            variant={element?.weight === 'bold' ? 'primary' : 'default'}
                            onClick={toggleBold}
                        >
                            <SlIcon library="fa" name={FA2SL.set(faBold)}/>
                        </SlButton>
                        <SlButton
                            size="small"
                            variant={element?.style === 'italic' ? 'primary' : 'default'}
                            onClick={toggleItalic}
                        >
                            <SlIcon library="fa" name={FA2SL.set(faItalic)}/>
                        </SlButton>
                    </SlButtonGroup>
                </div>
            )}

            {align && (
                <div className="drawer-horizontal-element">
                    <SlButtonGroup size="small">
                        {['left', 'center', 'right'].map((mode) => (
                            <SlButton
                                key={mode}
                                size="small"
                                disabled={alignmentDisabled}
                                variant={!alignmentDisabled && element?.align === mode ? 'primary' : 'default'}
                                onClick={() => {
                                    if ($element) {
                                        $element.align = mode
                                    }
                                }}
                            >
                                <SlIcon library="fa"
                                        name={FA2SL.set(mode === 'left' ? faAlignLeft : mode === 'center' ? faAlignCenter : faAlignRight)}/>
                            </SlButton>
                        ))}
                    </SlButtonGroup>
                </div>
            )}

            {fonts && (
                <>
                    <div className="drawer-horizontal-element">

                        <SlSelect
                            size="small"
                            value={currentFont.replace(/\s/g, '_')}
                            onSlChange={handleFontChange}
                            style={{
                                width:                    '130px',
                                '--sl-input-font-family': appliedFontStack,
                            }}
                        >
                            <SlIcon slot="prefix" library="fa" name={FA2SL.set(faText)}/>
                            {WIDGET_FONT_FAMILIES.map(font => (
                                <SlOption key={font} value={font.replace(/\s/g, '_')}>
                                <span
                                    style={{fontFamily: font === 'System' ? WIDGET_SYSTEM_FONT_STACK : font}}>Typeface</span>
                                </SlOption>
                            ))}
                        </SlSelect>
                    </div>
                    <div className="drawer-horizontal-element">
                        <SlSelect
                            hoist
                            size="small"
                            value={element?.lineHeight ?? '1'}
                            onSlChange={handleLineHeightChange}
                            style={{width: '8rem'}}
                        >
                            <SlIcon slot="prefix" library="fa" name={FA2SL.set(faDistributeSpacingVertical)}/>
                            {[
                                {v: '0.8', t: 'Compact'},
                                {v: '1', t: 'Normal'},
                                {v: '1.2', t: 'Comfort'},
                                {v: '1.6', t: 'Wide'},
                            ].map(opt => (
                                <SlOption key={opt.v} value={opt.v}>{opt.t}</SlOption>
                            ))}
                        </SlSelect>
                    </div>
                    <div className="drawer-horizontal-element">
                        <SlInput
                            size="small"
                            type="number"
                            min="8"
                            max="48"
                            value={element?.size ?? 16}
                            onSlInput={handleSizeChange}
                            style={{width: '6rem'}}
                        >
                            <SlIcon slot="prefix" library="fa" name={FA2SL.set(faTextSize)}/>
                        </SlInput>
                    </div>
                </>
            )}
        </div>
    )
}