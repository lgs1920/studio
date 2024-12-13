import { SceneMode }                                                                   from 'cesium'
import { SCENE_MODE_2D, SCENE_MODE_3D, SCENE_MODE_COLUMBUS, SCENE_MODE_MORPHING_TIME } from '../../core/constants'

export class SceneUtils {

    /**
     * Do Morphing and trigger event if there is a callback
     *
     * @param sceneMode {integer} SCENE_MODE_2D.value or SCENE_MODE_3D.value
     * @param callback
     */

    static morph = async (sceneMode, callback = null) => {
        // Trigger morphComplete only once,
        if (typeof callback === 'function' && !SceneUtils.morphCompeteEvent) {
            lgs.scene.morphComplete.addEventListener(function (event, currentSceneMode) {
                callback({current: currentSceneMode, new: sceneMode})
            })
        }

        switch (sceneMode) {
            case SCENE_MODE_2D.value:
                await lgs.scene.morphTo2D(SCENE_MODE_MORPHING_TIME)
                break

            case SCENE_MODE_COLUMBUS.value:
                await lgs.scene.morphToColumbusView(SCENE_MODE_MORPHING_TIME)
                break

            case SCENE_MODE_3D.value:
                await lgs.scene.morphTo3D(SCENE_MODE_MORPHING_TIME)
                break
        }
    }

    /**
     * Return LGS scene mode from Cesium scene
     *
     * @return {{icon: IconDefinition, label: string, title: string, value: number}|{icon: IconDefinition, label:
     *     string, title: string, value: number}|{icon: IconDefinition, label: string, title: string, value: number}}
     */
    static modeFromGIStoLGS = () => {
        switch (lgs.scene.mode) {
            case SceneMode.SCENE2D:
                return SCENE_MODE_2D
            case SceneMode.SCENE3D:
                return SCENE_MODE_3D
            case SceneMode.COLUMBUS_VIEW:
                return SCENE_MODE_COLUMBUS
            default:
                return SCENE_MODE_3D
        }
    }

    static modeFromLGSToGIS = (mode = lgs.settings.scene.mode.value) => {
        switch (mode.value) {
            case SCENE_MODE_2D.value:
                return SceneMode.SCENE2D
            case SCENE_MODE_3D.value:
                return SceneMode.SCENE3D
            case SCENE_MODE_COLUMBUS.value:
                return SceneMode.COLUMBUS_VIEW
            default:
                return SceneMode.SCENE3D
        }
    }


}