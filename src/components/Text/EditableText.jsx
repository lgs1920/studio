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

import { TextWidgetManager }                           from '@Core/ui/text-metrics/TextWidgetManager'
import classNames                                      from 'classnames'
import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useSnapshot }                                 from 'valtio'

/**
 * Inline text editor with dynamic font loading and Valtio proxy synchronization.
 */
export const EditableText = ({id, scale = 1}) => {
    const $configuration = lgs.settings.widgets['text-widget']?.configuration
    const configuration = useSnapshot($configuration)

    const [isEditing, setIsEditing] = useState(false)
    const [editingText, setEditingText] = useState('')
    const [fontTick, setFontTick] = useState(0)

    const _input = useRef(null)
    const _cursor = useRef(0)

    const $element = $configuration?.elements?.[id]
    const element = configuration?.elements?.[id]

    /**
     * Dynamic font injection.
     * Checks if font is already in the document before injecting a new link.
     * Uses FontFace API to notify the component when the binary is ready.
     */
    useEffect(() => {
        if (!element?.fontFamily || element.fontFamily === 'System') {
            return
        }
        const family = element.fontFamily
        const fontId = `gfont-${family.replace(/\s+/g, '-').toLowerCase()}`

        const triggerRedraw = () => {
            if (document.fonts) {
                document.fonts.load(`1em "${family}"`).then(() => setFontTick(t => t + 1))
            }
        }

        if (!document.getElementById(fontId)) {
            const link = document.createElement('link')
            link.id = fontId
            link.rel = 'stylesheet'
            link.href = `https://fonts.googleapis.com/css?family=${family.replace(/\s+/g, '+')}:400,700&display=swap`
            link.onload = triggerRedraw
            document.head.appendChild(link)
        }
        else {
            triggerRedraw()
        }
    }, [element?.fontFamily])

    /**
     * Focus management.
     * Restores cursor position immediately after entering edit mode.
     */
    useEffect(() => {
        if (isEditing && _input.current) {
            _input.current.focus()
            _input.current.setSelectionRange(_cursor.current, _cursor.current)
        }
    }, [isEditing])

    /**
     * Initiates edit mode.
     * Snapshot text is used as the initial value for the controlled input.
     */
    const handleStartEdit = (e) => {
        if (!element) {
            return
        }
        _cursor.current = element.text.length
        setEditingText(element.text)
        setIsEditing(true)
    }

    /**
     * Persists changes to the Valtio proxy upon completion.
     */
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

    /**
     * Layout conditions.
     * Flexbox centering is only applied for multi-line content.
     */
    const hasMultipleLines = (element.text || '').includes('\n')

    /**
     * Proportional padding calculation.
     * Scales based on fontSize and lineHeight to prevent clipping of ascenders and descenders.
     */
    const fontSize = element.size ?? 16
    const lineHeight = parseFloat(element.lineHeight ?? 1)
    const lineHeightPx = fontSize * lineHeight

    const textPaddingTop = Math.max(4, lineHeightPx * 0.25)
    const textPaddingRight = Math.max(4, lineHeightPx * 0.25)
    const textPaddingBottom = Math.max(5, lineHeightPx * 0.35)
    const textPaddingLeft = Math.max(4, lineHeightPx * 0.25)

    /**
     * Visual and metric styles.
     * Uses 'whiteSpace: pre' to allow horizontal container expansion (auto-size).
     */
    const commonStyles = {
        fontSize:   'var(--lgs-tx-size)',
        fontFamily: 'var(--lgs-tx-font)',
        fontWeight: 'var(--lgs-tx-weight)',
        fontStyle:  'var(--lgs-tx-style)',
        textAlign:  'var(--lgs-tx-align)',
        lineHeight: `calc(${element.size}px * var(--lgs-tx-lh))`,
        whiteSpace: 'pre',
        margin:     '0',
        padding:    `${textPaddingTop}px ${textPaddingRight}px ${textPaddingBottom}px ${textPaddingLeft}px`,
        boxSizing:  'border-box',
        color:      'var(--lgs-tx-color)',
        textShadow: 'var(--lgs-tx-shadow)',
        overflow:   'visible',
    }

    return (
        <div
            key={`f-${fontTick}`}
            className={classNames('lgs-editable-text-wrapper', {'text-editing-progress': isEditing})}
            style={{
                ...cssVars,
                display:         'inline-block',
                position:        'relative',
                width:    'auto',
                maxWidth: 'none',
                backgroundColor: 'var(--lgs-tx-bg-color)',
                backdropFilter:  'var(--lgs-tx-blur)',
                border:          'var(--lgs-tx-border)',
                borderRadius:    'var(--lgs-tx-radius)',
                boxShadow:       'var(--lgs-bg-elevation)',
                padding: '0',
            }}
        >
            {/* Mirroring div to drive parent dimensions */}
            <div
                onClick={!isEditing ? handleStartEdit : undefined}
                style={{
                    ...commonStyles,
                    cursor:     'text',
                    userSelect: 'none',
                    visibility: isEditing ? 'hidden' : 'visible',
                    opacity:    element.opacity,
                    filter:     element.blur ? 'blur(2px)' : 'none',
                    display:    hasMultipleLines ? 'flex' : 'block',
                    alignItems: hasMultipleLines ? 'center' : 'initial',
                    minHeight:  hasMultipleLines ? '100%' : 'auto',
                }}
            >
                {(isEditing ? editingText : element.text) || '\u200B'}
                {/* Trailing newline fix for DIV height calculation */}
                {isEditing && editingText.endsWith('\n') ? '\n ' : ''}
            </div>

            {isEditing && (
                <textarea
                    ref={_input}
                    spellCheck={false}
                    style={{
                        ...commonStyles,
                        position:   'absolute',
                        top:    '0',
                        left:   '0',
                        right:  '0',
                        bottom: '0',
                        width:  '100%',
                        height: '100%',
                        background: 'transparent',
                        border:     'none',
                        outline:    'none',
                        resize:     'none',
                        overflow: 'hidden',
                        display:    'block',
                    }}
                    value={editingText}
                    onChange={(e) => {
                        const val = e.target.value
                        setEditingText(val)
                        _cursor.current = e.target.selectionStart
                        // Real-time synchronization with Valtio proxy
                        if ($element) {
                            $element.text = val
                        }
                    }}
                    onBlur={handleFinishEdit}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            e.preventDefault()
                            handleFinishEdit()
                        }
                    }}
                />
            )}
        </div>
    )
}