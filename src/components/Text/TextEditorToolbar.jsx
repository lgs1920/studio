/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextEditorToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-09
 * Last modified: 2026-01-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/
import {
    faAlignCenter, faAlignLeft, faAlignRight, faBold, faItalic, faPalette,
}                             from '@fortawesome/pro-solid-svg-icons'
import {
    SlButton, SlButtonGroup, SlIcon, SlTooltip, SlSelect, SlOption, SlInput, SlColorPicker,
}                             from '@shoelace-style/shoelace/dist/react'
import { FA2SL }              from '@Utils/FA2SL'
import { useEffect, useMemo } from 'react'
import { useSnapshot }        from 'valtio'

/**
 * Complete Text formatting toolbar
 * @param {Object} props
 * @param {string} props.id - Element identifier
 * @param {boolean} props.fonts - Toggle font family group
 * @param {boolean} props.size - Toggle font size input
 * @param {boolean} props.color - Toggle color picker
 * @param {boolean} props.align - Toggle alignment group
 * @param {boolean} props.style - Toggle style group
 * @returns {JSX.Element}
 */
export const TextEditorToolbar = ({id, fonts = true, size = true, color = true, align = true, style = true}) => {
    const $configuration = lgs.settings.widgets['text-widget'].configuration
    const configuration = useSnapshot($configuration)

    const $element = $configuration.elements?.[id]
    const element = configuration.elements?.[id]

    const googleFonts = useMemo(() => [
        'Abril Fatface', 'Alumni Sans Pinstripe', 'Bangers', 'Bungee Inline',
        'Caveat', 'Creepster', 'Dancing Script', 'Faster One', 'Fredoka One',
        'Inter', 'Lobster', 'Lora', 'Luckiest Guy', 'Monoton', 'Montserrat',
        'Open Sans', 'Orbitron', 'Oswald', 'Pacifico', 'Permanent Marker',
        'Playfair Display', 'Poppins', 'Press Start 2P', 'Quicksand',
        'Righteous', 'Roboto', 'Shrikhand', 'Source Code Pro', 'Spicy Rice',
    ].sort((a, b) => a.localeCompare(b)), [])

    const fontFamilies = ['System', ...googleFonts]
    const systemStack = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

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

    const isAlignmentDisabled = () => {
        const text = element?.text ?? ''
        if (!text) {
            return true
        }
        const lines = text.split('\n').filter(line => line.trim() !== '')
        return lines.length <= 1
    }

    const alignmentDisabled = isAlignmentDisabled()

    useEffect(() => {
        if (alignmentDisabled && $element && $element.align !== 'left') {
            $element.align = 'left'
        }
    }, [alignmentDisabled, $element])

    const handleFontChange = (e) => {
        if ($element) {
            $element.fontFamily = e.target.value.replace(/_/g, ' ')
        }
    }

    const handleSizeChange = (e) => {
        if ($element) {
            $element.fontSize = e.target.value
        }
    }

    const handleColorChange = (e) => {
        if ($element) {
            $element.color = e.target.value
        }
    }

    const handleAlign = (mode) => {
        if ($element && !alignmentDisabled) {
            $element.align = mode
        }
    }

    const toggleBold = () => {
        if ($element) {
            $element.weight = element?.weight === 'bold' ? 'normal' : 'bold'
        }
    }

    const toggleItalic = () => {
        if ($element) {
            $element.style = element?.style === 'italic' ? 'normal' : 'italic'
        }
    }

    return (
        <div className="text-widget-toolbar" style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
            {fonts && (
                <SlSelect
                    size="small"
                    value={(element?.fontFamily ?? 'System').replace(/\s/g, '_')}
                    onSlChange={handleFontChange}
                    style={{width: '130px'}}
                >
                    {fontFamilies.map(font => (
                        <SlOption key={font} value={font.replace(/\s/g, '_')}>
                            <SlTooltip content={font} placement="right">
                                <span style={{fontFamily: font === 'System' ? systemStack : font, fontSize: '1.1rem'}}>
                                    Typeface
                                </span>
                            </SlTooltip>
                        </SlOption>
                    ))}
                </SlSelect>
            )}

            {size && (
                <SlInput
                    size="small"
                    type="number"
                    value={element?.fontSize ?? 16}
                    onSlInput={handleSizeChange}
                    style={{width: '70px'}}
                />
            )}

            {color && (
                <SlColorPicker
                    size="small"
                    value={element?.color ?? '#000000'}
                    onSlChange={handleColorChange}
                    label="Select color"
                />
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
                    <SlButton
                        size="small"
                        disabled={alignmentDisabled}
                        variant={!alignmentDisabled && element?.align === 'left' ? 'primary' : 'default'}
                        onClick={() => handleAlign('left')}
                    >
                        <SlIcon library="fa" name={FA2SL.set(faAlignLeft)}/>
                    </SlButton>
                    <SlButton
                        size="small"
                        disabled={alignmentDisabled}
                        variant={!alignmentDisabled && element?.align === 'center' ? 'primary' : 'default'}
                        onClick={() => handleAlign('center')}
                    >
                        <SlIcon library="fa" name={FA2SL.set(faAlignCenter)}/>
                    </SlButton>
                    <SlButton
                        size="small"
                        disabled={alignmentDisabled}
                        variant={!alignmentDisabled && element?.align === 'right' ? 'primary' : 'default'}
                        onClick={() => handleAlign('right')}
                    >
                        <SlIcon library="fa" name={FA2SL.set(faAlignRight)}/>
                    </SlButton>
                </SlButtonGroup>
            )}
        </div>
    )
}