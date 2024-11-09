import { DrawerFooter }           from '@Components/DrawerFooter'
import { faCircleInfo }           from '@fortawesome/pro-regular-svg-icons'
import { SlDrawer, SlIconButton } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                  from '@Utils/FA2SL'
import React                      from 'react'
import { useSnapshot }            from 'valtio'
import './style.css'
import { LAYERS_DRAWER }          from '../../../core/constants'
import { InfoLayerModal }         from './InfoLayerModal'
import { LayersAndTerrains }      from './LayersAndTerrains'

export const Panel = () => {
    const drawers = useSnapshot(lgs.mainProxy.drawers)
    const openInfoModal = () => lgs.editorSettingsProxy.layer.infoDialog = true

    return (
        <>
            <div className={'drawer-wrapper'}>
                <SlDrawer id={LAYERS_DRAWER}
                          open={drawers.open === LAYERS_DRAWER}
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
