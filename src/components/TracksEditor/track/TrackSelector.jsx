/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackSelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { useEffect, useMemo, useCallback, memo } from 'react'
import { useSnapshot }                            from 'valtio'
import { WaOption, WaSelect }                     from '@web.awesome.me/webawesome-pro/dist/react'
import { TrackStylePreview }                      from './TrackStylePreview'

export const TrackSelector = memo(({label, onChange}) => {
    const $journeyEditor = lgs.stores.main.components.journeyEditor
    const journeyEditor = useSnapshot($journeyEditor)
    const $editor = lgs.stores.journeyEditor
    const editor = useSnapshot($editor)
    const {tracks} = lgs.theJourney
    useEffect(() => {
        if (!$editor.track && tracks.size > 0) {
            $editor.track = Array.from(tracks.values())[0]
        }
    }, [$editor, tracks])

    const trackList = useMemo(() => Array.from(tracks.values()), [tracks])
    const memoizedOnChange = useCallback((event) => onChange(event), [onChange])

    if (tracks.size <= 1 || !editor.track) {
        return null
    }

    const handleRequestClose = (event) => {
        event.preventDefault()
    }

    return (
        <WaSelect
            size="s"
            label={label}
            value={editor.track.slug}
            onChange={memoizedOnChange}
            key={`track-selector-${journeyEditor.keys.track.list}`}
            onWaRequestClose={handleRequestClose}
        >
            <div slot="start" className="lgs--track-colors-in-settings">
                <TrackStylePreview track={editor.track} compact/>
            </div>

            {trackList.map(track => (
                <WaOption key={track.slug} value={track.slug}>
                    <div slot="start" className="lgs--track-colors-in-settings">
                        <TrackStylePreview track={track} compact/>
                    </div>
                    {track.title}
                </WaOption>
            ))}
        </WaSelect>
    )
});
