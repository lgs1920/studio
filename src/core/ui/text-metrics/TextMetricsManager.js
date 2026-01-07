/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextMetricsManager.js
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

/**
 * Manager responsible for calculating dimensions and positioning
 * between SVG text elements and HTML overlay inputs/textareas.
 */
export class TextMetricsManager {
    /** @type {TextMetricsManager} */
    static #instance

    constructor() {
        if (TextMetricsManager.#instance) {
            return TextMetricsManager.#instance
        }
        TextMetricsManager.#instance = this
    }

    /**
     * @returns {TextMetricsManager}
     */
    static get instance() {
        if (!TextMetricsManager.#instance) {
            TextMetricsManager.#instance = new TextMetricsManager()
        }
        return TextMetricsManager.#instance
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