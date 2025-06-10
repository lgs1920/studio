/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyEditor.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-10
 * Last modified: 2025-06-10
 *
 *
 * Copyright © 2025 LGS1920
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

    /**
     * Set new color from color swatches
     *
     * @param reset {boolean} if true, index is set to 0 (only in the the case of COLOR_SWATCHES_SEQUENCE)
     *
     * @return color {string}
     */
    newColor = (reset = false) => {

        switch (lgs.settings.getSwatches.distribution) {
            case COLOR_SWATCHES_NONE:       // Always the first
                this.swatchesIndex = 0
                return lgs.settings.swatches.list[this.swatchesIndex]
            case COLOR_SWATCHES_SEQUENCE:      // Increment index each time
                this.swatchesIndex = lgs.settings.swatches.current++ ?? 0
                if (this.swatchesIndex === this.swatchesLength || reset) {
                    this.swatchesIndex = 0
                }
                lgs.settings.swatches.current = ++this.swatchesIndex
                return lgs.settings.swatches.list[this.swatchesIndex]
            case COLOR_SWATCHES_RANDOM:      // Randomize
                this.swatchesIndex = Math.floor(Math.random() * this.swatchesLength)
                return lgs.settings.swatches.list[this.swatchesIndex]
        }
    }


}