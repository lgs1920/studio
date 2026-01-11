/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextWidgetManager.js
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

import { colord } from 'colord'

/**
 * Manager responsible for text widget styling, CSS variable generation,
 * and positioning between SVG text elements and HTML overlay inputs/textareas.
 */
export class TextWidgetManager {
    /** @type {TextWidgetManager} */
    static #instance

    constructor() {
        if (TextWidgetManager.#instance) {
            return TextWidgetManager.#instance
        }
        TextWidgetManager.#instance = this
    }

    /**
     * @returns {TextWidgetManager}
     */
    static get instance() {
        if (!TextWidgetManager.#instance) {
            TextWidgetManager.#instance = new TextWidgetManager()
        }
        return TextWidgetManager.#instance
    }

    /**
     * Converts color with opacity to RGB string
     * @param {Object} item - Object with color and opacity properties
     * @param {boolean} alpha - Whether to apply alpha
     * @returns {string}
     */
    getColor(item, alpha = false) {
        if (!item || !item.color) {
            return 'transparent'
        }
        const raw = item.color.startsWith('--') ? __.ui.css.getCSSVariable(item.color) : item.color
        const c = colord(raw)
        return alpha ? c.alpha(item.opacity ?? 1).toRgbString() : c.toRgbString()
    }

    /**
     * Generates CSS variables for text widget styling
     * @param {Object} element - Text element configuration
     * @param {string} bgSnapshot - Background snapshot URL
     * @param {string} systemStack - System font stack
     * @returns {Object} CSS variables object
     */
    generateCSSVariables(element, bgSnapshot = null, systemStack = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif') {
        if (!element) {
            return {}
        }

        const bgShadowColor = this.getColor(element.background?.shadow, true)
        const txShadowColor = this.getColor(element.shadow, true)
        const hasVisibleContainer = element.background?.show || element.border?.show

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
            '--lgs-tx-radius':   `${element.border?.radius ?? 0}px`,

            // Blur is ONLY applied if background is shown
            '--lgs-tx-blur': (element.background?.show && element.background?.blur) ? 'blur(8px)' : 'none',

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
     * Calculates styles for the overlay textarea matching SVG text alignment.
     * @param {SVGTextElement} textElement
     * @param {HTMLElement} measurer
     * @param {number} lineHeightMultiplier
     * @param {number} scale
     * @returns {Object}
     */
    getOverlayStyle(textElement, measurer, lineHeightMultiplier = 1.2, scale = 1) {
        if (!textElement || !measurer) {
            return {}
        }

        const bbox = textElement.getBBox()
        const svg = textElement.ownerSVGElement
        const ctm = textElement.getScreenCTM()

        if (!ctm || !svg) {
            return {}
        }

        const svgRect = svg.getBoundingClientRect()
        const computed = window.getComputedStyle(textElement)

        const fontSizePx = parseFloat(computed.fontSize)
        const lineHeightPx = fontSizePx * lineHeightMultiplier

        // Get viewBox to understand SVG coordinate system
        const viewBox = svg.viewBox.baseVal
        const viewBoxX = viewBox.x
        const viewBoxY = viewBox.y
        const viewBoxWidth = viewBox.width

        // Position textarea at viewBox origin (left edge)
        const ptLeft = svg.createSVGPoint()
        ptLeft.x = viewBoxX
        ptLeft.y = bbox.y

        const screenPosLeft = ptLeft.matrixTransform(ctm)
        const left = (screenPosLeft.x - svgRect.left) / scale
        const top = (screenPosLeft.y - svgRect.top) / scale

        // Use viewBox width for textarea to cover full text area
        const fullWidth = viewBoxWidth

        return {
            position:      'absolute',
            left:          `${left}px`,
            top:           `${top}px`,
            width:         `${fullWidth}px`,
            height:        `${bbox.height}px`,
            transform:     'none',
            fontSize:      computed.fontSize,
            fontFamily:    computed.fontFamily,
            fontWeight:    computed.fontWeight,
            fontStyle:     computed.fontStyle,
            letterSpacing: computed.letterSpacing,
            textAlign:     'inherit',
            background:    'transparent',
            border:        'none',
            outline:       'none',
            padding:       '0px',
            margin:        '0px',
            lineHeight:    `${lineHeightPx}px`,
            color:         'inherit',
            caretColor:    'currentColor',
            display:       'block',
            zIndex:        10,
            resize:        'none',
            overflow:      'hidden',
            whiteSpace:    'pre',
            boxSizing:     'content-box',
        }
    }

    /**
     * Styles for the hidden measurer.
     */
    getMeasurerStyle(textElement, lineHeightMultiplier = 1.2) {
        if (!textElement) {
            return {visibility: 'hidden'}
        }
        const computed = window.getComputedStyle(textElement)
        const fontSizePx = parseFloat(computed.fontSize)

        return {
            position:   'absolute',
            visibility: 'hidden',
            whiteSpace: 'pre',
            fontSize:   computed.fontSize,
            fontFamily: computed.fontFamily,
            fontWeight: computed.fontWeight,
            lineHeight: `${fontSizePx * lineHeightMultiplier}px`,
        }
    }
}