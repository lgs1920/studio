import { LAYERS_DRAWER }               from '@Core/constants'
import { faLayerGroup }                from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { FA2SL }                       from '@Utils/FA2SL'
import { useSnapshot }                 from 'valtio'
//read version


export const PanelButton = (props) => {

    const mainStore = lgs.mainProxy.components.layers
    const mainSnap = useSnapshot(mainStore)

    return (
        <SlTooltip hoist placement={props.tooltip} content="Select Layers">
            <SlButton size={'small'} className={'square-icon'} id={'open-the-setting-panel'}
                      onClick={() => __.ui.drawerManager.toggle(LAYERS_DRAWER)}
                      key={mainSnap.key}>
                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faLayerGroup)}></SlIcon>
            </SlButton>
        </SlTooltip>
    )
}
