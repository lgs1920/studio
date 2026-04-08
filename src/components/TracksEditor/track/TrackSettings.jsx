/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-08
 * Last modified: 2026-04-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ToggleStateIcon }                           from '@Components/ToggleStateIcon'
import { JUST_SAVE }                                 from '@Core/constants'
import { TrackSelector }                             from '@Editor/track/TrackSelector'
import { TrackUtils }                                from '@Utils/cesium/TrackUtils'
import { WaDivider, WaInput, WaTextarea, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import parse                                         from 'html-react-parser'
import { useSnapshot }                               from 'valtio'
import { Utils }                                     from '../Utils'
import { TrackData }                                 from './TrackData'
import { TrackStyleSettings }                        from './TrackStyleSettings'

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
                    <WaDivider/>

                    <div className="selector-wrapper">
                        {/* Track selector for choosing a track */}


                        <TrackSelector onChange={Utils.initTrackEdition} label={'Select one track'}/>
                        <div className="editor-vertical-menu">
                            <WaTooltip placement="bottom"
                                       for="track-visibility-in-settings">{textVisibilityTrack}</WaTooltip>
                            <ToggleStateIcon onChange={setTrackVisibility}
                                             initial={journeyEditor.track.visible}
                                             id="track-visibility-in-settings"
                            />

                        </div>
                    </div>

                    <div key={lgs.stores.main.components.journeyEditor.keys.journey.track}>
                        {journeyEditor.track.visible &&
                            <>
                                {journeyEditor.activeTab === DATA_PANEL && <TrackData/>}
                                {journeyEditor.activeTab === EDIT_PANEL &&
                                    <div id={'track-text-description'}>
                                        {journeyEditor.journey.tracks.size > 1 &&
                                            <>
                                                <WaInput
                                                    label={'Track Title'}
                                                    id="track-title"
                                                    value={journeyEditor.track.title}
                                                    onChange={setTitle}
                                                />
                                                <WaTextarea
                                                    label={'Track Description'}
                                                    row={2}
                                                    size={'small'}
                                                    id="track-description"
                                                    value={parse(journeyEditor.track.description)}
                                                    onChange={setDescription}
                                                    placeholder={'Track description'}
                                                />

                                            </>
                                        }
                                        <TrackStyleSettings/>
                                    </div>
                                }
                            </>
                        }
                        <div id="track-visibility" className={'editor-vertical-menu'}>
                        </div>
                    </div>
                </>
            }
        </>
    )
}