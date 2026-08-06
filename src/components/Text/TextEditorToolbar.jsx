/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextEditorToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WIDGET_FONT_FAMILIES, WIDGET_SYSTEM_FONT_STACK } from '@Core/constants'

import {
    formatSliderPercent,
    sanitizeNumericControlValue,
}                                      from '@Components/MainUI/widgets/editor/elements/sliderUtils'
import {
    WaButton, WaButtonGroup, WaColorPicker, WaIcon, WaInput, WaOption, WaSelect, WaSlider,
}                 from '@web.awesome.me/webawesome-pro/dist/react'
import { colord } from 'colord'
import { useCallback, useEffect, useMemo }                from 'react'
import { useSnapshot }                                    from 'valtio'
import { useOptionalSnapshot }                            from '@Utils/ValtioUtils'

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

    const swatches = useOptionalSnapshot(lgs.settings.swatches, {list: []}).list.join(';')
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
            $element.size = sanitizeNumericControlValue(e.target.value, 16, {min: 8, max: 48})
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
            $element.text.opacity = sanitizeNumericControlValue(e.target.value, 1, {min: 0, max: 1})
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
    const textOpacity = useMemo(() => sanitizeNumericControlValue(element?.text?.opacity, 1, {min: 0, max: 1}), [
        element?.text?.opacity,
    ])
    const fontSize = useMemo(() => sanitizeNumericControlValue(element?.size, 16, {min: 8, max: 48}), [
        element?.size,
    ])

    useEffect(() => {
        if ($element?.text && element?.text?.opacity !== undefined && element.text.opacity !== textOpacity) {
            $element.text.opacity = textOpacity
            syncCSS($element.text.color, textOpacity)
        }
    }, [$element, element?.text?.opacity, syncCSS, textOpacity])

    useEffect(() => {
        if ($element && element?.size !== undefined && element.size !== fontSize) {
            $element.size = fontSize
            scheduleUpdate()
        }
    }, [$element, element?.size, fontSize, scheduleUpdate])

    return (
        <div className="drawer-horizontal-line">

            {color && (
                <div className="drawer-horizontal-element">
                    <WaColorPicker
                        value={element?.text?.color ?? 'white'}
                        onInput={handleColorChange}
                        size="s"
                        swatches={swatches}
                    />
                    <WaSlider
                        min="0"
                        max="1"
                        step="0.05"
                        value={textOpacity}
                        valueFormatter={formatSliderPercent}
                        onInput={handleOpacityChange}
                        style={{width: '100px'}}
                    />
                </div>
            )}

            {style && (
                <div className="drawer-horizontal-element">
                    <WaButtonGroup size="s">
                        <WaButton
                            size="s"
                            variant={element?.weight === 'bold' ? 'brand' : 'default'}
                            onClick={toggleBold}
                        >
                            <WaIcon variant="regular" name="bold"/>
                        </WaButton>
                        <WaButton
                            size="s"
                            variant={element?.style === 'italic' ? 'brand' : 'default'}
                            onClick={toggleItalic}
                        >
                            <WaIcon variant="regular" name="italic"/>
                        </WaButton>
                    </WaButtonGroup>
                </div>
            )}

            {align && (
                <div className="drawer-horizontal-element">
                    <WaButtonGroup size="s">
                        {['left', 'center', 'right'].map((mode) => (
                            <WaButton
                                key={mode}
                                size="s"
                                disabled={alignmentDisabled}
                                variant={!alignmentDisabled && element?.align === mode ? 'brand' : 'default'}
                                onClick={() => {
                                    if ($element) {
                                        $element.align = mode
                                    }
                                }}
                            >
                                <WaIcon variant="regular"
                                        name={mode === 'left' ? 'align-left' : mode === 'center' ? 'align-center' : 'align-right'}/>
                            </WaButton>
                        ))}
                    </WaButtonGroup>
                </div>
            )}

            {fonts && (
                <>
                    <div className="drawer-horizontal-element">

                        <WaSelect appearance="filled"
                            size="s"
                            value={currentFont.replace(/\s/g, '_')}
                            onChange={handleFontChange}
                            style={{
                                width:                    '130px',
                                '--sl-input-font-family': appliedFontStack,
                            }}
                        >
                            <WaIcon slot="start" variant="regular" name="text"/>
                            {WIDGET_FONT_FAMILIES.map(font => (
                                <WaOption key={font} value={font.replace(/\s/g, '_')}>
                                <span
                                    style={{fontFamily: font === 'System' ? WIDGET_SYSTEM_FONT_STACK : font}}>Typeface</span>
                                </WaOption>
                            ))}
                        </WaSelect>
                    </div>
                    <div className="drawer-horizontal-element">
                        <WaSelect appearance="filled"
                            hoist
                            placement="bottom"
                            size="s"
                            value={String(element?.lineHeight ?? '1')}
                            onChange={handleLineHeightChange}
                            style={{width: '8rem'}}
                        >
                            <WaIcon slot="start" variant="regular" name="distribute-spacing-vertical"/>
                            {[
                                {v: '0.8', t: 'Compact'},
                                {v: '1', t: 'Normal'},
                                {v: '1.2', t: 'Comfort'},
                                {v: '1.6', t: 'Wide'},
                            ].map(opt => (
                                <WaOption key={opt.v} value={opt.v}>{opt.t}</WaOption>
                            ))}
                        </WaSelect>
                    </div>
                    <div className="drawer-horizontal-element">
                        <WaInput appearance="filled"
                            size="s"
                            type="number"
                            min="8"
                            max="48"
                            value={fontSize}
                            onInput={handleSizeChange}
                            style={{width: '6rem'}}
                        >
                            <WaIcon slot="start" variant="regular" name="text-size"/>
                        </WaInput>
                    </div>
                </>
            )}
        </div>
    )
}
