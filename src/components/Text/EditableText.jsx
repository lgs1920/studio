/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: EditableText.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-11
 * Last modified: 2026-01-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WIDGET_GOOGLE_FONTS, WIDGET_SHADOWS } from '@Core/constants'
import { TextWidgetManager }                   from '@Core/ui/text-metrics/TextWidgetManager'
import classNames                                          from 'classnames'
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useSnapshot }                                              from 'valtio'

/**
 * Multi-line SVG text editor component.
 * @param {Object} props
 * @param {Object} props.id - Widget ID
 */
export const EditableText = ({id, scale = 1}) => {
    const $configuration = lgs.settings.widgets['text-widget']?.configuration
    const configuration = useSnapshot($configuration)

    const [isEditing, setIsEditing] = useState(false)
    const [editingText, setEditingText] = useState('')

    const _text = useRef(null)
    const _input = useRef(null)
    const _cursor = useRef(0)

    // Isolation: ensures each widget instance is independent
    useEffect(() => {
        if ($configuration && !$configuration.elements?.[id]) {
            if (!$configuration.elements || typeof $configuration.elements !== 'object') {
                $configuration.elements = {}
            }
            const baseConfig = $configuration.user ?? $configuration.default
            $configuration.elements[id] = JSON.parse(JSON.stringify(baseConfig))
        }
    }, [id, $configuration])

    const $element = $configuration?.elements?.[id]
    const element = configuration?.elements?.[id]

    // Inject Google Fonts into the document head
    useEffect(() => {
        const familiesParam = WIDGET_GOOGLE_FONTS.map(f => f.replace(/\s+/g, '+')).join('|')
        const linkId = 'gfonts-editable-text'

        if (!document.getElementById(linkId)) {
            const link = document.createElement('link')
            link.id = linkId
            link.rel = 'stylesheet'
            link.href = `https://fonts.googleapis.com/css?family=${familiesParam}&display=swap`
            document.head.appendChild(link)
        }
    }, [])

    // Handle cursor position and focus
    useEffect(() => {
        if (isEditing && _input.current) {
            _input.current.focus()
            const pos = _cursor.current
            requestAnimationFrame(() => {
                if (_input.current) {
                    _input.current.setSelectionRange(pos, pos)
                }
            })
        }
    }, [isEditing])

    /**
     * Set cursor position based on click coordinates
     */
    const handleStartEdit = (e) => {
        if (!element) {
            return
        }

        let cursorPos = element.text.length

        if (e && (document.caretPositionFromPoint || document.caretRangeFromPoint)) {
            try {
                if (document.caretPositionFromPoint) {
                    const pos = document.caretPositionFromPoint(e.clientX, e.clientY)
                    if (pos) {
                        cursorPos = pos.offset
                    }
                }
                else if (document.caretRangeFromPoint) {
                    const range = document.caretRangeFromPoint(e.clientX, e.clientY)
                    if (range) {
                        cursorPos = range.startOffset
                    }
                }
            }
            catch (err) {
                cursorPos = element.text.length
            }
        }

        _cursor.current = cursorPos
        setEditingText(element.text)
        setIsEditing(true)
    }

    const handleFinishEdit = () => {
        if ($element) {
            $element.text = editingText
        }
        setIsEditing(false)
    }

    const widgetManager = useMemo(() => TextWidgetManager.instance, [])

    if (!element) {
        return null
    }

    const cssVars = widgetManager.generateCSSVariables(element)

    const paddingTop = element.padding?.top ?? 5
    const paddingLeft = element.padding?.left ?? 5
    const paddingRight = element.padding?.right ?? 5
    const paddingBottom = (element.padding?.bottom ?? 5) + 5
    const commonStyles = {
        fontSize:   'var(--lgs-tx-size)',
        fontFamily: 'var(--lgs-tx-font)',
        fontWeight: 'var(--lgs-tx-weight)',
        fontStyle:  'var(--lgs-tx-style)',
        textAlign:  'var(--lgs-tx-align)',
        lineHeight: `calc(${element.size}px * var(--lgs-tx-lh))`,
        whiteSpace: 'pre',
        margin:     '0',
        padding:    '0',
        boxSizing:  'border-box',
        overflow:   'visible',
        textShadow: 'var(--lgs-tx-shadow)',
        color:      'var(--lgs-tx-color)',

    }

    return (
        <div
            className={classNames('lgs-editable-text-wrapper', {'text-editing-progress': isEditing})}
            style={{
                ...cssVars,
                display:         'inline-block',
                position:        'relative',
                padding:         `${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px`,
                backgroundColor: 'var(--lgs-tx-bg-color)',
                backdropFilter:  'var(--lgs-tx-blur)',
                border:          'var(--lgs-tx-border)',
                borderRadius:    'var(--lgs-tx-radius)',
                boxShadow:       'var(--lgs-bg-elevation)',
                minWidth:        '20px',
            }}
        >
            {/* Mirror Div: Sizes the parent even when editing */}
            <div
                ref={_text}
                onClick={!isEditing ? handleStartEdit : undefined}
                style={{
                    ...commonStyles,
                    color:      element.color,
                    cursor:     'text',
                    userSelect: 'none',
                    visibility: isEditing ? 'hidden' : 'visible',
                    opacity:    element.opacity,
                    filter:     element.blur ? 'blur(2px)' : 'none',
                }}
            >
                {(isEditing ? editingText : element.text) || '\u200B'}
                {isEditing && editingText.endsWith('\n') ? '\n ' : ''}
            </div>

            {/* Absolute Textarea overlay */}
            {isEditing && (
                <textarea
                    ref={_input}
                    rows={1}
                    style={{
                        ...commonStyles,
                        position:   'absolute',
                        top:        `${paddingTop}px`,
                        left:       `${paddingLeft}px`,
                        width:      `calc(100% - ${paddingLeft + paddingRight}px)`,
                        height:     `calc(100% - ${paddingTop + paddingBottom}px)`,
                        background: 'transparent',
                        border:     'none',
                        outline:    'none',
                        resize:     'none',
                        overflow: 'hidden',
                        color:      element.color,
                        display:    'block',
                    }}
                    value={editingText}
                    onChange={(e) => {
                        setEditingText(e.target.value)
                        _cursor.current = e.target.selectionStart
                    }}
                    onBlur={handleFinishEdit}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
                            e.preventDefault()
                            handleFinishEdit()
                        }
                    }}
                />
            )}
        </div>
    )
}