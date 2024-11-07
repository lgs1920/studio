import { DrawerFooter }           from '@Components/DrawerFooter'
import { faCircleInfo }           from '@fortawesome/pro-regular-svg-icons'
import { SlDrawer, SlIconButton } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                  from '@Utils/FA2SL'
import React                      from 'react'
import { useSnapshot }            from 'valtio'
import './style.css'
import { InfoLayerModal }         from './InfoLayerModal'
import { LayersAndTerrains }      from './LayersAndTerrains'

export const Panel = () => {
    const layersPanelStore = lgs.mainProxy.components.layers
    const layersPanel = useSnapshot(layersPanelStore)

    const editor = lgs.editorSettingsProxy

    const togglePanelVisibility = (event) => {
        if (event.target !== 'sl-drawer') {
            event.preventDefault()
            return
        }
        layersPanelStore.visible = !layersPanelStore.visible
    }

    const openInfoModal = () => editor.layer.infoDialog = true

    return (
        <>
            <div className={'drawer-wrapper'}>
                <SlDrawer id="layers-pane"
                          open={layersPanel.visible}
                          onSlAfterHide={togglePanelVisibility}
                          contained
                          className={'lgs-theme'}>
                    <div slot={'label'}>{'Layers and Terrains'}</div>
                    <SlIconButton onClick={openInfoModal} slot={'header-actions'} library="fa"
                                  name={FA2SL.set(faCircleInfo)}/>
                    <LayersAndTerrains/>
                    <DrawerFooter/>
                    <InfoLayerModal/>

                </SlDrawer>

            </div>
        </>

    )
}