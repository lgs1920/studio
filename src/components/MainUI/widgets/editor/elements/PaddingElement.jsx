/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PaddingElement.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaSlider }                                from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { ScaleSwitchElement }                      from './ScaleSwitchElement'
import { sanitizeNumericControlValue }             from './sliderUtils'
import { realignWidgetAroundContent }              from './widgetContentRealign'

const DEFAULT_LIMITS = {min: 0, max: 80}

const buildPaddingPath = (path, side) => `${path}.${side}`

export const PaddingElement = ({
                                   element,
                                   updateValue,
                                   path = 'padding',
                                   label = 'Padding',
                                   fallback = 5,
                                   limits = DEFAULT_LIMITS,
                                   moveableId,
                                   autoRealign = false,
                               }) => {
    const sliderRef = useRef(null)
    const realignFrameRef = useRef(null)
    const trailingRealignFrameRef = useRef(null)
    const padding = element?.[path] ?? {}
    const paddingValue = useMemo(() => {
        return sanitizeNumericControlValue(padding.top, fallback, limits)
    }, [fallback, limits, padding.top])

    useEffect(() => {
        if (sliderRef.current) {
            sliderRef.current.value = paddingValue
        }
    }, [paddingValue])

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
    }, [autoRealign, moveableId, realignWidget])

    const updatePadding = (rawValue) => {
        const value = sanitizeNumericControlValue(rawValue, fallback, limits)

        updateValue(buildPaddingPath(path, 'top'), value)
        updateValue(buildPaddingPath(path, 'right'), value)
        updateValue(buildPaddingPath(path, 'bottom'), value)
        updateValue(buildPaddingPath(path, 'left'), value)
        realignWidget()
    }

    return (
        <div className="lgs-widget-padding-element">
            <div>
                <WaSlider
                    ref={sliderRef}
                    half-width
                    size="s"
                    label={label}
                    min={limits.min}
                    max={limits.max}
                    step="1"
                    label-at-start
                    placement="top"
                    withTooltip
                    defaultValue={paddingValue}
                    onInput={(e) => updatePadding(e.target.value)}
                />
                <ScaleSwitchElement
                    checked={padding.scaled ?? false}
                    onChange={(checked) => {
                        updateValue(buildPaddingPath(path, 'scaled'), checked)
                        realignWidget()
                    }}
                />
            </div>
        </div>
    )
}
