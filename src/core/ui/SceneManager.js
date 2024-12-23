import {
    NO_FOCUS, REFRESH_DRAWING, SCENE_MODE_2D, SCENE_MODE_3D, SCENE_MODE_COLUMBUS, SCENE_MODES,
}                                  from '@Core/constants'
import { SceneUtils }              from '@Utils/cesium/SceneUtils'
import { UIToast }                 from '@Utils/UIToast'
import { LayersAndTerrainManager } from './LayerAndTerrainManager'

export class SceneManager {
    constructor() {
        // Singleton
        if (SceneManager.instance) {
            return SceneManager.instance
        }
        SceneManager.instance = this

    }

    /**
     * Do morphing
     *
     * @param mode {integer}       SCENE_MODE_2D.value or SCENE_MODE_3D.value
     * @param callback {function}   called  at the end of morphing
     */
    morph = (mode, callback = null) => {
        // update settings
        lgs.settings.scene.mode.value = mode
        SceneUtils.morph(mode, callback)
    }

    /**
     * Morph to 2D
     *
     * @param callback {function}   called  at the end of morphing
     */
    morphTo2D = (callback) => {
        this.morph(SCENE_MODE_2D.value, callback)
    }

    /**
     * Morph to 3D
     *
     * @param callback {function}   called  at the end of morphing
     */
    morphTo3D = (callback) => {
        this.morph(SCENE_MODE_3D.value, callback)
    }

    /**
     * IS it 2D ?
     *
     * return {boolean}
     */
    get is2D() {
        return lgs.settings.scene.mode.value * 1 === SCENE_MODE_2D.value
    }

    /**
     * Is it 3D ?
     *
     * return {boolean}
     */
    get is3D() {
        return lgs.settings.scene.mode.value * 1 === SCENE_MODE_3D.value
    }

    /**
     * Is it Columbus View ?
     *
     * return {boolean}
     */
    get isColumbus() {
        return lgs.settings.scene.mode.value * 1 === SCENE_MODE_COLUMBUS.value
    }

    /**
     * switch between 2D and 3D
     *
     * @param callback {function}   called  at the end of morphing
     */
    toggleMode = (callback) => {
        if (this.is2D) {
            this.morphTo3D(callback)
        }
        else {
            this.morphTo2D(callback)
        }
    }

    test = (sceneMode) => console.log('morph', sceneMode)

    noRelief = () => {
        const manager = new LayersAndTerrainManager()
        const terrain = manager.getEntityProxy(lgs.settings.layers.terrain)
        return lgs.settings.scene.mode.value * 1 === SCENE_MODE_2D.value
            || (terrain?.noRelief ?? false)
    }

    notifyMorph = () => {
        UIToast.success({
                            caption: `View changed to ${SCENE_MODES.get(lgs.scene.mode).title} !`,
                            text:    `Enjoy!`,
                        })
    }


    afterMorphing = async () => {

        // Remove starting animation (rotate,...)
        __.ui.cameraManager.move.releaseEvent()

        // Now it's time for the show. Draw all journeys
        const items = []
        lgs.journeys.forEach(journey => {
            items.push(journey.draw({
                                        action: REFRESH_DRAWING,
                                        mode:   NO_FOCUS,
                                    }))
        })
        await Promise.all(items)
        this.notifyMorph()
    }

}