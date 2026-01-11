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

    // Restore font loading logic
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

    useEffect(() => {
        if (isEditing && _input.current) {
            _input.current.focus()
            _input.current.setSelectionRange(_cursor.current, _cursor.current)
        }
    }, [isEditing])

    const handleStartEdit = (e) => {
        if (!element) {
            return
        }
        _cursor.current = element.text.length
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

    // Détection si le texte a plusieurs lignes (besoin de centrage vertical)
    const hasMultipleLines = (element.text || '').includes('\n')

    // Padding proportionnel au lineHeight et fontSize pour éviter la troncature (réduit de moitié)
    // des caractères descendants (g, p, q, y, j) et ascendants (h, k, l, b, d, f, t)
    const fontSize = element.size ?? 16
    const lineHeight = parseFloat(element.lineHeight ?? 1)
    const lineHeightPx = fontSize * lineHeight

    // Padding basé sur le lineHeight (réduit de moitié) :
    // - Sides: ~0.25 de lineHeight
    // - Bottom: ~0.35 de lineHeight (plus grand pour les descendants)
    const textPaddingTop = Math.max(4, lineHeightPx * 0.25)
    const textPaddingRight = Math.max(4, lineHeightPx * 0.25)
    const textPaddingBottom = Math.max(5, lineHeightPx * 0.35)
    const textPaddingLeft = Math.max(4, lineHeightPx * 0.25)

    // STYLES ORIGINAUX : pre pour l'expansion horizontale
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
                padding:  `${element.padding?.top ?? 5}px ${element.padding?.right ?? 5}px ${element.padding?.bottom ?? 5}px ${element.padding?.left ?? 5}px`,
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
                    filter:     element.blur ? 'blur(2px)' : 'none',
                    // Centrage vertical uniquement si texte sur plusieurs lignes
                    display:    hasMultipleLines ? 'flex' : 'block',
                    alignItems: hasMultipleLines ? 'center' : 'initial',
                    minHeight:  hasMultipleLines ? '100%' : 'auto',
                }}
            >
                {(isEditing ? editingText : element.text) || '\u200B'}
                {isEditing && editingText.endsWith('\n') ? '\n ' : ''}
            </div>

            {isEditing && (
                <textarea
                    ref={_input}
                    spellCheck={false}
                    style={{
                        ...commonStyles,
                        position:   'absolute',
                        top:    `${element.padding?.top ?? 5}px`,
                        left:   `${element.padding?.left ?? 5}px`,
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