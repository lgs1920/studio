/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: EditableText.jsx
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

import { WIDGETS_EDITOR_DRAWER } from '@Core/constants'
import { hasActiveAppShortcutBlocker } from '@Core/events/shortcutBlockers'
import { useWidgetScaleCorrection } from '@Components/MainUI/widgets/useWidgetScaleCorrection'
import { TextWidgetManager }     from '@Core/ui/text-metrics/TextWidgetManager'
import classNames      from 'classnames'
import {
    useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback,
}                      from 'react'
import { useSnapshot } from 'valtio'

const setTextSelection = (element, offset) => {
    if (!element || typeof document === 'undefined') {
        return
    }

    const selection = window.getSelection?.()
    if (!selection) {
        return
    }

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let remaining = Math.max(0, Number(offset) || 0)
    let textNode = walker.nextNode()
    let targetNode = textNode
    let targetOffset = 0

    while (textNode) {
        const length = textNode.textContent?.length ?? 0
        if (remaining <= length) {
            targetNode = textNode
            targetOffset = remaining
            break
        }
        remaining -= length
        targetNode = textNode
        targetOffset = length
        textNode = walker.nextNode()
    }

    if (!targetNode) {
        targetNode = element
        targetOffset = element.childNodes.length
    }

    const range = document.createRange()
    range.setStart(targetNode, targetOffset)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
}

const textFromEditable = element => (element?.innerText ?? element?.textContent ?? '').replace(/\u00a0/g, ' ')

/**
 * Inline text editor with dynamic font loading.
 * Handles the new text object structure: { content, color, opacity, ... }
 */
