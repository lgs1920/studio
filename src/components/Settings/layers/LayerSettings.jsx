/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LayerSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-15
 * Last modified: 2026-03-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Range }                                  from '@Components/Range'
import { DEFAULT_LAYERS_COLOR_SETTINGS }                  from '@Core/constants'
import { WaButton, WaCard, WaDivider, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { useEffect }                                      from 'react'
import { useSnapshot }                            from 'valtio/index'
import { LayersUtils }                                    from '@Utils/cesium/LayersUtils'

/**
 * Component to manage layer-specific visual settings like hue, saturation, etc.
 * Uses Valtio proxies for global state management.
 */
export const LayerSettings = (props) => {
    const $editor = lgs.editorSettingsProxy
    const editor = useSnapshot($editor)

    const $layers = lgs.settings.layers
    const layers = useSnapshot($layers)

    /**
     * Resets settings to factory defaults.
     */
    const resetToFactory = () => {
        const layerKey = layers[editor.layer.selectedType]
        $editor.layer.settingsChanged = false
        $layers.colorSettings[layerKey] = {...DEFAULT_LAYERS_COLOR_SETTINGS}
        LayersUtils.applySettings($layers.colorSettings[layerKey], editor.layer.selectedType)
    }

    /**
     * Reverts changes to the last known state stored in the application context.
     */
    const undoChanges = () => {
        const layerKey = layers[editor.layer.selectedType]
        $editor.layer.settingsChanged = false
        $layers.colorSettings[layerKey] = {...lgs.theDefaultColorSettings}
        LayersUtils.applySettings($layers.colorSettings[layerKey], editor.layer.selectedType)
    }

    /**
     * Closes the settings panel and resets modification flags.
     */
    const close = () => {
        $editor.openSettings = !$editor.openSettings
        $editor.settingsChanged = true
    }

    /**
     * Handles slider updates and propagates them to the underlying engine.
     */
    const changeHandler = (name, current) => {
        const layerKey = layers[editor.layer.selectedType]
        $editor.layer.settingsChanged = true
        $layers.colorSettings[layerKey][name] = current * 1
        LayersUtils.applySettings($layers.colorSettings[layerKey], editor.layer.selectedType)
    }

    /**
     * Ensures color settings are initialized properly for the selected layer.
     */
    const setColorSettings = () => {
        const layerKey = layers[editor.layer.selectedType]

        if (!$layers.colorSettings) {
            $layers.colorSettings = {[layerKey]: {...DEFAULT_LAYERS_COLOR_SETTINGS}}
        }

        if (!$layers.colorSettings[layerKey]) {
            $layers.colorSettings[layerKey] = {...DEFAULT_LAYERS_COLOR_SETTINGS}
        }

        if (__.app.isEmpty(lgs.theDefaultColorSettings)) {
            lgs.theDefaultColorSettings = {...$layers.colorSettings[layerKey]}
        }

        LayersUtils.applySettings($layers.colorSettings[layerKey], editor.layer.selectedType)
    }

    useEffect(() => {
        setColorSettings()
    }, [editor.layer.selectedType, editor.layer.settingsChanged, layers.base, layers.overlay, layers.terrain])

    return (
        <>
            {editor.openSettings && props.visible() &&
                <WaCard id={'layer-settings'} key={'layer-entities'} className={'lgs-slide-down'}
                        appearance="outlined">
                    <h3 slot={'header'}>
                        <WaIcon name="sliders" variant="regular"/> {'Color Adjustement'}
                    </h3>
                    <Range label={'Hue'}
                           value={layers.colorSettings[layers[editor.layer.selectedType]].hue}
                           min={0} max={359} step={1} onChange={changeHandler}
                           name={'hue'}
                    />
                    <Range label={'Saturation'}
                           value={layers.colorSettings[layers[editor.layer.selectedType]].saturation}
                           min={0} max={100} step={1} onChange={changeHandler}
                           name={'saturation'}
                    />
                    <Range label={'Alpha'}
                           value={layers.colorSettings[layers[editor.layer.selectedType]].alpha}
                           min={0} max={3} step={0.05} onChange={changeHandler}
                           name={'alpha'}
                    />
                    <Range label={'Gamma'}
                           value={layers.colorSettings[layers[editor.layer.selectedType]].gamma}
                           min={0} max={3} step={0.05} onChange={changeHandler}
                           name={'gamma'}
                    />
                    <Range label={'Contrast'}
                           value={layers.colorSettings[layers[editor.layer.selectedType]].contrast}
                           min={0} max={3} step={0.05} onChange={changeHandler}
                           name={'contrast'}
                    />
                    <Range label={'Brightness'}
                           value={layers.colorSettings[layers[editor.layer.selectedType]].brightness}
                           min={0} max={10} step={0.05} onChange={changeHandler}
                           name={'brightness'}
                    />

                    <WaDivider/>
                    <div className={'buttons-bar'}>
                        <WaTooltip for={'lgs--reset-layer-settings-to-factory'}>{'Reset to factory'}</WaTooltip>
                        <WaButton id={'lgs--reset-layer-settings-to-factory'}
                                  size={'small'} onClick={resetToFactory}
                                  appearance={'outlined'}
                                  variant={'brand'}
                        >
                            <WaIcon size={'small'} name={'arrow-rotate-left'}/> {'Reset'}
                        </WaButton>

                        <div className={'buttons-bar'}>
                            <WaTooltip for={'lgs--undo-layer-settings-last-changes'}>{'Undo Last Changes'}</WaTooltip>
                            <WaButton id={'lgs--undo-layer-settings-last-changes'}
                                      size={'small'}
                                      appearance="plain"
                                      disabled={!editor.layer.settingsChanged} onClick={undoChanges}>
                                <WaIcon size={'small'} name={'arrow-u-turn-up-left'} variant={'regular'}/> {'Undo'}
                            </WaButton>

                            <WaTooltip for={'lgs--close-layer-settings'}>{'Close settings'}</WaTooltip>
                            <WaButton id={'lgs--close-layer-settings'}
                                      size={'small'}
                                      variant={'brand'}
                                      onClick={close}>
                                <WaIcon size={'small'} name={'xmark'} variant={'regular'}/> {'Close'}
                            </WaButton>
                        </div>
                    </div>
                </WaCard>
            }
        </>
    )
}