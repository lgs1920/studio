import { faRegularCameraCircleArrowDown } from '@awesome.me/kit-938bf84c0d/icons/kit/custom'
import { SlButton, SlIcon, SlTooltip }    from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                          from '@Utils/FA2SL'
import { useSnapshot }                    from 'valtio'


export const SnapshotButton = (props, ref) => {

    const mainStore = lgs.mainProxy
    const mainSnap = useSnapshot(mainStore)

    const editorStore = lgs.theJourneyEditorProxy
    const editorSnapshot = useSnapshot(editorStore)

    /**
     * Close tracks editor pane
     *
     * @param event
     */
    const closeTracksEditor = (event) => {
        if (isOK(event)) {
            mainStore.components.journeyEditor.show = false
        }
    }

    /**
     * Open tracks editor pane
     *
     * @param event
     */
    const toggleTracksEditor = (event) => {
        mainStore.components.journeyEditor.show = !mainStore.components.journeyEditor.show
    }

    return (<>
        <SlTooltip hoist placement={props.tooltip} content="Snapshot">
            <SlButton size={'small'} className={'square-icon snapshot'}
                      onClick={props.snapshot}>
                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faRegularCameraCircleArrowDown)}></SlIcon>
            </SlButton>
        </SlTooltip>
    </>)
}
