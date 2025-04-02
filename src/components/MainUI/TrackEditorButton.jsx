import { faRegularRouteCirclePlus }                         from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import { JOURNEY_EDITOR_DRAWER, REMOVE_JOURNEY_IN_TOOLBAR } from '@Core/constants'
import { faRoute } from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip }                      from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                            from '@Utils/FA2SL'
import { useEffect } from 'react'
import { useSnapshot }                                      from 'valtio'

export const TrackEditorButton = (props) => {

    const mainUI = lgs.mainProxy.components.mainUI
    const snap = useSnapshot(lgs.mainProxy)
    const settings = useSnapshot(lgs.settings.ui.menu)
    const journeyLoaderStore = lgs.mainProxy.components.mainUI.journeyLoader

    const openEditorOrLoader = () => {
        if (lgs.theJourney === null) {
            journeyLoaderStore.visible = true
        }
        else {
            __.ui.drawerManager.toggle(JOURNEY_EDITOR_DRAWER)
        }
    }

    useEffect(() => {
        mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_TOOLBAR)

        return () => {
            mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_TOOLBAR)
        }
    }, [])


    return (
                <SlTooltip hoist placement={settings.toolBar.fromStart ? 'right' : 'left'}
                           content={snap.theJourney ? 'Edit the Journey' : 'Add a journey'}>
                    <SlButton size={'small'} className={'square-button'} onClick={openEditorOrLoader}>
                        <SlIcon slot="prefix" library="fa"
                                name={FA2SL.set(lgs.journeys.size ? faRoute : faRegularRouteCirclePlus)}/>
                    </SlButton>
                </SlTooltip>
    )
}