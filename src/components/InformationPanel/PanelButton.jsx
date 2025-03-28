import { INFO_DRAWER }                 from '@Core/constants'
import { faCircleInfo }                from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                       from '@Utils/FA2SL'
import React                           from 'react'
import './style.css'
import { useSnapshot } from 'valtio'

export const PanelButton = () => {
    const infoPanelStore = lgs.mainProxy.components.informationPanel
    const settings = useSnapshot(lgs.settings.ui.menu)

    return (<>
        <SlTooltip hoist placement={settings.toolBar.fromStart ? 'right' : 'left'} content="Show Information">
            <SlButton className={'square-button'} size="small" id={'open-info-panel'}
                      onClick={() => __.ui.drawerManager.toggle(INFO_DRAWER)}>
                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faCircleInfo)}></SlIcon>
            </SlButton>
        </SlTooltip>

    </>)
}
