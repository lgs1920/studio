import { JOURNEY_EDITOR_DRAWER } from '@Core/constants'
import { SlDrawer }              from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { useSnapshot }           from 'valtio'
import { Toolbar }               from '../MainUI/Toolbar'
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
                >
                    <div slot="header-actions">
                        <Toolbar editor={false}
                                 profile={true}
                                 fileLoader={true}
                                 position={'horizontal'}
                                 tooltip={'top'}
                                 mode={'embed'}
                        />
                    </div>
                    {lgs.journeys.size > 0 && <div id={'track-settings-container'}>
                        <JourneySelector onChange={Utils.initJourneyEdition}
                                         label={'Select a Journey:'}
                                         single={true}/>
                        <JourneySettings/>

                        {editorSnapshot.journey.visible && <>
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
