import { JourneyLoaderButton } from '@Components/FileLoader/JourneyLoaderButton'
import { JOURNEY_EDITOR_DRAWER }         from '@Core/constants'
import { SlDivider, SlDrawer, SlSwitch } from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { useSnapshot }           from 'valtio'
import { JourneySelector }       from './journey/JourneySelector'
import { JourneySettings }       from './journey/JourneySettings'
import { TrackSelector }         from './track/TrackSelector'
import { TrackSettings }         from './track/TrackSettings'
import { Utils }                 from './Utils'

export const TracksEditor = (props, ref) => {

    const mainStore = lgs.mainProxy
    const mainSnap = useSnapshot(mainStore)

    const $editor = lgs.theJourneyEditorProxy
    const editor = useSnapshot($editor)

    const menu = useSnapshot(lgs.editorSettingsProxy.menu)

    const $journeyToolbar = lgs.settings.ui.journeyToolbar
    const journeyToolbar = useSnapshot($journeyToolbar)

    /**
     * Avoid click outside drawer
     */
    const handleRequestClose = (event) => {
        if (event.detail.source === 'overlay') {
            event.preventDefault()
        }
        else {
            __.ui.drawerManager.close()
        }
    }
    /**
     * Close tracks editor pane
     *
     * @param event
     */
    const closeTracksEditor = (event) => {
        if (window.isOK(event)) {
            window.dispatchEvent(new Event('resize'))
            if (__.ui.drawerManager.isCurrent(JOURNEY_EDITOR_DRAWER)) {
                __.ui.drawerManager.close()
            }
        }
    }

    const toggleToolbarVisibility = (event) => {
        $journeyToolbar.show = !$journeyToolbar.show
        console.log($journeyToolbar.show)
    }

    return (
        <div className={'drawer-wrapper'}>
            {mainSnap.canViewJourneyData &&
                <SlDrawer id={JOURNEY_EDITOR_DRAWER}
                          open={mainSnap.drawers.open === JOURNEY_EDITOR_DRAWER}
                          onSlRequestClose={handleRequestClose}
                          contained
                          onSlAfterHide={closeTracksEditor}
                          className={'lgs-theme'}
                          placement={menu.drawer}
                          label={'Edit your Journey'}
                >
                    {journeyToolbar.usage &&
                    <div slot="header-actions">
                        <SlSwitch align-right size="x-small" checked={journeyToolbar.show}
                                  onSlChange={toggleToolbarVisibility}>{'Toolbar'}</SlSwitch>
                    </div>
                    }

                    {lgs.journeys.size > 0 &&
                        <div id={'track-settings-container'}>
                            <div className="selector-wrapper">
                        <JourneySelector onChange={Utils.initJourneyEdition}
                                         single={true}/>
                                <JourneyLoaderButton tooltip="left"
                                                     mini="true"
                                                     className="editor-vertical-menu in-header"/>

                            </div>
                        <JourneySettings/>
                            {editor.journey.visible &&
                                <>
                                    <SlDivider/>
                                    <div className="selector-wrapper">
                            <TrackSelector onChange={Utils.initTrackEdition}
                                           label={'Select one of the tracks:'}/>
                                        <div className="editor-vertical-menu ">&nbsp;</div>
                                    </div>
                            <TrackSettings/>
                                </>
                            }
                    </div>}
                    <div id="journey-editor-footer" slot={'footer'}></div>
                </SlDrawer>}
        </div>
    )
}
