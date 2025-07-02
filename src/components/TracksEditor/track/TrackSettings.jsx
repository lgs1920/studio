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
import { TrackUtils }                     from '@Utils/cesium/TrackUtils'
import parse                              from 'html-react-parser'
import { useSnapshot }                    from 'valtio'
import { Utils }                          from '../Utils'
import { TrackData }                      from './TrackData'
import { TrackFlagsSettings }             from './TrackFlagsSettings'
import { TrackPoints }                    from './TrackPoints'
import { TrackStyleSettings }             from './TrackStyleSettings'

/** @constant {string} DATA_PANEL - Identifier for the data panel tab */
const DATA_PANEL = 'tab-data'
/** @constant {string} EDIT_PANEL - Identifier for the edit panel tab */
const EDIT_PANEL = 'tab-edit'
/** @constant {string} POINTS_PANEL - Identifier for the points panel tab */
const POINTS_PANEL = 'tab-points'
/** @constant {string} POIS_PANEL - Identifier for the POIs panel tab */
const POIS_PANEL = 'tab-pois'

/**
 * A React component for managing track settings, including title, description, visibility, and style.
 * @returns {JSX.Element} The rendered TrackSettings component
 */
export const TrackSettings = () => {
    // Snapshot for reactive state from journey editor store
    const $journeyEditor = lgs.stores.journeyEditor
    const journeyEditor = useSnapshot($journeyEditor)

    /**
     * Updates the track description and saves changes.
     * @async
     * @param {CustomEvent} event - The input event containing the new description
     * @returns {Promise<void>}
     */
    const setDescription = async event => {
        $journeyEditor.track.description = event.target.value
        await Utils.updateTrack(JUST_SAVE)
    }

    /**
     * Updates the track title, ensuring uniqueness among tracks.
     * @async
     * @param {CustomEvent} event - The input event containing the new title
     * @returns {Promise<void>}
     */
    const setTitle = async event => {
        const title = event.target.value
        // Prevent empty titles by restoring the previous value
        if (title === '') {
            const field = document.getElementById('track-title')
            field.value = $journeyEditor.track.title
            return
        }
        // Ensure title is unique among tracks
        const titles = []
        $journeyEditor.journey.tracks.forEach(track => {
            titles.push(track)
        })
        $journeyEditor.track.title = __.app.singleTitle(title, titles)

        await Utils.updateTrack(JUST_SAVE)

        __.ui.profiler.updateTitle()
    }

    /**
     * Toggles track visibility and updates related UI components.
     * @async
     * @param {boolean} visibility - The new visibility state
     * @returns {Promise<void>}
     */
    const setTrackVisibility = async visibility => {
        $journeyEditor.track.visible = visibility
        TrackUtils.updateTrackVisibility($journeyEditor.journey, $journeyEditor.track, visibility)

        // Update visibility of POIs associated with the track
        await __.ui.poiManager.setVisibilityByParent($journeyEditor.track.slug, visibility)

        await Utils.updateTrack(JUST_SAVE)

        // Refresh tracks list and profiler UI
        Utils.renderTracksList()
        __.ui.profiler.updateTrackVisibility()
    }

    /**
     * Checks if a specific tab is active.
     * @param {string} tab - The tab identifier to check
     * @returns {boolean} Whether the tab is active
     */
    const isTabActive = tab => {
        return __.ui.drawerManager.tabActive(tab)
    }

    // Format visibility tooltip text based on track state
    const textVisibilityTrack = sprintf('%s Track', journeyEditor.track.visible ? 'Hide' : 'Show')

    return (
        <>
            {journeyEditor.track && journeyEditor.journey.tracks.size > 1 &&
                <>
                    {(journeyEditor.activeTab === DATA_PANEL || journeyEditor.activeTab === EDIT_PANEL) &&
                        <>
                            <div className="selector-wrapper">
                                {/* Track selector for choosing a track */}
                                <TrackSelector onChange={Utils.initTrackEdition} label={'Select one of the tracks:'}/>
                                <div className="editor-vertical-menu">
                                    <SlTooltip hoist content={textVisibilityTrack}>
                                        <ToggleStateIcon onChange={setTrackVisibility}
                                                         initial={journeyEditor.track.visible}/>
                                    </SlTooltip>
                                </div>
                            </div>

                            <div className={'settings-panel'} id={'editor-track-settings-panel'}
                                 key={lgs.mainProxy.components.journeyEditor.keys.journey.track}>
                                {journeyEditor.track.visible &&
                                    <>
                                        {journeyEditor.activeTab === DATA_PANEL && <TrackData/>}
                                        {journeyEditor.activeTab === EDIT_PANEL &&
                                            <div id={'track-text-description'}>
                                                {journeyEditor.journey.tracks.size > 1 &&
                                                    <>
                                                        {/* Input for track title */}
                                                        <SlTooltip hoist content={'Title'}>
                                                            <SlInput id="track-title" value={journeyEditor.track.title}
                                                                     onSlChange={setTitle}/>
                                                        </SlTooltip>
                                                        {/* Textarea for track description */}
                                                        <SlTooltip hoist content={'Description'}>
                                                            <SlTextarea
                                                                row={2}
                                                                size={'small'}
                                                                id="track-description"
                                                                value={parse(journeyEditor.track.description)}
                                                                onSlChange={setDescription}
                                                                placeholder={'Track description'}
                                                            />
                                                        </SlTooltip>
                                                    </>
                                                }
                                                {/* Track style settings */}
                                                <TrackStyleSettings/>
                                            </div>
                                        }

                                        {journeyEditor.activeTab === POINTS_PANEL && <TrackPoints/>}
                                    </>
                                }
                                <div id="track-visibility" className={'editor-vertical-menu'}>
                                    {journeyEditor.activeTab !== POIS_PANEL && $journeyEditor.journey.tracks.size > 1 && journeyEditor.track.visible &&
                                        <TrackFlagsSettings tooltip="left"/>
                                    }
                                </div>
                            </div>
                        </>
                    }
                </>
            }
        </>
    )
}