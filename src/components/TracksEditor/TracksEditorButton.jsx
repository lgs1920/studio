import { JOURNEY_EDITOR_DRAWER }       from '@Core/constants'
import { faPencil }                    from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                       from '@Utils/FA2SL'
import './style.css'
import { useSnapshot }                 from 'valtio'

export const TracksEditorButton =  (props) => {

    const mainStore = lgs.mainProxy
    const mainSnap = useSnapshot(mainStore)

    return (<>
        <SlTooltip hoist placement={props.tooltip} content="Edit the current Journey">
            {mainSnap.canViewJourneyData &&
                <SlButton size={'small'} className={'square-button'} id={'open-theJourney-editor'}
                          onClick={() => __.ui.drawerManager.toggle(JOURNEY_EDITOR_DRAWER)}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faPencil)}></SlIcon>
                </SlButton>}
        </SlTooltip>
    </>)
}
