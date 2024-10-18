import { faGear }                      from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { FA2SL }                       from '@Utils/FA2SL'
import { useSnapshot }                 from 'valtio'
//read version


export const PanelButton = (props) => {

    const mainStore = lgs.mainProxy.components.settings
    const mainSnap = useSnapshot(mainStore)

    const toggleSettingsButton = (event) => {
        mainStore.visible = !mainStore.visible
    }

    return (
        <SlTooltip hoist placement={props.tooltip} content="Open Settings Panel">
            {<SlButton size={'small'} className={'square-icon'} id={'open-the-setting-panel'}
                       onClick={toggleSettingsButton}
                       key={mainSnap.key}>
                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faGear)}></SlIcon>
            </SlButton>}
        </SlTooltip>
    )
}
