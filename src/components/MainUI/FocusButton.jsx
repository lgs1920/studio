import { UPDATE_JOURNEY_SILENTLY }     from '@Core/constants'
import { Utils }                       from '@Editor/Utils'
import { faCrosshairsSimple }          from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                       from '@Utils/FA2SL.js'
import { useSnapshot }                 from 'valtio'
import { REFRESH_DRAWING }             from '../../core/Journey'


export const FocusButton = (props) => {
    const placement = props.tooltip ?? 'right'
    const editorStore = lgs.theJourneyEditorProxy
    const snap = useSnapshot(editorStore)

    const focusOnJourney = async () => {
        if (!snap.journey.visible) {
            editorStore.journey.visible = visibility
            lgs.theJourney.updateVisibility(visibility)
            await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY)
        }
        lgs.theJourney.focus({resetCamera: true, action: REFRESH_DRAWING})
    }
    return (
        <>
            <SlTooltip hoist placement={placement} content="Focus on current Journey">
                <SlButton size={'small'} className={'square-icon'} id={'focus-on-current-journey'}
                          onClick={focusOnJourney}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faCrosshairsSimple)}/>
                </SlButton>
            </SlTooltip>
        </>
    )
}
