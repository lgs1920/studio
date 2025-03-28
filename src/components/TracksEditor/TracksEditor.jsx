import { JourneyLoaderButton } from '@Components/FileLoader/JourneyLoaderButton'
import { JOURNEY_EDITOR_DRAWER } from '@Core/constants'
import { SlDrawer }              from '@shoelace-style/shoelace/dist/react'
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

    const editorStore = lgs.theJourneyEditorProxy
    const editorSnapshot = useSnapshot(editorStore)

    const menu = useSnapshot(lgs.editorSettingsProxy.menu)

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
                    {lgs.journeys.size > 0 &&
                        <div id={'track-settings-container'}>
                            <header>
                        <JourneySelector onChange={Utils.initJourneyEdition}
                                         label={'Select a Journey:'}
                                         single={true}/>
                                <JourneyLoaderButton tooltip="left"
                                                     mini="true"
                                                     className="editor-vertical-menu in-header"/>

                            </header>
                        <JourneySettings/>
                            {editorSnapshot.journey.visible &&
                                <>
                            <TrackSelector onChange={Utils.initTrackEdition}
                                           label={'Select one of the tracks:'}/>
                            <TrackSettings/>
                        </>}
                    </div>}
                    <div id="journey-editor-footer" slot={'footer'}></div>
                </SlDrawer>}
        </div>
    )
}
