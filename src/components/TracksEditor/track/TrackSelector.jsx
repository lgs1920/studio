/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackSelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-06
 * Last modified: 2025-07-06
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { faChevronDown, faEye, faEyeSlash } from '@fortawesome/pro-regular-svg-icons'
import { faRoute, faSquare, faMask }             from '@fortawesome/pro-solid-svg-icons'
import { SlIcon, SlOption, SlSelect }            from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                 from '@Utils/FA2SL'
import { useSnapshot }                           from 'valtio'
import { useEffect, useMemo, useCallback, memo } from 'react'

export const TrackSelector = memo(({label, onChange}) => {
    const $journeyEditor = lgs.mainProxy.components.journeyEditor
    const journeyEditorSnapshot = useSnapshot($journeyEditor)
    const $editor = lgs.theJourneyEditorProxy
    const editor = useSnapshot($editor)
    const {tracks} = $editor.journey

    useEffect(() => {
        if (!$editor.track && tracks.size > 0) {
            $editor.track = Array.from(tracks.values())[0]
        }
    }, [$editor, tracks])

    const trackList = useMemo(() => Array.from(tracks.values()), [tracks])
    const memoizedOnChange = useCallback((event) => onChange(event), [onChange])
    const trackIconStyle = useMemo(() => ({color: editor.track?.color}), [editor.track?.color])

    if (tracks.size <= 1 || !editor.track) {
        return null
    }

    const handleRequestClose = (event) => {
        event.preventDefault()
    }

    return (
        <SlSelect
            hoist
            label={label}
            value={editor.track.slug}
            onSlChange={memoizedOnChange}
            key={`track-selector-${journeyEditorSnapshot.keys.track.list}`}
            onSlRequestClose={handleRequestClose}
        >
            <SlIcon
                library="fa"
                name={FA2SL.set(editor.track.visible ? faSquare : faMask)}
                slot="prefix"
                style={trackIconStyle}
            />
            <SlIcon library="fa" name={FA2SL.set(faChevronDown)} slot="expand-icon"/>
            {trackList.map(track => (
                <SlOption key={track.slug} value={track.slug}>
                    <SlIcon
                        library="fa"
                        name={FA2SL.set(track.visible ? faSquare : faMask)}
                        slot="prefix"
                        style={{color: track.color}}
                    />
                    {track.title}
                </SlOption>
            ))}
        </SlSelect>
    )
});