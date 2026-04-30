/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PaddingElement.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaSlider }                                from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { ScaleSwitchElement }                      from './ScaleSwitchElement'
import { sanitizeNumericControlValue }             from './sliderUtils'

const DEFAULT_LIMITS = {min: 0, max: 80}

const buildPaddingPath = (path, side) => `${path}.${side}`

const getWidgetContentElement = target => {
    if (!target) {
        return null
    }

    return Array.from(target.children).find(child => !child.classList.contains('lgs-widget-inner-overlay')) ?? null
}

const getMeasuredSize = (element, fallback = 0) => {
    if (!element) {
        return fallback
    }

    const size = Math.max(
        element.offsetWidth ?? 0,
        element.scrollWidth ?? 0,
        fallback,
    )

    return Number.isFinite(size) && size > 0 ? Math.ceil(size) : fallback
}

const getMeasuredHeight = (element, fallback = 0) => {
    if (!element) {
        return fallback
    }

    const size = Math.max(
        element.offsetHeight ?? 0,
        element.scrollHeight ?? 0,
        fallback,
    )

    return Number.isFinite(size) && size > 0 ? Math.ceil(size) : fallback
}

export const PaddingElement = ({
                                   element,
                                   updateValue,
                                   path = 'padding',
                                   label = 'Padding',
                                   fallback = 5,
                                   limits = DEFAULT_LIMITS,
                                   alignScaleAfterColor = false,
                                   moveableId,
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
            const moveable = __.ui.widgetManager.getMoveable(moveableId)
            const target = moveable?.current?.target

            if (target) {
                const config = __.ui.widgetManager.getWidgetConfig(moveableId)
                const previousWidth = target.style.width
                const previousHeight = target.style.height

                target.style.width = 'auto'
                target.style.height = 'auto'

                const content = getWidgetContentElement(target)
                const width = getMeasuredSize(content, getMeasuredSize(target))
                const height = getMeasuredHeight(content, getMeasuredHeight(target))

                if (width > 0 && height > 0) {
                    target.style.width = `${width}px`
                    target.style.height = `${height}px`

                    if (config) {
                        config.dimensions = {width, height}
                        if (config.persist && config.runtimeReady) {
                            void __.ui.widgetManager.saveWidgetPosition(moveableId, config)
                        }
                    }
                }
                else {
                    target.style.width = previousWidth
                    target.style.height = previousHeight
                }
            }

            moveable?.current?.updateRect()

            if (trailingRealignFrameRef.current !== null) {
                cancelAnimationFrame(trailingRealignFrameRef.current)
            }
            trailingRealignFrameRef.current = requestAnimationFrame(() => {
                trailingRealignFrameRef.current = null
                moveable?.current?.updateRect()
            })
        })
    }, [moveableId])

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
            <div className="drawer-horizontal-line">
                <div className="drawer-horizontal-element lgs-widget-padding-slider">
                    <WaSlider
                        ref={sliderRef}
                        size="small"
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
                </div>
            </div>
            <ScaleSwitchElement
                checked={padding.scaled ?? false}
                onChange={(checked) => {
                    updateValue(buildPaddingPath(path, 'scaled'), checked)
                    realignWidget()
                }}
                alignAfterColor={alignScaleAfterColor}
                className="lgs-widget-padding-scaled-line"
            />
        </div>
    )
}
