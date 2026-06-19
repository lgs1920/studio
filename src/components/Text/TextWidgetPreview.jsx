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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                                    from 'valtio'

const PREVIEW_MEASURE_BUFFER = 4
const PREVIEW_FIT_RATIO = 0.95

const textFromEditable = element => (element?.innerText ?? element?.textContent ?? '').replace(/\u00a0/g, ' ')

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

    const [isEditing, setIsEditing] = useState(false)
    const [previewScale, setPreviewScale] = useState(1)
    const _timer = useRef(null)
    const _previewRef = useRef(null)
    const _inputRef = useRef(null)
    const _textWidgetManager = useMemo(() => TextWidgetManager.instance, [])
    const scaleCorrection = useWidgetScaleCorrection(entity)
    const element = configuration.elements?.[entity] ?? configuration.user ?? configuration.default
    const textScaled = element?.scaled ?? true
    const widgetVisualScale = useMemo(() => {
        const value = 1 / (scaleCorrection || 1)
        return Number.isFinite(value) && value > 0 ? value : 1
    }, [scaleCorrection])

    const _moveable = useMemo(() => {
        return __.ui.widgetManager.getMoveable(entity)
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
     * Priority to live Valtio store if selected, otherwise use persisted configuration rotation.
     */
    const isSelected = widget.current?.id === entity
    const rotation = Number(element?.rotate ?? 0)
    const activeRotation = isSelected && widget.current?.rotate !== undefined
                           ? Number(widget.current.rotate)
                           : rotation

    const dynamicVars = element?.text ? _textWidgetManager.generateCSSVariables(element, currentSnapshotImage, WIDGET_SYSTEM_FONT_STACK, {
        correction: scaleCorrection,
    }) : {}

    const contentSize = _textWidgetManager.measureContent(element, WIDGET_SYSTEM_FONT_STACK, {
        buffer: PREVIEW_MEASURE_BUFFER,
        correction: scaleCorrection,
    })

    const previewSize = _textWidgetManager.measureContent(element, WIDGET_SYSTEM_FONT_STACK, {
        buffer:     PREVIEW_MEASURE_BUFFER,
        correction: scaleCorrection,
    })
    const widgetConfig = __.ui.widgetManager.getWidgetConfig?.(entity)
    const effectivePreviewSize = {
        width:  Math.max(previewSize.width || 0, Number(widgetConfig?.dimensions?.width) || 0),
        height: Math.max(previewSize.height || 0, Number(widgetConfig?.dimensions?.height) || 0),
    }

    const previewRotation = Number.isFinite(Number(activeRotation)) ? Number(activeRotation) : 0

    const updatePreviewScale = useCallback(() => {
        if (!textScaled) {
            setPreviewScale(1)
            return
        }

        const previewContainer = _previewRef.current?.parentElement
        if (!previewContainer) {
            setPreviewScale(1)
            return
        }

        const availableWidth = previewContainer.clientWidth || previewContainer.getBoundingClientRect().width || 0
        const availableHeight = previewContainer.clientHeight || previewContainer.getBoundingClientRect().height || 0
        if (availableWidth <= 0 || availableHeight <= 0 || !Number.isFinite(effectivePreviewSize.width) || !Number.isFinite(effectivePreviewSize.height)) {
            setPreviewScale(1)
            return
        }

        const radians = (previewRotation * Math.PI) / 180
        const absCos = Math.abs(Math.cos(radians))
        const absSin = Math.abs(Math.sin(radians))
        const rotatedWidth = (effectivePreviewSize.width * absCos) + (effectivePreviewSize.height * absSin)
        const rotatedHeight = (effectivePreviewSize.width * absSin) + (effectivePreviewSize.height * absCos)
        const fitWidth = availableWidth * PREVIEW_FIT_RATIO
        const fitHeight = availableHeight * PREVIEW_FIT_RATIO
        const maxScale = Math.min(
            fitWidth / rotatedWidth,
            fitHeight / rotatedHeight,
        )
        const nextScale = Math.min(1, maxScale / (widgetVisualScale || 1))
        setPreviewScale(Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1)
    }, [effectivePreviewSize.height, effectivePreviewSize.width, previewRotation, textScaled, widgetVisualScale])

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

    useEffect(() => {
        if (!_inputRef.current || isEditing) {
            return
        }

        const nextText = element.text?.content ?? ''
        if (_inputRef.current.textContent !== nextText) {
            _inputRef.current.textContent = nextText
        }
    }, [element.text?.content, isEditing])

    const previewVars = {
        ...dynamicVars,
        '--lgs-preview-content-width':  `${effectivePreviewSize.width || 1}px`,
        '--lgs-preview-content-height': `${effectivePreviewSize.height || 1}px`,
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === 'Backspace') {
            e.stopPropagation()
        }
    }

    if (!element?.text) {
        return null
    }

    const displayValue = element.text.content || '\u00A0'
    const wrapperStyles = {
        ...previewVars,
        display:         'grid',
        position:        'relative',
        width:           'var(--lgs-preview-content-width)',
        height:          'var(--lgs-preview-content-height)',
        minWidth:        '1ch',
        boxSizing:       'border-box',
        placeItems:      'center',
        backgroundColor: 'var(--lgs-tx-bg-color)',
        backdropFilter:  'blur(var(--lgs-tx-blur))',
        border:          'var(--lgs-tx-border)',
        borderRadius:    'var(--lgs-tx-radius)',
        boxShadow:       'var(--lgs-bg-elevation)',
        overflow:        'hidden',
        opacity:         element.opacity ?? 1,
        transform:       `rotate(${activeRotation}deg) scale(${widgetVisualScale * previewScale})`,
        transformOrigin: 'center center',
    }
    const textStyles = {
        font:                 'inherit',
        fontSize:             'var(--lgs-tx-size)',
        fontFamily:           'var(--lgs-tx-font)',
        fontWeight:           'var(--lgs-tx-weight)',
        fontStyle:            'var(--lgs-tx-style)',
        textAlign:            'var(--lgs-tx-align)',
        lineHeight:           'var(--lgs-tx-line-height)',
        whiteSpace:           'pre',
        margin:               0,
        padding:              'var(--lgs-tx-padding-top) var(--lgs-tx-padding-right) var(--lgs-tx-padding-bottom) var(--lgs-tx-padding-left)',
        boxSizing:            'border-box',
        color:                'var(--lgs-tx-color)',
        textShadow:           'var(--lgs-tx-shadow)',
        overflow:             'visible',
        outline:              'none',
        caretColor:           'var(--lgs-tx-color)',
        width:                textScaled ? '100%' : 'max-content',
        minWidth:             'max-content',
        minHeight:            '1em',
        gridArea:             '1 / 1',
        cursor:               'text',
        userSelect:           isEditing ? 'text' : 'none',
        WebkitTextFillColor:  'var(--lgs-tx-color)',
        WebkitTextStroke:     'var(--lgs-tx-stroke-width, 0px) var(--lgs-tx-stroke-color, transparent)',
        paintOrder:           'var(--lgs-tx-paint-order,"fill stroke")',
    }

    return (
        <div className="text-widget-preview-area" ref={_previewRef}>
            <div className="lgs-editable-text-wrapper" style={wrapperStyles}>
                <div
                    ref={_inputRef}
                    role="textbox"
                    aria-multiline="true"
                    contentEditable
                    suppressContentEditableWarning
                    spellCheck={false}
                    style={textStyles}
                    onInput={(e) => {
                        updateText(textFromEditable(e.currentTarget))
                        if (isEditing) {
                            resetRotationTimer()
                        }
                    }}
                    onFocus={() => setIsEditing(true)}
                    onBlur={resetRotationTimer}
                    onKeyDown={handleKeyDown}
                >
                    {displayValue}
                </div>
            </div>
        </div>
    )
})
