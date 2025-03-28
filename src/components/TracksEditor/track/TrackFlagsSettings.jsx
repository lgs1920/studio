/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackFlagsSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-24
 * Last modified: 2025-02-24
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { ToggleStateIcon }                   from '@Components/ToggleStateIcon'
import { JUST_SAVE }                         from '@Core/constants'
import { faLocationPin, faLocationPinSlash } from '@fortawesome/pro-solid-svg-icons'
import { SlTooltip }                         from '@shoelace-style/shoelace/dist/react'
import { TrackUtils }                        from '@Utils/cesium/TrackUtils'
import { useSnapshot }                       from 'valtio'
import { Utils }                             from '../Utils'

export const TrackFlagsSettings = (props) => {

    const editorStore = lgs.theJourneyEditorProxy

    // If we're editing a single track journey, we need
    // to know the track
    if (editorStore.track === null || editorStore.track === undefined) {
        (async () => await TrackUtils.setTheTrack(false))()
    }
    const editorSnapshot = useSnapshot(editorStore)

    /**
     * Change Start flag visibility
     *
     * @param visibility
     *
     */
    const setStartFlagVisibility = async visibility => {
        editorStore.track.flags.start.visible = visibility
        TrackUtils.updateFlagsVisibility(editorStore.journey, editorStore.track, 'start', visibility)
        await Utils.updateTrack(JUST_SAVE)
    }

    /**
     *
     * Change Stop flag visibility
     *
     * @param visibility
     *
     */
    const setStopFlagVisibility = async visibility => {
        editorStore.track.flags.stop.visible = visibility
        TrackUtils.updateFlagsVisibility(editorStore.journey, editorStore.track, 'stop', visibility)
        await Utils.updateTrack(JUST_SAVE)
    }

    const textVisibilityStartFlag = sprintf('%s Flag', editorStore.track?.flags?.start?.visible ? 'Hide' : 'Show')
    const textVisibilityStopFlag = sprintf('%s Flag', editorStore.track?.flags?.stop?.visible ? 'Hide' : 'Show')

    return (
        <>
            <SlTooltip hoist content={textVisibilityStartFlag} placement={props.tooltip}>
                <ToggleStateIcon onChange={setStartFlagVisibility}
                                 id={'start-visibility'}
                                 icons={{
                                     shown: faLocationPin, hidden: faLocationPinSlash,
                                 }}
                                 style={{color: lgs.settings.getJourney.pois.start.color}}
                                 initial={editorSnapshot?.track.flags.start.visible}/>
            </SlTooltip>
            <SlTooltip hoist content={textVisibilityStopFlag} placement={props.tooltip}>
                <ToggleStateIcon onChange={setStopFlagVisibility}
                                 id={'stop-visibility'}
                                 icons={{
                                     shown: faLocationPin, hidden: faLocationPinSlash,
                                 }}
                                 style={{color: lgs.settings.getJourney.pois.stop.color}}
                                 initial={editorSnapshot?.track.flags.stop.visible}/>
            </SlTooltip>
        </>
    )

}