export const EditableText = ({id}) => {
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
    const _editingText = useRef('')

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
        const isTypingNode = (node) => {
            if (!node) {
                return false
            }
            if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
                return true
            }
            if (node instanceof HTMLElement) {
                if (node.isContentEditable) {
                    return true
                }
                if (node.closest && node.closest('wa-textarea, wa-input, input, textarea')) {
                    return true
                }
            }
            return false
        }

        const handleGlobalKeyDown = (e) => {
            if (hasActiveAppShortcutBlocker()) {
                return
            }

            const isCurrent = drawers.entity === id
            if (drawers.open === WIDGETS_EDITOR_DRAWER && isCurrent) {
                return
            }

            const path = e.composedPath ? e.composedPath() : [e.target]
            const active = document.activeElement
            if (isTypingNode(e.target) || isTypingNode(active) || path.some(isTypingNode)) {
                return
            }

            if (isCurrent && !isEditing && (e.key === 'Delete' || e.key === 'Backspace')) {
                e.preventDefault()
                removeTextWidget(id)
            }
        }

        window.addEventListener('keydown', handleGlobalKeyDown, true)
        return () => window.removeEventListener('keydown', handleGlobalKeyDown, true)
    }, [id, isEditing, drawers.entity, drawers.open, removeTextWidget])

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
    }, [_moveable, element?.fontFamily])

    useLayoutEffect(() => {
        if (isEditing && _input.current) {
            _input.current.textContent = _editingText.current
            _input.current.focus()
            setTextSelection(_input.current, _cursor.current)
        }
    }, [isEditing])

    /**
     * Ensures the proxy element and its text object exist with correct types
     */
    const ensureProxyElement = () => {
        if (!$configuration.elements) {
            $configuration.elements = {}
        }
        if (!$configuration.elements[id]) {
            $configuration.elements[id] = JSON.parse(JSON.stringify(element))
        }

        const $target = $configuration.elements[id]

        if ($target.scaled === undefined) {
            $target.scaled = true
        }

        // Fix: If 'text' is a string or invalid, convert it to the expected object structure
        if (typeof $target.text !== 'object' || $target.text === null) {
            const existingContent = typeof $target.text === 'string' ? $target.text : ''
            $target.text = {
                content: existingContent,
                color:   element.text?.color ?? {r: 255, g: 255, b: 255, a: 1},
                opacity: element.text?.opacity ?? 1,
            }
        }

        return $target
    }

    const handleStartEdit = (e) => {
        if (!element) {
            return
        }
        const content = element.text?.content ?? (typeof element.text === 'string' ? element.text : '')
        let clickIndex = content.length
        try {
            if (document.caretRangeFromPoint) {
                const range = document.caretRangeFromPoint(e.clientX, e.clientY)
                if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
                    clickIndex = range.startOffset
                }
            }
        }
        catch {
            clickIndex = content.length
        }

        _cursor.current = clickIndex
        _editingText.current = content
        setEditingText(content)
        setIsEditing(true)
    }

    const handleFinishEdit = () => {
        const nextText = _input.current ? textFromEditable(_input.current) : _editingText.current
        _editingText.current = nextText
        setEditingText(nextText)

        const $target = ensureProxyElement()
        $target.text.content = nextText
        setIsEditing(false)
        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
    }

    const widgetManager = useMemo(() => TextWidgetManager.instance, [])
    const scaleCorrection = useWidgetScaleCorrection(id)

    useEffect(() => {
        if (_moveable?.current) {
            const frame = requestAnimationFrame(() => {
                _moveable.current.updateRect()
            })
            return () => cancelAnimationFrame(frame)
        }
    }, [editingText, isEditing, element?.text?.content, scaleCorrection, _moveable])

    useEffect(() => {
        const widgetElement = __.ui.widgetManager.getElementById(id)
        const config = __.ui.widgetManager.getWidgetConfig(id)

        if (!widgetElement || !config || !element) {
            return undefined
        }

        if (__.ui.widgetManager.isScaling || __.ui.widgetManager.isResizing) {
            _moveable?.current?.updateRect()
            return undefined
        }

        const frame = requestAnimationFrame(() => {
            const measured = widgetManager.measureContent(element, undefined, {
                correction: scaleCorrection,
            })
            const currentWidth = Number(config.dimensions?.width) || 0
            const currentHeight = Number(config.dimensions?.height) || 0
            const width = Math.max(measured.width || 0, currentWidth)
            const height = Math.max(measured.height || 0, currentHeight)

            if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
                widgetElement.style.width = `${width}px`
                widgetElement.style.height = `${height}px`
                config.dimensions = {width, height}
            }

            _moveable?.current?.updateRect()
        })

        return () => cancelAnimationFrame(frame)
    }, [
        _moveable,
        widgetManager,
        id,
        element,
        element?.text?.content,
        element?.text?.stroke?.show,
        element?.text?.stroke?.width,
        element?.fontFamily,
        element?.size,
        element?.lineHeight,
        element?.weight,
        element?.style,
        element?.border?.show,
        element?.border?.scaled,
        element?.border?.thickness,
        element?.border?.radius,
        element?.border?.radiusScaled,
        element?.padding?.top,
        element?.padding?.right,
        element?.padding?.bottom,
        element?.padding?.left,
        element?.padding?.scaled,
        element?.scaled,
        scaleCorrection,
        fontTick,
    ])

    if (!element) {
        return null
    }

    const displayValue = isEditing
                         ? (editingText.replace(/\n$/, '\n '))
                         : (element.text?.content ?? (typeof element.text === 'string' ? element.text : ''))
    const textScaled = element?.scaled ?? true

    const cssVars = widgetManager.generateCSSVariables(element, null, undefined, {
        correction: scaleCorrection,
    })

    const commonStyles = {
        font:       'inherit',
        fontSize:   'var(--lgs-tx-size)',
        fontFamily: 'var(--lgs-tx-font)',
        fontWeight: 'var(--lgs-tx-weight)',
        fontStyle:  'var(--lgs-tx-style)',
        textAlign:  'var(--lgs-tx-align)',
        lineHeight: 'var(--lgs-tx-line-height)',
        whiteSpace: 'pre',
        margin:     '0',
        padding: `var(--lgs-tx-padding-top) var(--lgs-tx-padding-right) var(--lgs-tx-padding-bottom) var(--lgs-tx-padding-left)`,
        boxSizing:  'border-box',
        color:      'var(--lgs-tx-color)',
        textShadow: 'var(--lgs-tx-shadow)',
        overflow:   'visible',
        outline:    'none',
        caretColor: 'var(--lgs-tx-color)',
        ...(element.text?.stroke?.show && {
            WebkitTextFillColor: 'var(--lgs-tx-color)',
            WebkitTextStroke: 'var(--lgs-tx-stroke-width, 0px) var(--lgs-tx-stroke-color, transparent)',
            paintOrder:       'var(--lgs-tx-paint-order,"fill stroke")',
        }),
    }

    return (
        <div
            className={classNames('lgs-editable-text-wrapper', {'text-editing-progress': isEditing})}
            style={{
                ...cssVars,
                display:         'grid',
                position: 'relative',
                width: '100%',
                height: '100%',
                minWidth: '1ch',
                boxSizing: 'border-box',
                placeItems: 'center',
                backgroundColor: 'var(--lgs-tx-bg-color)',
                backdropFilter: 'blur(var(--lgs-tx-blur))',
                border:          'var(--lgs-tx-border)',
                borderRadius:    'var(--lgs-tx-radius)',
                boxShadow: 'var(--lgs-bg-elevation)',
                overflow: 'hidden',
                opacity: element.opacity ?? 1,
            }}
        >
            <div
                ref={_input}
                contentEditable={isEditing}
                suppressContentEditableWarning
                spellCheck={false}
                onClick={!isEditing ? handleStartEdit : undefined}
                onInput={isEditing ? (e) => {
                    const nextText = textFromEditable(e.currentTarget)
                    _editingText.current = nextText
                    setEditingText(nextText)

                    const $target = ensureProxyElement()
                    $target.text.content = nextText
                } : undefined}
                onBlur={isEditing ? handleFinishEdit : undefined}
                onKeyDown={isEditing ? (e) => {
                    if (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'Escape') {
                        e.stopPropagation()
                    }
                    if (e.key === 'Escape') {
                        e.preventDefault()
                        handleFinishEdit()
                    }
                } : undefined}
                style={{
                    ...commonStyles,
                    width: textScaled ? '100%' : 'max-content',
                    minWidth: 'max-content',
                    gridArea: '1 / 1',
                    cursor:     'text',
                    userSelect: isEditing ? 'text' : 'none',
                    minHeight: '1em',
                }}
            >
                {isEditing ? null : (displayValue || '\u00A0')}
            </div>
        </div>
    )
}
