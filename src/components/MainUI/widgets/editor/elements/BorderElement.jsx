/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: BorderElement.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-18
 * Last modified: 2026-06-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaSwitch }                          from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useEffect, useRef } from 'react'
import { LineElement }                       from './LineElement'
import { RadiusElement }                     from './RadiusElement'
import { sanitizeNumericControlValue }       from './sliderUtils'
import { realignWidgetAroundContent }        from './widgetContentRealign'

/**
 * Common border & radius editor element
 * @param {Object} props
 * @param {boolean} [props.showRadius=true] - MUST be used to toggle visibility
 */
export const BorderElement = ({
                                  element,
                                  swatches,
                                  getColor,
                                  updateValue,
                                  moveableId,
                                  autoRealign = false,
                                  showPill = false,
                                  showRadius = true,
                                  showScale = true,
                                  showRadiusScale = true,
                                  sanitizeSliderValue = sanitizeNumericControlValue,
                              }) => {
    const widthRef = useRef(null)
    const realignFrameRef = useRef(null)
    const trailingRealignFrameRef = useRef(null)
    const borderWidth = sanitizeSliderValue(element.border?.thickness, 1, {min: 0, max: 10})
    const borderOpacity = sanitizeSliderValue(element.border?.opacity, 1, {min: 0, max: 1})

    useEffect(() => {
        if (widthRef.current) {
            widthRef.current.value = borderWidth
        }

        if (element.border?.thickness !== undefined &&
            element.border?.thickness !== null &&
            element.border?.thickness !== borderWidth) {
            updateValue('border.thickness', borderWidth)
        }
    }, [borderWidth, element.border?.thickness, updateValue])

    useEffect(() => {
        return () => {
            if (realignFrameRef.current !== null) {
                cancelAnimationFrame(realignFrameRef.current)
            }
            if (trailingRealignFrameRef.current !== null) {
                cancelAnimationFrame(trailingRealignFrameRef.current)
            }
        }
    }, [])

    const realignWidget = useCallback(() => {
        if (!moveableId) {
            return
        }
        if (realignFrameRef.current !== null) {
            return
        }

        realignFrameRef.current = requestAnimationFrame(() => {
            realignFrameRef.current = null
            trailingRealignFrameRef.current = requestAnimationFrame(() => {
                trailingRealignFrameRef.current = requestAnimationFrame(() => {
                    trailingRealignFrameRef.current = null
                    realignWidgetAroundContent(moveableId)
                    __.ui.widgetManager.getMoveable(moveableId)?.current?.updateRect()
                })
            })
        })
    }, [moveableId])

    useEffect(() => {
        if (!autoRealign || !moveableId) {
            return undefined
        }

        const frame = requestAnimationFrame(() => {
            realignWidget()
        })

        return () => cancelAnimationFrame(frame)
    }, [
        autoRealign,
        moveableId,
        realignWidget,
        element.border?.show,
        element.border?.scaled,
        element.border?.radiusScaled,
        element.border?.thickness,
        element.border?.radius,
    ])

    return (
        <div className="lgs-border-element">
            <WaSwitch
                label-at-start
                size="xs"
                checked={element.border?.show ?? false}
                onInput={(e) => {
                    updateValue('border.show', e.target.checked)
                    realignWidget()
                }}
            >
                <span>{'Border'}</span>
            </WaSwitch>

            {element.border?.show && (
                <LineElement
                    widthRef={widthRef}
                    swatches={swatches}
                    colorValue={getColor(element.border)}
                    onColorInput={(value) => updateValue('border.color', value)}
                    widthDefaultValue={borderWidth}
                    onWidthInput={(value) => {
                        updateValue(
                            'border.thickness',
                            sanitizeSliderValue(value, 1, {min: 0, max: 10}),
                        )
                        realignWidget()
                    }}
                    opacityValue={borderOpacity}
                    onOpacityInput={(value) => updateValue(
                        'border.opacity',
                        sanitizeSliderValue(value, borderOpacity, {min: 0, max: 1}),
                    )}
                    showScale={showScale}
                    scaled={element.border?.scaled ?? false}
                    onScaleChange={(checked) => {
                        updateValue('border.scaled', checked)
                        realignWidget()
                    }}
                >
                    {showRadius && (
                        <RadiusElement
                            element={element}
                            updateValue={updateValue}
                            showPill={showPill}
                            showScale={showRadiusScale}
                        />
                    )}
                </LineElement>
            )}
        </div>
    )
}
