/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TypefaceElement.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-18
 * Last modified: 2026-06-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { TEXT_WIDGET, WIDGET_FONT_FAMILIES, WIDGET_SYSTEM_FONT_STACK } from '@Core/constants'
import { WaIcon, WaOption, WaSelect }                                  from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useMemo }                                        from 'react'
import { useSnapshot }                                                 from 'valtio'

/**
 * Font family selector element.
 */
export const TypefaceElement = ({id}) => {

    const $configuration = lgs.settings.widgets[TEXT_WIDGET].configuration
    const configuration = useSnapshot($configuration)
    const _moveable = useMemo(() => __.ui.widgetManager.getMoveable(id), [id])
    const $element = $configuration?.elements?.[id] ?? $configuration.user ?? $configuration.default
    const element = configuration?.elements?.[id] ?? configuration.user ?? configuration.default
    const currentFont = element?.fontFamily ?? 'System'
    const appliedFontStack = currentFont === 'System' ? WIDGET_SYSTEM_FONT_STACK : currentFont

    const handleFontChange = useCallback((e) => {
        if ($element) {
            $element.fontFamily = e.target.value.replace(/_/g, ' ')
            _moveable?.current?.updateRect()
        }
    }, [$element])

    return (
        <WaSelect appearance="filled"
            size="s"
            value={currentFont.replace(/\s/g, '_')}
            className="lgs--text-widget-typeface-trigger"
            onChange={handleFontChange}
        >
            <WaIcon slot="start" variant="regular" name="text"/>
            {WIDGET_FONT_FAMILIES.map(font => (
                <WaOption key={font} value={font.replace(/\s/g, '_')}>
                    <span style={{fontFamily: font === 'System' ? WIDGET_SYSTEM_FONT_STACK : font}}>Typeface</span>
                </WaOption>
            ))}
        </WaSelect>
    )
}
