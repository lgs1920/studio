import { POIS_EDITOR_DRAWER }          from '@Core/constants'
import { faLocationDot }               from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                       from '@Utils/FA2SL.js'
import { useSnapshot }                 from 'valtio'


export const PanelButton = (props) => {
    const store = lgs.mainProxy.components.pois.editor
    const snap = useSnapshot(store)

    const handleClick = () => {
        store.visible = !store.visible
    }
    return (
        <>
            <SlTooltip hoist placement={props.tooltip} content="Edit POIs">
                <SlButton size={'small'} className={'square-button'} id={'launch-the-pois'}
                          onClick={() => __.ui.drawerManager.toggle(POIS_EDITOR_DRAWER)}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faLocationDot)}></SlIcon>
                </SlButton>
            </SlTooltip>
        </>
    )
}
