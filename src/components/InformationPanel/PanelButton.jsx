import { INFO_DRAWER }                 from '@Core/constants'
import { faCircleInfo }                from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                       from '@Utils/FA2SL'
import React                           from 'react'
import './style.css'

export const PanelButton = () => {
    const infoPanelStore = lgs.mainProxy.components.informationPanel

    return (<>
        <SlTooltip hoist placement="right" content="Show Information">
            <SlButton className={'square-icon'} size="small" id={'open-info-panel'}
                      onClick={() => __.ui.drawerManager.toggle(INFO_DRAWER)}>
                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faCircleInfo)}></SlIcon>
            </SlButton>
        </SlTooltip>

    </>)
}
