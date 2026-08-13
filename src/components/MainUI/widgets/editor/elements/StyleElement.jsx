/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: StyleElement.jsx
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

import { WaButton, WaButtonGroup, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useMemo }            from 'react'
import { useSnapshot }                     from 'valtio'

/**
 * Text style (B/I) controls element.
 */
export const StyleElement = ({id}) => {

    const $configuration = lgs.settings.widgets['text-widget'].configuration
    const configuration = useSnapshot($configuration)
    const _moveable = useMemo(() => __.ui.widgetManager.getMoveable(id), [id])
    const $element = $configuration?.elements?.[id] ?? $configuration.user ?? $configuration.default
    const element = configuration?.elements?.[id] ?? configuration.user ?? configuration.default

    const toggleBold = useCallback(() => {
        if ($element) {
            $element.weight = element?.weight === 'bold' ? 'normal' : 'bold'
            _moveable?.current?.updateRect()
        }
    }, [$element, element?.weight])

    const toggleItalic = useCallback(() => {
        if ($element) {
            $element.style = element?.style === 'italic' ? 'normal' : 'italic'
            _moveable?.current?.updateRect()
        }
    }, [$element, element?.style])

    return (
        <WaButtonGroup size="s" className="lgs--text-widget-style-trigger">
            <WaButton
                size="xs"
                variant={element?.weight === 'bold' ? 'brand' : 'default'}
                onClick={toggleBold}
            >
                <WaIcon variant="regular" name="bold"/>
            </WaButton>
            <WaButton
                size="xs"
                variant={element?.style === 'italic' ? 'brand' : 'default'}
                onClick={toggleItalic}
            >
                <WaIcon variant="regular" name="italic"/>
            </WaButton>
        </WaButtonGroup>
    )
}
