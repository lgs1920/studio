/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextWidgetPreview.jsx
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

import { WIDGET_SYSTEM_FONT_STACK }                                       from '@Core/constants'
import { TextWidgetManager }                                              from '@Core/ui/text-metrics/TextWidgetManager'
import {
    WaTextarea,
}                                                            from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
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
    const currentSnapshotImage = currentSnapshot?.entity === entity ? currentSnapshot.image : null

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
        return _textWidgetManager.generateCSSVariables(element, currentSnapshotImage, WIDGET_SYSTEM_FONT_STACK)
    }, [element, currentSnapshotImage, _textWidgetManager])

    const contentSize = useMemo(() => {
        return _textWidgetManager.measureContent(element, WIDGET_SYSTEM_FONT_STACK, {
            buffer: PREVIEW_MEASURE_BUFFER,
        })
    }, [element, _textWidgetManager])

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
