/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextWidgetPreview.jsx
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

import { WIDGET_SYSTEM_FONT_STACK }                                       from '@Core/constants'
import { TextWidgetManager }                                              from '@Core/ui/text-metrics/TextWidgetManager'
import {
    WaTextarea,
}                                                            from '@web.awesome.me/webawesome-pro/dist/react'
import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                                    from 'valtio'

const PREVIEW_MEASURE_BUFFER = 4

/**
 * Normalized Text Widget Preview.
 * Handles display on stage and interactive editing logic.
 */
export const TextWidgetPreview = memo(({entity}) => {
    const $widget = lgs.stores.ui.widget
    const widget = useSnapshot($widget)
    const currentSnapshot = widget.currentSnapshot

    const $configuration = lgs.settings.widgets['text-widget'].configuration
    const configuration = useSnapshot($configuration)

    const [initialRotation, setInitialRotation] = useState(0)
    const [isEditing, setIsEditing] = useState(false)
    const _timer = useRef(null)
    const _textWidgetManager = useMemo(() => TextWidgetManager.instance, [])

    const element = useMemo(() => {
        return configuration.elements?.[entity] ?? configuration.user ?? configuration.default
    }, [configuration, entity])

    const _moveable = useMemo(() => {
        return __.ui.widgetManager.getMoveable(entity)
    }, [entity])

    /**
     * Restore rotation from manager if not currently active in store
     */
    useEffect(() => {
        let isMounted = true
        const fetchPosition = async () => {
            if (!entity) {
                return
            }
            const position = await __.ui.widgetManager.getWidgetPosition(entity)
            if (isMounted && position) {
                setInitialRotation(Number(position.rotate) || 0)
            }
        }
        fetchPosition()
        return () => {
            isMounted = false
        }
    }, [entity])

    const updateText = (val) => {
        if (!configuration.elements?.[entity]) {
            $configuration.elements[entity] = JSON.parse(JSON.stringify(element))
        }
        $configuration.elements[entity].text.content = val
        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
    }

    const resetRotationTimer = () => {
        if (_timer.current) {
            clearTimeout(_timer.current)
        }
        _timer.current = setTimeout(() => setIsEditing(false), 1000)
    }

    /**
     * Priority to live Valtio store if selected, otherwise use fetched initial rotation
     */
    const isSelected = widget.current?.id === entity
    const activeRotation = isSelected && widget.current?.rotate !== undefined
                           ? Number(widget.current.rotate)
                           : initialRotation

    const dynamicVars = useMemo(() => {
        if (!element?.text) {
            return {}
        }
        return _textWidgetManager.generateCSSVariables(element, currentSnapshot?.image, WIDGET_SYSTEM_FONT_STACK)
    }, [element, currentSnapshot?.image, _textWidgetManager])

    const contentSize = useMemo(() => {
        const content = element?.text?.content ?? ''
        const fontSize = Number(element?.size ?? 16)
        const lineHeight = Number.parseFloat(element?.lineHeight ?? 1) || 1
        const lineHeightPx = fontSize * lineHeight
        const basePadding = Math.max(4, lineHeightPx * 0.25)
        const paddingSide = element?.border?.pill ? basePadding * 2.5 : basePadding
        const paddingTopBottom = Math.max(4, lineHeightPx * 0.25)
        const borderThickness = element?.border?.show ? Number(element.border?.thickness ?? 0) : 0
        const strokeWidth = element?.text?.stroke?.show ? Number(element.text.stroke?.width ?? 0) : 0

        const lines = (content || ' ').split('\n')
        const fontFamily = element?.fontFamily === 'System' ? WIDGET_SYSTEM_FONT_STACK : (element?.fontFamily || WIDGET_SYSTEM_FONT_STACK)
        const fontWeight = element?.weight ?? 'normal'
        const fontStyle = element?.style ?? 'normal'

        let maxLineWidth = fontSize
        if (typeof document !== 'undefined') {
            const canvas = document.createElement('canvas')
            const context = canvas.getContext('2d')
            if (context) {
                context.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`
                maxLineWidth = lines.reduce((maxWidth, line) => {
                    const measuredWidth = context.measureText(line || ' ').width
                    return Math.max(maxWidth, measuredWidth)
                }, fontSize)
            }
        }

        return {
            width:  Math.ceil(maxLineWidth + (paddingSide * 2) + (borderThickness * 2) + (strokeWidth * 2) + PREVIEW_MEASURE_BUFFER),
            height: Math.ceil((lines.length * lineHeightPx) + (paddingTopBottom * 2) + (borderThickness * 2) + (strokeWidth * 2) + PREVIEW_MEASURE_BUFFER),
        }
    }, [
                                    element?.border?.pill,
                                    element?.border?.show,
                                    element?.border?.thickness,
                                    element?.fontFamily,
                                    element?.lineHeight,
                                    element?.size,
                                    element?.style,
                                    element?.text?.content,
                                    element?.text?.stroke?.show,
                                    element?.text?.stroke?.width,
                                    element?.weight,
                                ])

    useEffect(() => {
        if (_moveable?.current) {
            requestAnimationFrame(() => {
                _moveable.current?.updateRect()
            })
        }
    }, [contentSize.height, contentSize.width, _moveable])

    const previewVars = useMemo(() => ({
        ...dynamicVars,
        '--lgs-preview-content-width':  `${contentSize.width || 1}px`,
        '--lgs-preview-content-height': `${contentSize.height || 1}px`,
    }), [dynamicVars, contentSize.height, contentSize.width])

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === 'Backspace') {
            e.stopPropagation()
        }
    }

    if (!element?.text) {
        return null
    }

    return (
        <div style={{
            ...previewVars,
            transform: isEditing ? 'none' : `rotate(${activeRotation}deg)`,
        }}>
            <WaTextarea className="text-widget-preview-area"
                        size="small"
                        rows={1}
                        resize="auto"
                        value={element.text.content || ''}
                        onInput={(e) => {
                            updateText(e.target.value)
                            if (isEditing) {
                                resetRotationTimer()
                            }
                        }}
                        onFocus={() => setIsEditing(true)}
                        onBlur={resetRotationTimer}
                        onKeyDown={handleKeyDown}
                        enterkeyhint="enter"
            />
        </div>
    )
})
