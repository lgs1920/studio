/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextColorElement.jsx
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

import { sanitizeNumericControlValue }            from '@Components/MainUI/widgets/editor/elements/sliderUtils'
import { WaColorPicker, WaSlider }                from '@web.awesome.me/webawesome-pro/dist/react'
import { colord }                                 from 'colord'
import React, { useCallback, useEffect, useMemo } from 'react'
import { useSnapshot }                            from 'valtio'

/**
 * Text color and opacity controls.
 */
export const TextColorElement = ({id}) => {
    const $configuration = lgs.settings.widgets['text-widget'].configuration
    const configuration = useSnapshot($configuration)
    const _moveable = useMemo(() => __.ui.widgetManager.getMoveable(id), [id])
    const $element = $configuration?.elements?.[id] ?? $configuration.user ?? $configuration.default
    const element = configuration?.elements?.[id] ?? configuration.user ?? configuration.default
    const swatches = useMemo(() => lgs.settings.getSwatches.list.join(';'), [])

    const textOpacity = useMemo(() => sanitizeNumericControlValue(element?.text?.opacity, 1, {min: 0, max: 1}), [
        element?.text?.opacity,
    ])
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

    const handleColorChange = useCallback((e) => {
        if ($element?.text) {
            $element.text.color = e.target.value
            syncCSS($element.text.color, $element.text.opacity)
            _moveable?.current?.updateRect()
        }
    }, [$element, syncCSS])

    const handleOpacityChange = useCallback((e) => {
        if ($element?.text) {
            $element.text.opacity = sanitizeNumericControlValue(e.target.value, 1, {min: 0, max: 1})
            syncCSS($element.text.color, $element.text.opacity)
        }
    }, [$element, syncCSS])

    useEffect(() => {
        if ($element?.text && element?.text?.opacity !== undefined && element.text.opacity !== textOpacity) {
            $element.text.opacity = textOpacity
            syncCSS($element.text.color, textOpacity)
        }
    }, [$element, element?.text?.opacity, syncCSS, textOpacity])

    return (
        <>
            <div style={{width: '100%'}}>{'Text color'}</div>
            <div className="lgs--text-widget-color-trigger drawer-horizontal-line three-columns">
                <WaColorPicker
                    value={element?.text?.color ?? 'white'}
                    onInput={handleColorChange}
                    size="small"
                    swatches={swatches}
                />
                <div/>
                <WaSlider
                    size="small"
                    label="Opacity"
                    label-at-start
                    min="0"
                    max="1"
                    step="0.05"
                    value={textOpacity}
                    tooltipFormatter={v => `${Math.floor(v * 100)}%`}
                    onInput={handleOpacityChange}
                />
            </div>
        </>
    )
}
