/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: EditableText.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-23
 * Last modified: 2026-01-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/
import { TextWidgetManager } from '@Core/ui/text-metrics/TextWidgetManager'
import classNames                                      from 'classnames'
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useSnapshot }                                 from 'valtio'

/**
 * Inline text editor with dynamic font loading.
 * Ensures style consistency between display and edit modes by overriding browser defaults.
 */
export const EditableText = ({id, scale = 1}) => {
    const $configuration = lgs.settings.widgets['text-widget']?.configuration
    const configuration = useSnapshot($configuration)
    const _moveable = __.ui.widgetManager.getMoveable(id)

    const $drawers = lgs.stores.ui.drawers
    const drawers = useSnapshot($drawers)

    const [isEditing, setIsEditing] = useState(false)
    const [editingText, setEditingText] = useState('')
    const [fontTick, setFontTick] = useState(0)

    const _input = useRef(null)
    const _cursor = useRef(0)

    const element = configuration?.elements?.[id] ?? configuration.user ?? configuration.default

    /**
     * Widget removal logic
     */
    const removeTextWidget = useCallback((entityId) => {
        console.log(`Removing widget: ${entityId}`)
    }, [])

    /**
     * Handles deletion keys when the widget is selected
     */
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            const isCurrent = drawers.entity === id

            if (isCurrent && !isEditing && (e.key === 'Delete' || e.key === 'Backspace')) {
                e.preventDefault()
                removeTextWidget(id)
            }
        }

        window.addEventListener('keydown', handleGlobalKeyDown)
        return () => window.removeEventListener('keydown', handleGlobalKeyDown)
    }, [id, isEditing, drawers.entity, removeTextWidget])

    /**
     * Loads Google Fonts and updates moveable UI
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
        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
    }

    const widgetManager = useMemo(() => TextWidgetManager.instance, [])

    if (!element) {
        return null
    }

    const displayValue = isEditing
                         ? (editingText.replace(/\n$/, '\n '))
                         : element.text

    const cssVars = widgetManager.generateCSSVariables(element)

    const fontSize = element.size ?? 16
    const lineHeight = parseFloat(element.lineHeight ?? 1)
    const lineHeightPx = fontSize * lineHeight

    const commonStyles = {
        font:       'inherit', // Force break from browser default font stacks
        fontSize:   'var(--lgs-tx-size)',
        fontFamily: 'var(--lgs-tx-font)',
        fontWeight: 'var(--lgs-tx-weight)',
        fontStyle:  'var(--lgs-tx-style)',
        textAlign:  'var(--lgs-tx-align)',
        lineHeight: `calc(${element.size}px * var(--lgs-tx-lh))`,
        whiteSpace: 'pre',
        margin:     '0',
        padding:    `${Math.max(4, lineHeightPx * 0.25)}px`,
        boxSizing:  'border-box',
        color:      'var(--lgs-tx-color)',
        textShadow: 'var(--lgs-tx-shadow)',
        overflow:   'visible',
        outline:    'none',
        caretColor: 'var(--lgs-tx-color)',
    }

    useEffect(() => {
        if (_moveable?.current) {
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
                minWidth: '1ch',
                backgroundColor: 'var(--lgs-tx-bg-color)',
                backdropFilter: 'blur(var(--lgs-tx-blur))',
                border:          'var(--lgs-tx-border)',
                borderRadius:    'var(--lgs-tx-radius)',
                boxShadow:       'var(--lgs-bg-elevation)',
                overflow: 'hidden',
                opacity:  element.opacity, // Opacity applied here so it covers both states
            }}
        >
            <div
                onClick={!isEditing ? handleStartEdit : undefined}
                style={{
                    ...commonStyles,
                    cursor:     'text',
                    userSelect: 'none',
                    visibility: isEditing ? 'hidden' : 'visible',
                    minHeight: '1em',
                }}
            >
                {displayValue || '\u00A0'}
            </div>

            {isEditing && (
                <textarea
                    ref={_input}
                    spellCheck={false}
                    style={{
                        ...commonStyles,
                        position:   'absolute',
                        top:     '0',
                        left:    '0',
                        width:   '100%',
                        height:  '100%',
                        background: 'transparent',
                        border:     'none',
                        resize:     'none',
                        overflow: 'hidden',
                        display:    'block',
                        padding: `${Math.max(4, lineHeightPx * 0.25)}px`, // Match ghost div padding exactly
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
