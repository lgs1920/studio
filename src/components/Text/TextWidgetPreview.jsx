/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextWidgetPreview.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-19
 * Last modified: 2026-02-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WIDGET_SYSTEM_FONT_STACK }                                       from '@Core/constants'
import { TextWidgetManager }                                              from '@Core/ui/text-metrics/TextWidgetManager'
import { SlTextarea }                                                     from '@shoelace-style/shoelace/dist/react'
import React, { memo, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useSnapshot }                                                    from 'valtio'

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
            ...dynamicVars,
            transform: isEditing ? 'none' : `rotate(${activeRotation}deg)`,
        }}>
            <SlTextarea className="text-widget-preview-area"
                        size="small"
                        value={element.text.content || ''}
                        onSlInput={(e) => {
                            updateText(e.target.value)
                            if (isEditing) {
                                resetRotationTimer()
                            }
                        }}
                        onSlFocus={() => setIsEditing(true)}
                        onSlBlur={resetRotationTimer}
                        onKeyDown={handleKeyDown}
                        enterkeyhint="enter"
            />
        </div>
    )
})