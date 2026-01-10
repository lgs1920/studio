/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextEditorToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-10
 * Last modified: 2026-01-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

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
    const $element = $configuration.elements?.[id]
    /** @type {Object} Snapshot of the specific text element */
    const element = configuration.elements?.[id]

    const googleFonts = useMemo(() => [
        'Abril Fatface', 'Alumni Sans Pinstripe', 'Bangers', 'Creepster', 'Dancing Script',
        'Fredoka One', 'Lobster', 'Luckiest Guy', 'Open Sans', 'Oswald', 'Pacifico', 'Quicksand',
        'Roboto', 'Source Code Pro',
    ].sort((a, b) => a.localeCompare(b)), [])

    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])

    const fontFamilies = useMemo(() => ['System', ...googleFonts], [googleFonts])
    const systemStack = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

    /**
     * Injects selected Google Fonts into the document head
     */
    useEffect(() => {
        const familiesParam = googleFonts.map(f => f.replace(/\s+/g, '+')).join('|')
        const linkId = 'gfonts-toolbar-preview'

        if (!document.getElementById(linkId)) {
            const link = document.createElement('link')
            link.id = linkId
            link.rel = 'stylesheet'
            link.href = `https://fonts.googleapis.com/css?family=${familiesParam}&display=swap`
            document.head.appendChild(link)
        }
    }, [googleFonts])

    const alignmentDisabled = useMemo(() => {
        const text = element?.text ?? ''
        return text.split('\n').filter(line => line.trim() !== '').length <= 1
    }, [element?.text])

    useEffect(() => {
        if (alignmentDisabled && $element && $element.align !== 'left') {
            $element.align = 'left'
        }
    }, [alignmentDisabled, $element])

    /**
     * Handlers using the correct mapping between proxy and snapshot
     */
    const handleFontChange = useCallback((e) => {
        if ($element) {
            $element.fontFamily = e.target.value.replace(/_/g, ' ')
        }
    }, [$element])

    const handleSizeChange = useCallback((e) => {
        if ($element) {
            $element.size = Number(e.target.value)
        }
    }, [$element])

    const handleLineHeightChange = useCallback((e) => {
        if ($element) {
            $element.lineHeight = e.target.value
        }
    }, [$element])

    const handleColorChange = useCallback((e) => {
        if ($element) {
            $element.color = e.target.value
        }
    }, [$element])

    const handleOpacityChange = useCallback((e) => {
        if ($element) {
            $element.opacity = parseFloat(e.target.value)
        }
    }, [$element])

    const toggleBold = useCallback(() => {
        if ($element) {
            $element.weight = element?.weight === 'bold' ? 'normal' : 'bold'
        }
    }, [$element, element?.weight])

    const toggleItalic = useCallback(() => {
        if ($element) {
            $element.style = element?.style === 'italic' ? 'normal' : 'italic'
        }
    }, [$element, element?.style])

    const currentFont = element?.fontFamily ?? 'System'
    const appliedFontStack = currentFont === 'System' ? systemStack : currentFont

    return (
        <div className="text-widget-toolbar" style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
            {color && (
                <>
                    <SlColorPicker
                        value={element?.color ?? '#000000'}
                        onSlChange={handleColorChange}
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
                        {fontFamilies.map(font => (
                            <SlOption key={font} value={font.replace(/\s/g, '_')}>
                                <span style={{fontFamily: font === 'System' ? systemStack : font}}>{'Typeface'}</span>
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