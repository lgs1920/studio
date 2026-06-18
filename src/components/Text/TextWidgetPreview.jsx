/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextWidgetPreview.jsx
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

import { WIDGET_SYSTEM_FONT_STACK }                                       from '@Core/constants'
import { TextWidgetManager }                                              from '@Core/ui/text-metrics/TextWidgetManager'
import { useWidgetScaleCorrection }                                       from '@Components/MainUI/widgets/useWidgetScaleCorrection'
import {
    WaTextarea,
}                                                            from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                                    from 'valtio'

const PREVIEW_MEASURE_BUFFER = 4
const PREVIEW_FIT_RATIO = 0.88

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
    const [previewScale, setPreviewScale] = useState(1)
    const _timer = useRef(null)
    const _previewRef = useRef(null)
    const _textWidgetManager = useMemo(() => TextWidgetManager.instance, [])
    const scaleCorrection = useWidgetScaleCorrection(entity)
    const widgetVisualScale = useMemo(() => {
        const value = 1 / (scaleCorrection || 1)
        return Number.isFinite(value) && value > 0 ? value : 1
    }, [scaleCorrection])

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
        return _textWidgetManager.generateCSSVariables(element, currentSnapshotImage, WIDGET_SYSTEM_FONT_STACK, {
            correction: 1,
        })
    }, [currentSnapshotImage, element, _textWidgetManager])

    const contentSize = useMemo(() => {
        return _textWidgetManager.measureContent(element, WIDGET_SYSTEM_FONT_STACK, {
            buffer: PREVIEW_MEASURE_BUFFER,
            correction: scaleCorrection,
        })
    }, [element, scaleCorrection, _textWidgetManager])

    const previewSize = useMemo(() => {
        return _textWidgetManager.measureContent(element, WIDGET_SYSTEM_FONT_STACK, {
            buffer:     PREVIEW_MEASURE_BUFFER,
            correction: 1,
        })
    }, [element, _textWidgetManager])

    const updatePreviewScale = useCallback(() => {
        const previewContainer = _previewRef.current?.parentElement
        if (!previewContainer) {
            setPreviewScale(1)
            return
        }

        const availableWidth = previewContainer.clientWidth || previewContainer.getBoundingClientRect().width || 0
        const availableHeight = previewContainer.clientHeight || previewContainer.getBoundingClientRect().height || 0
        if (availableWidth <= 0 || availableHeight <= 0 || !Number.isFinite(previewSize.width) || !Number.isFinite(previewSize.height)) {
            setPreviewScale(1)
            return
        }

        const fitWidth = availableWidth * PREVIEW_FIT_RATIO
        const fitHeight = availableHeight * PREVIEW_FIT_RATIO
        const nextScale = Math.min(1, fitWidth / previewSize.width, fitHeight / previewSize.height)
        setPreviewScale(Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1)
    }, [previewSize.height, previewSize.width])

    useEffect(() => {
        if (_moveable?.current) {
            requestAnimationFrame(() => {
                _moveable.current?.updateRect()
            })
        }
    }, [contentSize.height, contentSize.width, _moveable])

    useEffect(() => {
        updatePreviewScale()

        const previewContainer = _previewRef.current?.parentElement
        if (!previewContainer || typeof ResizeObserver === 'undefined') {
            return undefined
        }

        let frame = null
        const observer = new ResizeObserver(() => {
            if (frame !== null) {
                cancelAnimationFrame(frame)
            }
            frame = requestAnimationFrame(updatePreviewScale)
        })

        observer.observe(previewContainer)

        return () => {
            if (frame !== null) {
                cancelAnimationFrame(frame)
            }
            observer.disconnect()
        }
    }, [updatePreviewScale])

    const previewVars = useMemo(() => ({
        ...dynamicVars,
        '--lgs-preview-content-width':  `${previewSize.width || 1}px`,
        '--lgs-preview-content-height': `${previewSize.height || 1}px`,
    }), [dynamicVars, previewSize.height, previewSize.width])

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === 'Backspace') {
            e.stopPropagation()
        }
    }

    if (!element?.text) {
        return null
    }

    return (
        <div ref={_previewRef} style={{
            ...previewVars,
            transform:       isEditing ? 'none' : `rotate(${activeRotation}deg) scale(${widgetVisualScale * previewScale})`,
            transformOrigin: 'center center',
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
