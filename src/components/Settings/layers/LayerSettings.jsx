import { Range }                                  from '@Components/Range'
import { faArrowRotateLeft, faXmark }             from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDivider, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { useEffect, useState }                    from 'react'
import { useSnapshot }                            from 'valtio/index'
import { LayersAndTerrainManager }                from '../../../core/ui/LayerAndTerrainManager'
import { FA2SL }                                  from '../../../Utils/FA2SL'

export const LayerSettings = (props) => {
    const editor = lgs.editorSettingsProxy
    const snap = useSnapshot(editor)

    const layers = lgs.settings.layers
    const layersSnap = useSnapshot(layers)

    const [layer, setLayer] = useState(null)

    const viewModel = {
        brightness: 0,
        contrast:   0,
        alpha:      1,
        hue:        0,
        saturation: 0,
        gamma:      0,
    }

    const resetToFactory = () => {
    }

    const changeHandler = (event, value) => {
        editor.settingsChanged = true
    }

    useEffect(() => {
        editor.settingsChanged = false

        const manager = new LayersAndTerrainManager()
        setLayer(manager.layer)

        /*

         On connait le layer. Il faut determiner l'ImageryLayer qui correspond avec layer.type
         Puis on force chaque valeur dans le range correspondant.


         Dans ChangeHandler, onregarde avec un switch quelle est la valeur.
         - On la sauve dans lesettings
         - on la foce dans l'imageryLayer

         */
    }, [])

    return (
        <>
            {
                snap.openSettings && props.visible() &&
                <div id={'layer-settings'} key={'filter-entities'} className={'lgs-card lgs-slide-down'}>
                    <Range label={'Hue'} value={15} callback={changeHandler}/>
                    <Range label={'Saturation'} value={15} callback={changeHandler}/>
                    <Range label={'Alpha'} value={15} callback={changeHandler}/>
                    <Range label={'Gamma'} value={15} callback={changeHandler}/>
                    <Range label={'Contrast'} value={15} callback={changeHandler}/>
                    <Range label={'Brightness'} value={15} callback={changeHandler}/>
                    <SlDivider></SlDivider>
                    <div className="buttons-bar">
                        <SlTooltip Content={'Reset to default'}>
                            <SlButton size="small">
                                <SlIcon library="fa" onClick={resetToFactory} slot="prefix" size="small"
                                        name={FA2SL.set(faArrowRotateLeft)}/> {'Reset'}
                            </SlButton>
                        </SlTooltip>

                        <SlTooltip Content={'Cancel Last Changes'}>
                            <SlButton size="small" disabled={!snap.settingsChanged}>
                                <SlIcon library="fa" onClick={resetToFactory} slot="prefix" size="small"
                                        name={FA2SL.set(faXmark)}/> {'Cancel'}
                            </SlButton>
                        </SlTooltip>

                    </div>
                </div>
            }
        </>
    )
}
