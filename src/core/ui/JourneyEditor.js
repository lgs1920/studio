/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyEditor.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { COLOR_SWATCHES_NONE, COLOR_SWATCHES_RANDOM, COLOR_SWATCHES_SEQUENCE } from '@Core/constants'
import { subscribe }                                                           from 'valtio'


export class JourneyEditor {

    /** @param swatchesLength {number} : length of color palette */
    swatchesLength = lgs.settings.swatches.list.length
    /** @param swatchIndex {integer} : color index */
    swatchesIndex = lgs.settings.swatches?.current ?? 0

    constructor() {
        // Singleton
        if (JourneyEditor.instance) {
            return JourneyEditor.instance
        }

        // We need to interact with  Editor
        subscribe(lgs.journeyEditorStore, this.trackChanges)

        JourneyEditor.instance = this
    }

    trackChanges = () => {
    }

    #normalizeSwatchIndex = (value, length) => {
        if (!Number.isFinite(length) || length <= 0) {
            return 0
        }

        const index = Number(value)
        if (!Number.isFinite(index)) {
            return 0
        }

        return ((Math.trunc(index) % length) + length) % length
    }

    /**
     * Set new color from color swatches
     *
     * @param reset {boolean} if true, index is set to 0 (only in the the case of COLOR_SWATCHES_SEQUENCE)
     *
     * @return color {string}
     */
    newColor = (reset = false) => {
        const palette = Array.isArray(lgs.settings.swatches.list) ? lgs.settings.swatches.list : []
        const swatchesLength = palette.length

        if (swatchesLength === 0) {
            return '#ffffff'
        }

        switch (lgs.settings.getSwatches.distribution) {
            case COLOR_SWATCHES_NONE: {       // Always the first
                this.swatchesIndex = 0
                lgs.settings.swatches.current = 1
                return palette[0]
            }
            case COLOR_SWATCHES_SEQUENCE: {   // Increment index each time
                const currentIndex = this.#normalizeSwatchIndex(lgs.settings.swatches.current, swatchesLength)
                const nextIndex = reset ? 0 : currentIndex
                this.swatchesIndex = nextIndex
                lgs.settings.swatches.current = (nextIndex + 1) % swatchesLength
                return palette[nextIndex] ?? palette[0]
            }
            case COLOR_SWATCHES_RANDOM: {     // Randomize
                this.swatchesIndex = Math.floor(Math.random() * swatchesLength)
                lgs.settings.swatches.current = (this.swatchesIndex + 1) % swatchesLength
                return palette[this.swatchesIndex]
            }
            default: {
                this.swatchesIndex = 0
                return palette[0]
            }
        }
    }


}
