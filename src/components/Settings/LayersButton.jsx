import { faLayerGroup }                from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { FA2SL }                       from '@Utils/FA2SL'
import { useSnapshot }                 from 'valtio'
//read version


export const PanelButton = (props) => {

    const mainStore = lgs.mainProxy.components.layers
    const mainSnap = useSnapshot(mainStore)

    const toggleLayersButton = (event) => {
        mainStore.visible = !mainStore.visible
    }

    return (
        <SlTooltip hoist placement={props.tooltip} content="Select Layers">
            {<SlButton size={'small'} className={'square-icon'} id={'open-the-setting-panel'}
                       onClick={toggleLayersButton}
                       key={mainSnap.key}>
                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faLayerGroup)}></SlIcon>
            </SlButton>}
        </SlTooltip>
    )
}
