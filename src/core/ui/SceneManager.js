import { FLAT_TERRAINS, SCENE_MODE_2D, SCENE_MODE_3D, SCENE_MODES } from '@Core/constants'
import { SceneUtils }                                               from '@Utils/cesium/SceneUtils'
import { UIToast }                                                  from '@Utils/UIToast'
import { NO_FOCUS, RE_LOADING }                                     from '../Journey'

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
     * switch between 2D and 3D
     *
     * @param callback {function}   called  at the end of morphing
     */
    toggleMode = (callback) => {
        if (lgs.settings.scene.mode.value * 1 === SCENE_MODE_2D.value) {
            this.morphTo3D(callback)
        }
        else {
            this.morphTo2D(callback)
        }
    }

    test = (sceneMode) => console.log('morph', sceneMode)

    noRelief = () => {
        return lgs.settings.scene.mode.value * 1 === SCENE_MODE_2D.value
            || FLAT_TERRAINS.includes(lgs.settings.layers.terrain)
    }

    notifyMorph = () => {
        UIToast.success({
                            caption: `View changed to ${SCENE_MODES.get(lgs.scene.mode).title} !`,
                            text:    `Enjoy!`,
                        })
    }


    afterMorphing = async (props) => {

        // Now it's time for the show. Draw all journeys
        const items = []
        lgs.journeys.forEach(journey => {
            items.push(journey.draw({
                                        action: RE_LOADING,
                                        mode:   NO_FOCUS,
                                    }))
        })
        await Promise.all(items)


        this.notifyMorph()
    }

}