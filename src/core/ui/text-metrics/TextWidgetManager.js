/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextWidgetManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-15
 * Last modified: 2026-04-15
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

    generateCSSVariables(element, bgSnapshot = null, systemStack = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif') {
        if (!element) {
            return {}
        }

        const bgShadowColor = this.getColor(element.background?.shadow, true)
        const txShadowColor = this.getColor(element.text.shadow, true)

        // Resolve stroke color with alpha support
        const txStrokeColor = this.getColor(element.text.stroke, true)

        const hasVisibleContainer = element.background?.show || element.border?.show

        const fontSize = element.size ?? 16
        const lineHeight = parseFloat(element.lineHeight ?? 1)
        const lineHeightPx = fontSize * lineHeight
        const basePadding = Math.max(4, lineHeightPx * 0.25)
        const paddingBottom = Math.max(4, lineHeightPx * 0.25)
        const paddingSide = element.border?.pill ? basePadding * 2.5 : basePadding

        return {
            '--lgs-widget-preview-bg': bgSnapshot ? `url(${bgSnapshot})` : 'none',
            '--lgs-tx-bg-color': element.background?.show ? this.getColor(element.background, true) : 'transparent',
            '--lgs-tx-color':  this.getColor(element.text, true),
            '--lgs-tx-font':     element.fontFamily === 'System' ? systemStack : element.fontFamily,
            '--lgs-tx-align':    element.align ?? 'left',
            '--lgs-tx-size':     `${element.size ?? 16}px`,
            '--lgs-tx-weight':   element.weight ?? 'normal',
            '--lgs-tx-style':    element.style ?? 'normal',
            '--lgs-tx-lh':       element.lineHeight ?? '1',
            '--lgs-tx-border':   element.border?.show ? `${element.border.thickness}px solid ${this.getColor(element.border, true)}` : 'none',
            '--lgs-tx-radius': element.border?.show ? WIDGET_RADIUS.get(element.border.radius ?? 'none')?.value : '0',
            '--lgs-tx-padding-top': `${paddingBottom}px`,
            '--lgs-tx-padding-right':  `${paddingSide}px`,
            '--lgs-tx-padding-bottom': `${paddingBottom}px`,
            '--lgs-tx-padding-left':   `${paddingSide}px`,
            '--lgs-tx-blur':   (element.background?.show && element.background?.blur) ? 'var(--lgs-blur-s)' : '0',
            '--lgs-bg-elevation': (element.background?.shadow?.show && hasVisibleContainer) ? (
                element.background.shadow.value === 'small' ? `0 2px 8px ${bgShadowColor}` :
                element.background.shadow.value === 'large' ? `0 16px 32px ${bgShadowColor}` :
                `0 8px 16px ${bgShadowColor}`
            ) : 'none',
            '--lgs-tx-shadow': element.text.shadow?.show ? (
                element.text.shadow.value === 'small' ? `0 1px 2px ${txShadowColor}` :
                element.text.shadow.value === 'large' ? `0 4px 8px ${txShadowColor}` :
                `0 2px 4px ${txShadowColor}`
            ) : 'none',

            '--lgs-tx-stroke-width': `${element.text.stroke?.show ? element.text.stroke.width : 0}px`,
            '--lgs-tx-stroke-color': element.text.stroke?.show ? this.getColor(element.text.stroke, true) : 'transparent',
            '--lgs-tx-paint-order':  'fill stroke',

        }
    }
}