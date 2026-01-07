/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: EditableText.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-07
 * Last modified: 2026-01-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { useSnapshot }                                         from 'valtio'
import { TextMetricsManager }                                  from '@Core/ui/text-metrics/TextMetricsManager'

/**
 * Multi-line SVG text editor component.
 * Uses a Top-Left anchor logic for perfect multi-line alignment.
 * @param {Object} props
 * @param {Object} props.id - Widget ID
 * @param {number} props.scale - Current zoom scale
 */
export const EditableText = ({id, scale = 1}) => {
    const $configuration = lgs.settings.widgets['text-widget']?.configuration
    const configuration = useSnapshot($configuration)

    const [isEditing, setIsEditing] = useState(false)
    const [editingText, setEditingText] = useState('')

    const _text = useRef(null)
    const _input = useRef(null)
    const _cursor = useRef(0)

    const readConfiguration = () => {
        if (!configuration.elements?.[id]) {
            if (!$configuration.elements || typeof $configuration.elements !== 'object') {
                $configuration.elements = {}
            }
            $configuration.elements[id] = $configuration.user ?? $configuration.default
        }
    }

    useEffect(() => {
        readConfiguration()
    }, [id, $configuration])

    readConfiguration()

    const $element = $configuration.elements?.[id]
    const element = configuration.elements?.[id]

    if (!element) {
        return null
    }

    /**
     * Resize textarea to match content
     */
    const resizeTextarea = (textarea, preserveCursor = false) => {
        if (!textarea) {
            return
        }

        // Save cursor position if needed
        const cursorStart = preserveCursor ? textarea.selectionStart : null
        const cursorEnd = preserveCursor ? textarea.selectionEnd : null

        // Create a hidden div to measure content dimensions
        const measure = document.createElement('div')
        measure.style.cssText = `
            position: absolute;
            visibility: hidden;
            white-space: pre;
            font-size: ${element.size}px;
            font-family: ${element.fontFamily ?? 'Arial'};
            font-weight: normal;
            line-height: ${element.size * element.lineHeight}px;
            padding: 4px;
            box-sizing: border-box;
        `
        measure.textContent = textarea.value || ' '
        document.body.appendChild(measure)

        textarea.style.width = (measure.offsetWidth + 2) + 'px'
        textarea.style.height = measure.offsetHeight + 'px'

        document.body.removeChild(measure)

        // Restore cursor position if needed
        if (preserveCursor && cursorStart !== null && cursorEnd !== null) {
            textarea.setSelectionRange(cursorStart, cursorEnd)
        }
    }

    /**
     * Focus and position cursor when entering edit mode.
     */
    useEffect(() => {
        if (isEditing && _input.current) {
            _input.current.focus()
            resizeTextarea(_input.current)
            // Position cursor at the end by default, or at saved position
            const pos = _cursor.current
            setTimeout(() => {
                _input.current.setSelectionRange(pos, pos)
            }, 0)
        }
    }, [isEditing])

    const textStyles = {
        fontSize:      `${element.size}px`,
        fontFamily:    element.fontFamily ?? 'Arial',
        fontWeight:    'normal',
        filter:        element.blur ? 'blur(2px)' : 'none',
        opacity:       element.opacity,
        letterSpacing: 'normal',
    }

    const handleStartEdit = (e) => {
        // Try to find cursor position from click using browser API
        let cursorPos = element.text.length

        if (_text.current && e) {
            try {
                // Use browser's built-in caret position detection
                if (document.caretPositionFromPoint) {
                    const position = document.caretPositionFromPoint(e.clientX, e.clientY)
                    if (position && position.offsetNode) {
                        cursorPos = position.offset
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
                // Fallback to end of text if detection fails
                cursorPos = element.text.length
            }
        }

        _cursor.current = cursorPos
        setEditingText(element.text)
        setIsEditing(true)
    }

    const handleTextChange = (e) => {
        const cursorPos = e.target.selectionStart
        setEditingText(e.target.value)
        _cursor.current = cursorPos
    }

    const handleFinishEdit = () => {
        $element.text = editingText
        setIsEditing(false)
    }

    const getBackground = () => {
        if (element.bgColor === 'transparent') {
            return 'transparent'
        }
        const alpha = Math.round(element.bgOpacity * 255).toString(16).padStart(2, '0')
        return `${element.bgColor}${alpha}`
    }

    const commonStyles = {
        ...textStyles,
        textAlign:  element.textAlign,
        lineHeight: `${element.size * element.lineHeight}px`,
        color:      element.color,
        whiteSpace: 'pre',
        padding:    '4px',
        margin:     '0',
        boxSizing:  'border-box',
    }

    return (
        <div
            className="lgs-editable-text-wrapper"
            style={{
                position:        'relative',
                display:         'inline-block',
                backgroundColor: getBackground(),
                borderRadius:    '4px',
                minWidth:        '20px',
                minHeight:       `${element.size * element.lineHeight}px`,
                maxWidth:        '100%',
            }}
        >
            {!isEditing ? (
                <div
                    ref={_text}
                    onClick={handleStartEdit}
                    style={{
                        ...commonStyles,
                        cursor:     'text',
                        userSelect: 'none',
                    }}
                >
                    {element.text || ' '}
                </div>
            ) : (
                 <textarea
                     ref={_input}
                     rows={1}
                     style={{
                         ...commonStyles,
                         background: 'transparent',
                         border:     'none',
                         outline:    'none',
                         resize:     'none',
                         overflow:   'hidden',
                         minWidth:   '20px',
                         minHeight:  `${element.size * element.lineHeight}px`,
                         width:      'fit-content',
                         height:     'auto',
                         whiteSpace: 'pre',
                         display:    'inline-block',
                     }}
                     value={editingText}
                     onChange={handleTextChange}
                     onClick={(e) => {
                         // Update cursor position on click
                         _cursor.current = e.target.selectionStart
                     }}
                     onSelect={(e) => {
                         // Update cursor position on selection change
                         _cursor.current = e.target.selectionStart
                     }}
                     onBlur={handleFinishEdit}
                     onKeyDown={(e) => {
                         // Escape = finish editing
                         if (e.key === 'Escape') {
                             e.preventDefault()
                             handleFinishEdit()
                             return
                         }
                         // Enter without Shift = finish editing
                         // Shift+Enter = new line
                         if (e.key === 'Enter' && !e.shiftKey) {
                             e.preventDefault()
                             handleFinishEdit()
                             return
                         }
                         // Update cursor position after key press
                         setTimeout(() => {
                             if (_input.current) {
                                 _cursor.current = _input.current.selectionStart
                                 // Trigger resize after Enter key
                                 if (e.key === 'Enter') {
                                     resizeTextarea(_input.current)
                                 }
                             }
                         }, 0)
                     }}
                     onInput={(e) => {
                         resizeTextarea(e.target, true)
                     }}
                 />
             )}
        </div>
    )
}