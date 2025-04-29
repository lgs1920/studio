/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-04-29
 * Last modified: 2025-04-29
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { ToggleStateIcon } from '@Components/ToggleStateIcon'
import { JUST_SAVE }       from '@Core/constants'
import {
    faRectangleList,
}                          from '@fortawesome/pro-regular-svg-icons'
import {
    faCircleDot, faPaintbrushPencil,
}                          from '@fortawesome/pro-solid-svg-icons'
import {
    SlIcon, SlInput, SlTab, SlTabGroup, SlTabPanel, SlTextarea, SlTooltip,
}                          from '@shoelace-style/shoelace/dist/react'

import { TrackUtils }         from '@Utils/cesium/TrackUtils'
import { FA2SL }              from '@Utils/FA2SL'
import parse                  from 'html-react-parser'
import { useSnapshot }        from 'valtio'
import { Utils }              from '../Utils'
import { TrackData }          from './TrackData'
import { TrackFlagsSettings } from './TrackFlagsSettings'
import { TrackPoints }        from './TrackPoints'
import { TrackStyleSettings } from './TrackStyleSettings'


export const TrackSettings = function TrackSettings() {

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

    return (<>
            {journeyEditor.track && journeyEditor.journey.tracks.size > 1 && <>
                <div className={'settings-panel'} id={'editor-track-settings-panel'}
                     key={lgs.mainProxy.components.journeyEditor.keys.journey.track}>
                    {journeyEditor.track.visible && <SlTabGroup id={'track-menu-panel'} className={'menu-panel'}>
                        <SlTab slot="nav"
                               panel="data" id="tab-tracks-data"
                               active={journeyEditor.tabs.track.data}>
                            <SlIcon library="fa" name={FA2SL.set(faRectangleList)}/>Data
                        </SlTab>
                        <SlTab slot="nav"
                               panel="edit"
                               active={journeyEditor.tabs.track.edit}>
                            <SlIcon library="fa" name={FA2SL.set(faPaintbrushPencil)}/>Edit
                        </SlTab>
                        <SlTab slot="nav"
                               panel="points"
                               active={journeyEditor.tabs.track.points}>
                            <SlIcon library="fa" name={FA2SL.set(faCircleDot)}/>Points
                        </SlTab>


                        {/**
                         * Data Tab Panel
                         */}
                        <SlTabPanel name="data"><TrackData/></SlTabPanel>

                        {/**
                         * Edit Tab Panel
                         */}
                        <SlTabPanel name="edit">
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
                        </SlTabPanel>

                        {/**
                         * Points Tab Panel
                         */}
                        <SlTabPanel name="points">
                            <TrackPoints/>
                        </SlTabPanel>

                    </SlTabGroup>}

                    <div id="track-visibility" className={'editor-vertical-menu'}>
                        {$journeyEditor.journey.tracks.size > 1 &&
                            <SlTooltip hoist content={textVisibilityTrack}>
                                <ToggleStateIcon onChange={setTrackVisibility} initial={journeyEditor.track.visible}/>
                        </SlTooltip>}
                        {journeyEditor.track.visible &&
                        <TrackFlagsSettings tooltip="left"/>
                        }
                    </div>
                </div>
            </>}
        </>

    )
}