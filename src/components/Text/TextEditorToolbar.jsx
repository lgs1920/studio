/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextEditorToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-02
 * Last modified: 2026-02-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    WIDGET_FONT_FAMILIES, WIDGET_GOOGLE_FONTS, WIDGET_SYSTEM_FONT_STACK,
}                                          from '@Core/constants'
import {
    faAlignCenter, faAlignLeft, faAlignRight, faBold, faItalic,
}                                          from '@fortawesome/pro-solid-svg-icons'
import {
    faDistributeSpacingVertical,
    faText, faTextSize,
}                                          from '@fortawesome/pro-regular-svg-icons'
import {
    SlButton, SlButtonGroup, SlIcon, SlSelect, SlOption, SlInput, SlColorPicker, SlRange,
}                                          from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                           from '@Utils/FA2SL'
import { useEffect, useMemo, useCallback } from 'react'
import { useSnapshot }                     from 'valtio'

/**
 * Complete Text formatting toolbar
 * @param {Object} props
 * @param {string} props.id - Element identifier
 * @param {boolean} [props.fonts=false]
 * @param {boolean} [props.color=true]
 * @param {boolean} [props.align=true]
 * @param {boolean} [props.style=true]
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

    const scheduleUpdate = useCallback(() => {
        if (!_moveable?.current) {
            return
        }

        // First update immediately
        requestAnimationFrame(() => {
            _moveable.current.updateRect()

            // Second update slightly delayed to catch font-swaps or slow layout shifts
            setTimeout(() => {
                _moveable.current?.updateRect()
            }, 50)
        })
    }, [_moveable])


    /**
     * Injects selected Google Fonts into the document head
     */
    useEffect(() => {
        __.ui.ui.importFonts()
    }, [])

    const alignmentDisabled = useMemo(() => {
        const text = element?.text ?? ''
        return text.split('\n').filter(line => line.trim() !== '').length <= 1
    }, [element?.text])

    useEffect(() => {
        if (alignmentDisabled && $element && $element.align !== 'left') {
            $element.align = 'left'
        }
    }, [alignmentDisabled, $element, scheduleUpdate])

    /**
     * Handlers using the correct mapping between proxy and snapshot
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
            $element.color = e.target.value
            scheduleUpdate()
        }
    }, [$element, scheduleUpdate])

    const handleOpacityChange = useCallback((e) => {
        if ($element) {
            $element.opacity = parseFloat(e.target.value)
        }
    }, [$element, scheduleUpdate])

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
        <div className="text-widget-toolbar" style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
            {color && (
                <>
                    <SlColorPicker
                        value={element?.color ?? '#000000'}
                        onSlInput={handleColorChange}
                        size="small"
                        swatches={swatches}
                    />
                    <SlRange
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={element?.opacity ?? 1}
                        onSlInput={handleOpacityChange}
                    />
                </>
            )}

            {style && (
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
            )}

            {align && (
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
            )}

            {fonts && (
                <>
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
                                    style={{fontFamily: font === 'System' ? WIDGET_SYSTEM_FONT_STACK : font}}>{'Typeface'}</span>
                            </SlOption>
                        ))}
                    </SlSelect>

                    <SlSelect
                        hoist
                        size="small"
                        value={element?.lineHeight ?? '1'}
                        onSlChange={handleLineHeightChange}
                        style={{flex: '1'}}
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
                </>
            )}
        </div>
    )
}