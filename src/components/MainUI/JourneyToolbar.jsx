import { faRegularRouteCirclePlus }             from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import { JourneyLoaderButton }                                      from '@Components/FileLoader/JourneyLoaderButton'
import { JOURNEY_EDITOR_DRAWER, REMOVE_JOURNEY_IN_TOOLBAR, SECOND } from '@Core/constants'
import { JourneySelector }                                          from '@Editor/journey/JourneySelector'
import { TracksEditorButton }                   from '@Editor/TracksEditorButton'
import { Utils }                                from '@Editor/Utils'
import { faRoute }                              from '@fortawesome/pro-solid-svg-icons'
import { SlButton, SlIcon, SlPopup, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                from '@Utils/FA2SL'
import classNames                                                   from 'classnames'
import { useEffect, useRef, useState }                              from 'react'
import { useSnapshot }                                              from 'valtio'

export const JourneyToolbar = (props) => {

    const journeyTrigger = useRef(null)
    const mainUI = lgs.mainProxy.components.mainUI
    const snapUI = useSnapshot(mainUI)
    const snap = useSnapshot(lgs.mainProxy)
    const settings = useSnapshot(lgs.settings.ui.menu)
    const fileLoader = props?.fileloader ?? true
    const editor = props?.editor ?? true
    const distance = __.tools.rem2px(__.ui.css.getCSSVariable('lgs-gutter-s'))
    const tooltip = props?.tooltip ?? 'top-left'
    const editorStore = useSnapshot(lgs.theJourneyEditorProxy)
    const journeyLoaderStore = lgs.mainProxy.components.mainUI.journeyLoader

    let timer

    const hideToolbar = () => {
        mainUI.journeyMenu.active = false
        mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_TOOLBAR, false)
        clearTimeout(timer)
    }
    const showToolbar = () => {
        if (!__.ui.drawerManager.isCurrent(JOURNEY_EDITOR_DRAWER)) {
            mainUI.journeyMenu.active = true
            clearTimeout(timer)
        }
    }
    const delayHideToolbar = () => {
        timer = setTimeout(hideToolbar, 1 * SECOND)
    }

    const delayShowToolbar = () => {
        timer = setTimeout(showToolbar, 1 * SECOND)
    }

    const newJourneySelection = async (event) => {
        clearTimeout(timer)
        await Utils.updateJourneyEditor(event.target.value, {})
    }

    const openEditorOrLoader = () => {
        if (lgs.theJourney === null) {
            journeyLoaderStore.visible = true
        }
        else {
            __.ui.drawerManager.toggle(JOURNEY_EDITOR_DRAWER)
            hideToolbar()
        }

    }

    useEffect(() => {
        mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_TOOLBAR)

        return () => {
            mainUI.removeJourneyDialog.active.set(REMOVE_JOURNEY_IN_TOOLBAR)
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
                    <SlButton size={'small'} className={'square-button'}
                              onMouseEnter={delayShowToolbar}
                              onMouseLeave={delayHideToolbar}
                              onClick={openEditorOrLoader}
                    >
                        <SlIcon slot="prefix" library="fa"
                                name={FA2SL.set(lgs.journeys.size ? faRoute : faRegularRouteCirclePlus)}/>
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
                        <JourneySelector onChange={newJourneySelection} single="true" style="card"/>
                        {fileLoader && <JourneyLoaderButton tooltip={tooltip}/>}
                    </div>

                </SlPopup>
            }

        </div>
    )
}