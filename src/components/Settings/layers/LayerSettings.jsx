import { Range }                                  from '@Components/Range'
import { DEFAULT_LAYERS_COLOR_SETTINGS }          from '@Core/constants'
import { faArrowRotateLeft, faXmark }             from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDivider, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { LayersUtils }                            from '@Utils/cesium/LayersUtils'
import { FA2SL }                                  from '@Utils/FA2SL'
import { useEffect }                              from 'react'
import { useSnapshot }                            from 'valtio/index'

export const LayerSettings = (props) => {
    const editor = lgs.editorSettingsProxy
    const snap = useSnapshot(editor)

    const layers = lgs.settings.layers
    const layersSnap = useSnapshot(layers)


    const resetToFactory = () => {
        editor.layer.settingsChanged = true
        layers.colorSettings[layers[editor.layer.selectedType]] = {...DEFAULT_LAYERS_COLOR_SETTINGS}
        LayersUtils.applySettings(layers.colorSettings[layers[editor.layer.selectedType]], editor.layer.selectedType)
    }
    const cancelChanges = () => {
        editor.layer.settingsChanged = false
        layers.colorSettings[layers[editor.layer.selectedType]] = {...lgs.theDefaultColorSettings}
        LayersUtils.applySettings(layers.colorSettings[layers[editor.layer.selectedType]], editor.layer.selectedType)
    }

    const changeHandler = (name, current, old) => {
        editor.layer.settingsChanged = true
        layers.colorSettings[layers[editor.layer.selectedType]][name] = current * 1
        LayersUtils.applySettings(layers.colorSettings[layers[editor.layer.selectedType]], editor.layer.selectedType)
    }

    const changeColorHandler = event => {
        editor.layer.settingsChanged = true
        layers.colorSettings[layers[editor.layer.selectedType]].colorToAlpha = event.target.value
        LayersUtils.applySettings(layers.colorSettings[layers[editor.layer.selectedType]], editor.layer.selectedType)
    }

    const setColorSettings = () => {
        if (layers.colorSettings === null) {
            layers.colorSettings = {[layers[editor.layer.selectedType]]: {...DEFAULT_LAYERS_COLOR_SETTINGS}}
        }

        if (layers.colorSettings && (layers.colorSettings[layers[editor.layer.selectedType]] ?? false)) {

        }
        else {
            layers.colorSettings[layers[editor.layer.selectedType]] = {...DEFAULT_LAYERS_COLOR_SETTINGS}
        }
        if (__.app.isEmpty(lgs.theDefaultColorSettings)) {
            lgs.theDefaultColorSettings = {...layers.colorSettings[layers[editor.layer.selectedType]]}
        }

        LayersUtils.applySettings(layers.colorSettings[layers[editor.layer.selectedType]], editor.layer.selectedType)
    }

    useEffect(() => {
        setColorSettings()
    }, [editor.layer.selectedType, editor.layer.settingsChanged, layersSnap.base, layersSnap.overlay, layersSnap.terrain])

    return (
        <>
            {
                snap.openSettings && props.visible() &&
                <div id={'layer-settings'} key={'filter-entities'} className={'lgs-card lgs-slide-down'}>
                    <Range label={'Hue'} value={layersSnap.colorSettings[layers[snap.layer.selectedType]].hue}
                           min={0} max={359} step={1} onChange={changeHandler}
                           name="hue"
                    />
                    <Range label={'Saturation'}
                           value={layersSnap.colorSettings[layers[snap.layer.selectedType]].saturation}
                           min={0} max={100} step={1} onChange={changeHandler}
                           name="saturation"
                    />
                    <Range label={'Alpha'} value={layersSnap.colorSettings[layers[snap.layer.selectedType]].alpha}
                           min={0} max={3} step={0.05} onChange={changeHandler}
                           name="alpha"
                    />
                    <Range label={'Gamma'} value={layersSnap.colorSettings[layers[snap.layer.selectedType]].gamma}
                           min={0} max={3} step={0.05} onChange={changeHandler}
                           name="gamma"
                    />
                    <Range label={'Contrast'} value={layersSnap.colorSettings[layers[snap.layer.selectedType]].contrast}
                           min={0} max={3} step={0.05} onChange={changeHandler}
                           name="contrast"
                    />
                    <Range label={'Brightness'}
                           value={layersSnap.colorSettings[layers[snap.layer.selectedType]].brightness}
                           min={0} max={10} step={0.05} onChange={changeHandler}
                           name="brightness"
                    />

                    {/* TODO Fix the alpha color and color threshold */}

                    {/* <SlDivider></SlDivider> */}

                    {/* <Range label={'Color to Alpha Threshold'} value={layers.colorSettings[layers[editor.layer.selectedType]].colorToAlphaThreshold} */}
                    {/*        min={0} max={1} step={0.05} onChange={changeHandler}  onChange={changeHandler} */}
                    {/*        name="colorToAlphaThreshold" */}
                    {/* /> */}
                    {/* <div className="alpha-to-color"> */}
                    {/*     {'Apply transparency to'}<SlColorPicker size="small" opacity={false} */}
                    {/*                                             value={layers.colorSettings[layers[editor.layer.selectedType]].colorToAlpha} */}
                    {/*                                             onSlChange={changeColorHandler}/> */}
                    {/* </div> */}

                    <SlDivider></SlDivider>
                    <div className="buttons-bar">
                        <SlTooltip Content={'Reset to default'}>
                            <SlButton size="small" onClick={resetToFactory}>
                                <SlIcon library="fa" slot="prefix" size="small"
                                        name={FA2SL.set(faArrowRotateLeft)}/> {'Reset'}
                            </SlButton>
                        </SlTooltip>

                        <SlTooltip Content={'Cancel Last Changes'}>
                            <SlButton size="small" disabled={!snap.layer.settingsChanged} onClick={cancelChanges}>
                                <SlIcon library="fa" slot="prefix" size="small"
                                        name={FA2SL.set(faXmark)}/> {'Cancel'}
                            </SlButton>
                        </SlTooltip>
                    </div>
                </div>
            }
        </>
    )
}
