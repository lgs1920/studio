/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FontSizeElement.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-14
 * Last modified: 2026-04-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { sanitizeNumericControlValue }     from '@Components/MainUI/widgets/editor/elements/sliderUtils'
import { WaIcon, WaNumberInput }           from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useEffect, useMemo } from 'react'
import { useSnapshot }                     from 'valtio'


/**
 * Font size control extracted from FontsElement.
 */
export const FontSizeElement = ({id}) => {

    const $configuration = lgs.settings.widgets['text-widget'].configuration
    const configuration = useSnapshot($configuration)
    const _moveable = useMemo(() => __.ui.widgetManager.getMoveable(id), [id])
    const $element = $configuration?.elements?.[id] ?? $configuration.user ?? $configuration.default
    const element = configuration?.elements?.[id] ?? configuration.user ?? configuration.default

    const fontSize = useMemo(() => sanitizeNumericControlValue(element?.size, 16, {min: 8, max: 48}), [
        element?.size,
    ])

    const sizeLimits = {min: 8, max: 48}

    const handleSizeChange = useCallback((e) => {
        if ($element) {
            $element.size = sanitizeNumericControlValue(e.target.value, 16, sizeLimits)
            _moveable.updateRect()
        }
    }, [$element])

    useEffect(() => {
        if ($element && element?.size !== undefined && element.size !== fontSize) {
            $element.size = fontSize
            _moveable.updateRect()
        }

    }, [$element, element?.size, fontSize])

    return (
        <WaNumberInput
            size="small"
            type="number"
            min={sizeLimits.min}
            max={sizeLimits.max}
            value={fontSize}
            onInput={handleSizeChange}
            className="lgs--short-input lgs--text-widget-font-size-trigger"
        >
            <WaIcon slot="start" variant="regular" name="text-size"/>
        </WaNumberInput>
    )
}
