import { subscribe }                                                        from 'valtio'
import { COLOR_SWATCHES_NONE, COLOR_SWATCHES_RANDOM, COLOR_SWATCHES_SERIE } from '../LGS1920Context'


export class JourneyEditor {

    /** @param swatchIndex {integer} : color index */
    swatchIndex=0

    /** @param swatchesLength {number} : length of color palette */
    swatchesLength = lgs.configuration.colorSwatches.length

    constructor() {
        // Singleton
        if (JourneyEditor.instance) {
            return JourneyEditor.instance
        }

        // We need to interact with  Editor
        subscribe(lgs.journeyEditorStore, this.trackChanges)

        JourneyEditor.instance = this
    }

    trackChanges= ()=> {
    }

    /**
     * Set new color from color swatches
     *
     * @param reset {boolean} if true, index is set to 0 (only in the the case of COLOR_SWATCHES_SERIE)
     *
     * @return color {string}
     */
     newColor=(reset = false)=> {

        switch(lgs.configuration.colorDistribution) {
            case COLOR_SWATCHES_NONE:       // Always the first
                this.swatchIndex =0
                return lgs.configuration.colorSwatches[this.swatchIndex]
            case COLOR_SWATCHES_SERIE:      // Increment index each time
                if (this.swatchIndex  ===  this.swatchesLength || reset ) {
                    this.swatchIndex =0
                }
                return lgs.configuration.colorSwatches[this.swatchIndex++]
            case COLOR_SWATCHES_RANDOM:      // Randomize
                this.swatchIndex =Math.floor(Math.random() * this.swatchesLength)
                return lgs.configuration.colorSwatches[this.swatchIndex]
        }
    }


}