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
import classNames                               from 'classnames'
import { useEffect, useRef }                    from 'react'
import { useSnapshot }                          from 'valtio/index'

export const JourneyToolbar = (props) => {

    const journeyTrigger = useRef(null)
    const mainUI = lgs.mainProxy.components.mainUI
    const snap = useSnapshot(lgs.mainProxy)
    const settings = useSnapshot(lgs.settings.ui.menu)
    const fileLoader = props?.fileloader ?? true
    const editor = props?.editor ?? true
    const profile = props?.profile ?? true
    const distance = __.tools.rem2px(__.ui.css.getCSSVariable('lgs-gutter-s'))
    const tooltip = props?.tooltip ?? 'top-left'

    let timer

    const hideToolbar = () => {
        mainUI.journeyMenu.active = false
        mainUI.removeJourneyDialog.active = false
        clearTimeout(timer)
    }
    const showToolbar = () => {
        mainUI.journeyMenu.active = true
        clearTimeout(timer)
    }
    const delayHideToolbar = () => {
        timer = setTimeout(hideToolbar, 1 * SECOND)
    }

    const newJourneySelection = async (event) => {
        clearTimeout(timer)
        await Utils.updateJourneyEditor(event.target.value)
    }

    useEffect(() => {
        mainUI.removeJourneyDialog.active = false
        return () => {
            mainUI.removeJourneyDialog.active = false
        }
    }, [])

    // Add the journey Dialog, only if there is none
    const addAJourney = () => {
        lgs.mainProxy.components.mainUI.journeyLoader.visible = !lgs.mainProxy.theJourney
        if (mainUI.journeyMenu.active) {
            hideToolbar()
        }
        else {
            showToolbar()
        }
    }

    return (
        <div className="journey-toolbar" placement={props?.placement ?? 'left'}>
            <div className="journey-toolbar-trigger" ref={journeyTrigger}>
                <SlTooltip hoist placement={settings.toolBar.fromStart ? 'right' : 'left'}
                           content={snap.theJourney ? 'Journey actions' : 'Add a journey'}>
                    <SlButton size={'small'} className={'square-icon'} onClick={addAJourney}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faRoute)}/>
                    </SlButton>
                </SlTooltip>
            </div>
            {snap.theJourney &&
                <SlPopup anchor={journeyTrigger.current}
                         active={snap.components.mainUI.journeyMenu.active}
                         placement={settings.toolBar.fromStart ? 'right-start' : 'left-start'}
                         distance={distance}
                         onMouseLeave={delayHideToolbar} onMouseEnter={showToolbar}
                         hover-bridge="true">
                    <div className={
                        classNames('journey-toolbar-content',
                                   settings.toolBar.fromStart ? 'lgs-slide-in-from-left' : 'lgs-slide-in-from-right')}>
                        {fileLoader && <JourneyLoaderButton tooltip={tooltip}/>}
                        <JourneySelector onChange={newJourneySelection} single="true" style="card"/>
                        <FocusButton tooltip={tooltip}/>
                        {editor && <TracksEditorButton tooltip={tooltip}/>}
                        {profile && <ProfileButton tooltip={tooltip}/>}
                        <RemoveJourney style={'button'}/>
                    </div>

                </SlPopup>
            }

        </div>
    )
}