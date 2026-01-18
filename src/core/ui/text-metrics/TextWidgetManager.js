/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextWidgetManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-18
 * Last modified: 2026-01-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WIDGET_RADIUS } from '@Core/constants'
import { colord }        from 'colord'

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
        if (!item || !item.color) {
            return 'transparent'
        }
        const raw = item.color.startsWith('--') ? __.ui.css.getCSSVariable(item.color) : item.color
        const c = colord(raw)
        return alpha ? c.alpha(item.opacity ?? 1).toRgbString() : c.toRgbString()
    }

    generateCSSVariables(element, bgSnapshot = null, systemStack = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif') {
        if (!element) {
            return {}
        }

        const bgShadowColor = this.getColor(element.background?.shadow, true)
        const txShadowColor = this.getColor(element.shadow, true)
        const hasVisibleContainer = element.background?.show || element.border?.show

        const fontSize = element.size ?? 16
        const lineHeight = parseFloat(element.lineHeight ?? 1)
        const lineHeightPx = fontSize * lineHeight
        const paddingSide = Math.max(4, lineHeightPx * 0.25)
        const paddingBottom = Math.max(5, lineHeightPx * 0.35)

        return {
            '--lgs-tx-tiles':    bgSnapshot ? `url(${bgSnapshot})` : 'none',
            '--lgs-tx-bg-color': element.background?.show ? this.getColor(element.background, true) : 'transparent',
            '--lgs-tx-color':    this.getColor(element, true),
            '--lgs-tx-font':     element.fontFamily === 'System' ? systemStack : element.fontFamily,
            '--lgs-tx-align':    element.align ?? 'left',
            '--lgs-tx-size':     `${element.size ?? 16}px`,
            '--lgs-tx-weight':   element.weight ?? 'normal',
            '--lgs-tx-style':    element.style ?? 'normal',
            '--lgs-tx-lh':       element.lineHeight ?? '1',
            '--lgs-tx-border':   element.border?.show ? `${element.border.thickness}px solid ${this.getColor(element.border, true)}` : 'none',
            '--lgs-tx-radius': element.border?.show ? WIDGET_RADIUS.get(element.border.radius ?? 'none')?.value : '0',
            '--lgs-tx-padding-top':    `${paddingSide}px`,
            '--lgs-tx-padding-right':  `${paddingSide}px`,
            '--lgs-tx-padding-bottom': `${paddingBottom}px`,
            '--lgs-tx-padding-left':   `${paddingSide}px`,
            '--lgs-tx-blur': (element.background?.show && element.background?.blur) ? 'var(--lgs-blur)' : '0',
            '--lgs-bg-elevation': (element.background?.shadow?.show && hasVisibleContainer) ? (
                element.background.shadow.value === 'small' ? `0 2px 8px ${bgShadowColor}` :
                element.background.shadow.value === 'large' ? `0 16px 32px ${bgShadowColor}` :
                `0 8px 16px ${bgShadowColor}`
            ) : 'none',
            '--lgs-tx-shadow': element.shadow?.show ? (
                element.shadow.value === 'small' ? `0 1px 2px ${txShadowColor}` :
                element.shadow.value === 'large' ? `0 4px 8px ${txShadowColor}` :
                `0 2px 4px ${txShadowColor}`
            ) : 'none',
        }
    }

    /**
     * Captures the background and opens the editor.
     * This runs BEFORE the Panel or TextWidgetEditor are even mounted.
     */
    async openTextEditor(group, key, entity) {
        const _widgetEl = __.ui.widgetManager.getElementById(entity)
        const _sourceCanvas = lgs.canvas

        if (_widgetEl && _sourceCanvas) {
            // 1. Force a clean render of the scene
            lgs.scene.render()
            const _snapshot = await this.captureBackgroundSnapshot(_widgetEl, _sourceCanvas)
            lgs.stores.ui.widget.currentSnapshot = _snapshot
        }

        // 4. Finally, open the drawer
        __.ui.drawerManager.open(WIDGETS_EDITOR_DRAWER, {entity})
    }
}