/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-02
 * Last modified: 2025-07-02
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { ToggleStateIcon }                from '@Components/ToggleStateIcon'
import { JUST_SAVE }                      from '@Core/constants'
import { TrackSelector }                  from '@Editor/track/TrackSelector'
import { SlInput, SlTextarea, SlTooltip } from '@shoelace-style/shoelace/dist/react'

import { TrackUtils }         from '@Utils/cesium/TrackUtils'
import parse                  from 'html-react-parser'
import { memo }                           from 'react'
import { useSnapshot }        from 'valtio'
import { Utils }              from '../Utils'
import { TrackData }          from './TrackData'
import { TrackFlagsSettings } from './TrackFlagsSettings'
import { TrackPoints }        from './TrackPoints'
import { TrackStyleSettings } from './TrackStyleSettings'


export const TrackSettings = () => {

    const $journeyEditor = lgs.stores.journeyEditor
    const journeyEditor = useSnapshot($journeyEditor)

    /**
     * Change the track description
     *
     * @param {CustomEvent} event
     *
     */
    const setDescription = (async event => {
        $journeyEditor.track.description = event.target.value
        await Utils.updateTrack(JUST_SAVE)
    })

    /**
     * Change Track Title
     *
     * @param {CustomEvent} event
     */
    const setTitle = (async event => {
        const title = event.target.value
        // Title is empty, we force the former value
        if (title === '') {
            const field = document.getElementById('track-title')
            field.value = $journeyEditor.track.title
            return
        }
        // Let's check if the next title has not been already used for another track.
        const titles = []
        $journeyEditor.journey.tracks.forEach(track => {
            titles.push(track)
        })
        $journeyEditor.track.title = __.app.singleTitle(title, titles)

        await Utils.updateTrack(JUST_SAVE)

        __.ui.profiler.updateTitle()

    })

    /**
     * Change track visibility
     *
     * @param {CustomEvent} event
     */
    const setTrackVisibility = async visibility => {
        $journeyEditor.track.visible = visibility
        TrackUtils.updateTrackVisibility($journeyEditor.journey, $journeyEditor.track, visibility)

        await __.ui.poiManager.setVisibilityByParent($journeyEditor.track.slug, visibility)

        await Utils.updateTrack(JUST_SAVE)

        Utils.renderTracksList()
        __.ui.profiler.updateTrackVisibility()
    }

    const textVisibilityTrack = sprintf('%s Track', journeyEditor.track.visible ? 'Hide' : 'Show')
    const isTabActive = (tab) => {
        return __.ui.drawerManager.tabActive(tab)
    }

    const DATA_PANEL = 'tab-data'
    const EDIT_PANEL = 'tab-edit'
    const POINTS_PANEL = 'tab-points'

    return (<>
            {journeyEditor.track && journeyEditor.journey.tracks.size > 1 &&
                <>
                    {(journeyEditor.tab === DATA_PANEL || journeyEditor.tab === EDIT_PANEL) &&
                        <div className="selector-wrapper">
                            <TrackSelector onChange={Utils.initTrackEdition} label={'Select one of the tracks:'}/>
                            <div className="editor-vertical-menu"/>
                        </div>
                    }
                <div className={'settings-panel'} id={'editor-track-settings-panel'}
                     key={lgs.mainProxy.components.journeyEditor.keys.journey.track}>
                    {journeyEditor.track.visible &&
                        <>
                            {journeyEditor.tab === DATA_PANEL && <TrackData/>}
                            {journeyEditor.tab === EDIT_PANEL &&
                                <div id={'track-text-description'}>
                                    {journeyEditor.journey.tracks.size > 1 && <>
                                        {/* Change visible name (title) */}
                                        <SlTooltip hoist content={'Title'}>
                                            <SlInput id="track-title"
                                                     value={journeyEditor.track.title}
                                                     onSlChange={setTitle}
                                            />
                                        </SlTooltip>
                                        {/* Change description */}
                                        <SlTooltip hoist content={'Description'}>
                                            <SlTextarea row={2}
                                                        size={'small'}
                                                        id="track-description"
                                                        value={parse(journeyEditor.track.description)}
                                                        onSlChange={setDescription}
                                                        placeholder={'Track description'}
                                            />
                                        </SlTooltip>

                                    </>}
                                    {/* Track style */}
                                    <TrackStyleSettings/>
                                </div>
                            }

                            {journeyEditor.tab === POINTS_PANEL && <TrackPoints/>}


                            <div id="track-visibility" className={'editor-vertical-menu'}>
                                {$journeyEditor.journey.tracks.size > 1 &&
                                    <SlTooltip hoist content={textVisibilityTrack}>
                                        <ToggleStateIcon onChange={setTrackVisibility}
                                                         initial={journeyEditor.track.visible}/>
                                    </SlTooltip>}
                                {journeyEditor.track.visible &&
                                    <TrackFlagsSettings tooltip="left"/>
                                }
                            </div>
                        </>
                    }
                </div>
                </>
            }
        </>
    )
}