/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: EditableText.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-21
 * Last modified: 2026-01-21
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { TextWidgetManager }                           from '@Core/ui/text-metrics/TextWidgetManager'
import classNames                                      from 'classnames'
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useSnapshot }                                 from 'valtio'

/**
 * Inline text editor with dynamic font loading and robust click-to-edit.
 * Handles deletion when selected and not in edit mode.
 */
export const EditableText = ({id, scale = 1}) => {
    const $configuration = lgs.settings.widgets['text-widget']?.configuration
    const configuration = useSnapshot($configuration)
    const _moveable = __.ui.widgetManager.getMoveable(id)

    // Access the global selection store
    const $drawers = lgs.stores.ui.drawers
    const drawers = useSnapshot($drawers)

    const [isEditing, setIsEditing] = useState(false)
    const [editingText, setEditingText] = useState('')
    const [fontTick, setFontTick] = useState(0)

    const _input = useRef(null)
    const _cursor = useRef(0)

    const element = configuration?.elements?.[id] ?? configuration.user ?? configuration.default

    /**
     * Placeholder for the removal logic.
     */
    const removeTextWidget = useCallback((entityId) => {
        // Implementation handled by user
        console.log(`Removing widget: ${entityId}`)
    }, [])

    /**
     * Global keydown listener to handle deletion when the widget is selected
     * but not being actively edited.
     */
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            // Check if this specific widget is the current/selected one
            const isCurrent = drawers.entity === id

            if (isCurrent && !isEditing && (e.key === 'Delete' || e.key === 'Backspace')) {
                // Prevent browser back-navigation or other defaults
                e.preventDefault()
                removeTextWidget(id)
            }
        }

        window.addEventListener('keydown', handleGlobalKeyDown)
        return () => window.removeEventListener('keydown', handleGlobalKeyDown)
    }, [id, isEditing, drawers.entity, removeTextWidget])

    /**
     * Injects Google Fonts dynamically.
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

        // Update handles
        if (_moveable?.current) {
            _moveable.current.updateRect()
        }

    }, [element?.fontFamily])

    useEffect(() => {
        if (isEditing && _input.current) {
            _input.current.focus()
            _input.current.setSelectionRange(_cursor.current, _cursor.current)
        }
    }, [isEditing])

    const ensureProxyElement = () => {
        if (!$configuration.elements) {
            $configuration.elements = {}
        }
        if (!$configuration.elements[id]) {
            $configuration.elements[id] = JSON.parse(JSON.stringify(element))
        }
        return $configuration.elements[id]
    }

    const handleStartEdit = (e) => {
        if (!element) {
            return
        }
        ensureProxyElement()

        let clickIndex = element.text.length
        try {
            if (document.caretRangeFromPoint) {
                const range = document.caretRangeFromPoint(e.clientX, e.clientY)
                if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
                    clickIndex = range.startOffset
                }
            }
        }
        catch (err) {
            clickIndex = element.text.length
        }

        _cursor.current = clickIndex
        setEditingText(element.text)
        setIsEditing(true)
    }

    const handleFinishEdit = () => {
        const $target = ensureProxyElement()
        $target.text = editingText
        setIsEditing(false)
        // Update handles
        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
    }

    const widgetManager = useMemo(() => TextWidgetManager.instance, [])
    if (!element) {
        return null
    }
    // Ensure the height of the ghost div is correct even with trailing returns
    const displayValue = isEditing
                         ? (editingText + (editingText.endsWith('\n') ? '\u00A0' : ''))
                         : element.text

    const cssVars = widgetManager.generateCSSVariables(element)
    const hasMultipleLines = (element.text || '').includes('\n')

    const fontSize = element.size ?? 16
    const lineHeight = parseFloat(element.lineHeight ?? 1)
    const lineHeightPx = fontSize * lineHeight

    const commonStyles = {
        fontSize:   'var(--lgs-tx-size)',
        fontFamily: 'var(--lgs-tx-font)',
        fontWeight: 'var(--lgs-tx-weight)',
        fontStyle:  'var(--lgs-tx-style)',
        textAlign:  'var(--lgs-tx-align)',
        lineHeight: `calc(${element.size}px * var(--lgs-tx-lh))`,
        whiteSpace: 'pre-wrap',
        margin:     '0',
        padding: `${Math.max(4, lineHeightPx * 0.25)}px ${Math.max(4, lineHeightPx * 0.25)}px ${Math.max(5, lineHeightPx * 0.35)}px ${Math.max(4, lineHeightPx * 0.25)}px`,
        boxSizing:  'border-box',
        color:      'var(--lgs-tx-color)',
        textShadow: 'var(--lgs-tx-shadow)',
        overflow:   'visible',
        outline:   'none',
        boxShadow: 'none',
    }

    /**
     * Updates handles on text change or edit mode toggle
     */
    useEffect(() => {
        if (_moveable?.current) {
            // We use requestAnimationFrame to wait for the next paint
            // ensuring the DOM nodes have their new dimensions
            const frame = requestAnimationFrame(() => {
                _moveable.current.updateRect()
            })
            return () => cancelAnimationFrame(frame)
        }
    }, [editingText, isEditing, element.text, _moveable])

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
                overflow: 'hidden',
                backgroundColor: 'var(--lgs-tx-bg-color)',
                backdropFilter: 'blur(var(--lgs-tx-blur))',
                border:          'var(--lgs-tx-border)',
                borderRadius:    'var(--lgs-tx-radius)',
                boxShadow:       'var(--lgs-bg-elevation)',
                padding: '0',
            }}
        >
            <div
                onClick={!isEditing ? handleStartEdit : undefined}
                style={{
                    ...commonStyles,
                    cursor:     'text',
                    userSelect: 'none',
                    visibility: isEditing ? 'hidden' : 'visible',
                    opacity:    element.opacity,
                    display:    hasMultipleLines ? 'flex' : 'block',
                    alignItems: hasMultipleLines ? 'center' : 'initial',
                    minHeight:  hasMultipleLines ? '100%' : 'auto',
                }}
            >
                {/* {(isEditing ? editingText : element.text)} */}
                {/* {isEditing && editingText.endsWith('\n') ? '\n ' : ''} */}
                {displayValue}
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
                        borderRadius: 'inherit',
                        display:    'block',
                    }}
                    value={editingText}
                    onInput={(e) => {
                        const val = e.target.value
                        setEditingText(val)
                        const $target = ensureProxyElement()
                        $target.text = val
                    }}
                    onBlur={handleFinishEdit}
                    onKeyDown={(e) => {
                        // While editing, we stop propagation so keys like Backspace
                        // only affect the text and don't trigger global deletion.
                        if (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'Escape') {
                            e.stopPropagation()
                        }
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