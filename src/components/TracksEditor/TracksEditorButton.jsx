import { faPencil }                    from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                       from '@Utils/FA2SL'
import './style.css'
import { useSnapshot }                 from 'valtio'
import { JOURNEY_EDITOR_DRAWER }       from '../../core/constants'

export const TracksEditorButton =  (props) => {

    const mainStore = lgs.mainProxy
    const mainSnap = useSnapshot(mainStore)
    
    const toggleTracksEditor = () => {
        lgs.journeyEditorStore.show = !lgs.journeyEditorStore.show
    }

    return (<>
        <SlTooltip hoist placement={props.tooltip} content="Edit Tracks">
            {mainSnap.canViewJourneyData &&
                <SlButton size={'small'} className={'square-icon'} id={'open-theJourney-editor'}
                          onClick={() => __.ui.drawerManager.toggle(JOURNEY_EDITOR_DRAWER)}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faPencil)}></SlIcon>
                </SlButton>}
        </SlTooltip>
    </>)
}
