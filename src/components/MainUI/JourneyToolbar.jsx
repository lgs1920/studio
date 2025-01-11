import { JourneyLoaderButton }                  from '@Components/FileLoader/JourneyLoaderButton'
import { FocusButton }                          from '@Components/MainUI/FocusButton'
import { ProfileButton }                        from '@Components/Profile/ProfileButton'
import { SECOND }                               from '@Core/constants'
import { JourneySelector }                      from '@Editor/journey/JourneySelector'
import { RemoveJourney }                        from '@Editor/journey/RemoveJourney'
import { TracksEditorButton }                   from '@Editor/TracksEditorButton'
import { Utils }                                from '@Editor/Utils'
import { faRoute }                              from '@fortawesome/pro-solid-svg-icons'
import { SlButton, SlIcon, SlPopup, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                from '@Utils/FA2SL'
import { useRef, useState }                     from 'react'
import { useSnapshot }                          from 'valtio/index'

export const JourneyToolbar = (props) => {

    const journeyTrigger = useRef(null)
    const [active, setActive] = useState(false)
    const snap = useSnapshot(lgs.mainProxy)
    const settings = useSnapshot(lgs.settings.ui.menu)
    const fileLoader = props?.fileloader ?? true
    const editor = props?.editor ?? true
    const profile = props?.profile ?? true
    const distance = __.tools.rem2px(__.ui.css.getCSSVariable('lgs-gutter-s'))
    const tooltip = props?.tooltip ?? 'top-left'

    let timer

    const hideToolbar = () => {
        setActive(false)
        clearTimeout(timer)
    }
    const showToolbar = () => {
        setActive(true)
        clearTimeout(timer)
    }

    const newJourneySelection = async (event) => {
        timer = setTimeout(hideToolbar, 10 * SECOND)
        await Utils.updateJourneyEditor(event.target.value)
    }

    // Add the journey Dialog, only if there is none
    const addAJourney = () => {
        lgs.mainProxy.components.mainUI.journeyLoader.visible = !lgs.mainProxy.theJourney
        if (active) {
            hideToolbar()
        }
        else {
            (
                showToolbar()
            )
        }
    }

    return (
        <div className="journey-toolbar" placement={props?.placement ?? 'left'} ref={journeyTrigger}
             onMouseEnter={showToolbar} onMouseLeave={hideToolbar}>
            <div className="journey-toolbar-trigger">
                <SlTooltip hoist placement={tooltip} content="Add a journey" disabled={snap.theJourney}>
                    <SlButton size={'small'} className={'square-icon'} onClick={addAJourney}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faRoute)}/>
                    </SlButton>
                </SlTooltip>
            </div>
            {snap.theJourney &&
                <SlPopup anchor={journeyTrigger.current}
                         active={active}
                         placement={settings.toolBar.fromStart ? 'right-start' : 'left-start'}
                         distance={distance}
                         hover-bridge="true">
                    <div className="journey-toolbar-content lgs-slide-in-from-left">
                        <FocusButton tooltip={tooltip}/>
                        {editor && <TracksEditorButton tooltip={tooltip}/>}
                        {fileLoader && <JourneyLoaderButton tooltip={tooltip}/>}
                        <JourneySelector onChange={newJourneySelection} single="true" style="card"/>
                        {profile && <ProfileButton tooltip={tooltip}/>}
                        <RemoveJourney style={'button'}/>
                    </div>

                </SlPopup>
            }

        </div>
    )
}