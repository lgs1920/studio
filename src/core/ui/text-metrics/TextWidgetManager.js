/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextWidgetManager.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WIDGET_RADIUS } from '@Core/constants'

export class TextWidgetManager {
    static #instance

    constructor() {
        if (TextWidgetManager.#instance) {
            return TextWidgetManager.#instance
        }
        TextWidgetManager.#instance = this
    }

    static get instance() {
        if (!TextWidgetManager.#instance) {
            TextWidgetManager.#instance = new TextWidgetManager()
        }
        return TextWidgetManager.#instance
    }

    getColor(item, alpha = false) {
        return __.ui.ui.resolveItemColor(item, alpha)
    }

    #scaleSize = (value, correction = 1) => {
        const numericValue = Number(value)
        const numericCorrection = Number(correction)

        if (!Number.isFinite(numericValue)) {
            return 0
        }

        return numericValue * (Number.isFinite(numericCorrection) ? numericCorrection : 1)
    }

    #scaleRadius = (radius, correction = 1) => {
        const normalizedCorrection = Number(correction)
        const scale = Number.isFinite(normalizedCorrection) ? normalizedCorrection : 1
        const value = String(radius ?? '0').trim()

        if (value === '0') {
            return '0'
        }

        return `calc(${value} * ${scale})`
    }

    resolvePadding = (element, correction = 1) => {
        const fontSize = element?.size ?? 16
        const lineHeight = parseFloat(element?.lineHeight ?? 1)
        const lineHeightPx = fontSize * (Number.isFinite(lineHeight) ? lineHeight : 1)
        const fallback = Math.max(4, lineHeightPx * 0.25)
        const padding = element?.padding ?? {}
        const scale = (padding.scaled ?? false) === false ? correction : 1

        return {
            top:    this.#scaleSize(padding.top ?? fallback, scale),
            right:  this.#scaleSize(padding.right ?? fallback, scale),
            bottom: this.#scaleSize(padding.bottom ?? fallback, scale),
            left:   this.#scaleSize(padding.left ?? fallback, scale),
        }
    }

    measureContent = (
        element,
        systemStack = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        options = {},
    ) => {
        const correction = Number.isFinite(Number(options.correction)) ? Number(options.correction) : 1
        const buffer = Number.isFinite(Number(options.buffer)) ? Number(options.buffer) : 0
        const content = element?.text?.content ?? ''
        const baseFontSize = Number(element?.size ?? 16)
        const textCorrection = (element?.scaled ?? true) ? 1 : correction
        const fontSize = this.#scaleSize(baseFontSize, textCorrection)
        const lineHeight = Number.parseFloat(element?.lineHeight ?? 1) || 1
        const lineHeightPx = fontSize * lineHeight
        const padding = this.resolvePadding(element, correction)
        const borderScale = element?.border?.scaled === false ? correction : 1
        const borderThickness = element?.border?.show ? this.#scaleSize(element.border?.thickness ?? 0, borderScale) : 0
        const strokeWidth = element?.text?.stroke?.show ? this.#scaleSize(element.text.stroke?.width ?? 0, textCorrection) : 0
        const lines = (content || ' ').split('\n')
        const fontFamily = element?.fontFamily === 'System' ? systemStack : (element?.fontFamily || systemStack)
        const fontWeight = element?.weight ?? 'normal'
        const fontStyle = element?.style ?? 'normal'

        let maxLineWidth = fontSize
        if (typeof document !== 'undefined') {
            const canvas = document.createElement('canvas')
            const context = canvas.getContext('2d')
            if (context) {
                context.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`
                maxLineWidth = lines.reduce((maxWidth, line) => {
                    const measuredWidth = context.measureText(line || ' ').width
                    return Math.max(maxWidth, measuredWidth)
                }, fontSize)
            }
        }

        return {
            width:  Math.ceil(maxLineWidth + padding.left + padding.right + (borderThickness * 2) + (strokeWidth * 2) + buffer),
            height: Math.ceil((lines.length * lineHeightPx) + padding.top + padding.bottom + (borderThickness * 2) + (strokeWidth * 2) + buffer),
        }
    }

    generateCSSVariables(
        element,
        bgSnapshot  = null,
        systemStack = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        scale       = {},
    ) {
        if (!element) {
            return {}
        }

        const bgShadowColor = this.getColor(element.background?.shadow, true)
        const txShadowColor = this.getColor(element.text?.shadow, true)

        const hasVisibleContainer = element.background?.show || element.border?.show

        const fontSize = element.size ?? 16
        const lineHeight = parseFloat(element.lineHeight ?? 1)
        const correction = scale.correction ?? 1
        const textCorrection = (element?.scaled ?? true) ? 1 : correction
        const textSize = this.#scaleSize(fontSize, textCorrection)
        const lineHeightPx = textSize * lineHeight
        const borderScale = element.border?.scaled === false ? (scale.correction ?? 1) : 1
        const radiusScale = element.border?.radiusScaled === false ? (scale.correction ?? 1) : 1
        const padding = this.resolvePadding(element, correction)
        const radius = WIDGET_RADIUS.get(element.border?.radius ?? 'none')?.value ?? '0'
        const textShadowSize = element.text?.shadow?.value === 'small'
                               ? [0, 1, 2]
                               : element.text?.shadow?.value === 'large'
                                 ? [0, 4, 8]
                                 : [0, 2, 4]

        return {
            '--lgs-widget-preview-bg': bgSnapshot ? `url(${bgSnapshot})` : 'none',
            '--lgs-tx-bg-color': element.background?.show ? this.getColor(element.background, true) : 'transparent',
            '--lgs-tx-color':  this.getColor(element.text, true),
            '--lgs-tx-font':     element.fontFamily === 'System' ? systemStack : element.fontFamily,
            '--lgs-tx-align':    element.align ?? 'left',
            '--lgs-tx-size':     `${textSize}px`,
            '--lgs-tx-weight':   element.weight ?? 'normal',
            '--lgs-tx-style':    element.style ?? 'normal',
            '--lgs-tx-lh':       element.lineHeight ?? '1',
            '--lgs-tx-line-height':    `${lineHeightPx}px`,
            '--lgs-tx-border':         element.border?.show ? `${this.#scaleSize(element.border.thickness, borderScale)}px solid ${this.getColor(element.border, true)}` : 'none',
            '--lgs-tx-radius':         element.border?.show ? this.#scaleRadius(radius, radiusScale) : '0',
            '--lgs-tx-padding-top':    `${padding.top}px`,
            '--lgs-tx-padding-right':  `${padding.right}px`,
            '--lgs-tx-padding-bottom': `${padding.bottom}px`,
            '--lgs-tx-padding-left':   `${padding.left}px`,
            '--lgs-tx-textarea-line-trim':      'calc((var(--lgs-tx-line-height) - 1em) / 2)',
            '--lgs-tx-textarea-padding-top':    'max(0px, calc(var(--lgs-tx-padding-top) - var(--lgs-tx-textarea-line-trim)))',
            '--lgs-tx-textarea-padding-bottom': 'max(0px, calc(var(--lgs-tx-padding-bottom) - var(--lgs-tx-textarea-line-trim)))',
            '--lgs-tx-blur':   (element.background?.show && element.background?.blur) ? 'var(--lgs-blur-s)' : '0',
            '--lgs-bg-elevation': (element.background?.shadow?.show && hasVisibleContainer) ? (
                element.background.shadow.value === 'small' ? `0 2px 8px ${bgShadowColor}` :
                element.background.shadow.value === 'large' ? `0 16px 32px ${bgShadowColor}` :
                `0 8px 16px ${bgShadowColor}`
            ) : 'none',
            '--lgs-tx-shadow':         element.text?.shadow?.show ? (
                `${this.#scaleSize(textShadowSize[0], textCorrection)}px ${this.#scaleSize(textShadowSize[1], textCorrection)}px ${this.#scaleSize(textShadowSize[2], textCorrection)}px ${txShadowColor}`
            ) : 'none',

            '--lgs-tx-stroke-width': `${element.text?.stroke?.show ? this.#scaleSize(element.text.stroke.width, textCorrection) : 0}px`,
            '--lgs-tx-stroke-color': element.text?.stroke?.show ? this.getColor(element.text.stroke, true) : 'transparent',
            '--lgs-tx-paint-order':  'fill stroke',

        }
    }
}
