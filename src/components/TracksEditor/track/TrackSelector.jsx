/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackSelector.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-02-20
 * Last modified: 2026-09-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { useEffect, useMemo, useCallback, memo } from 'react'
import { WaOption, WaSelect }                     from '@web.awesome.me/webawesome-pro/dist/react'
import { useProxyValue }                           from '@Utils/ValtioUtils'
import { TrackStylePreview }                      from './TrackStylePreview'

export const TrackSelector = memo(({label, onChange}) => {
    const $journeyEditor = lgs.stores.main.components.journeyEditor
    const $editor = lgs.stores.journeyEditor
    const journeyEditorRevision = useProxyValue($journeyEditor, editor => [
        editor?.keys?.track?.list ?? 0,
        editor?.keys?.track?.settings ?? 0,
    ].join('|'), '')
    const editorRevision = useProxyValue($editor, editor => [
        editor?.track?.slug ?? '',
        editor?.track?.title ?? '',
        editor?.track?.visible !== false,
    ].join('|'), '')
    void editorRevision
    const journeyEditor = $journeyEditor
    const editor = $editor
    const {tracks} = lgs.theJourney
    useEffect(() => {
        if (!$editor.track && tracks.size > 0) {
            $editor.track = Array.from(tracks.values())[0]
        }
    }, [$editor, tracks])

    const trackList = useMemo(() => {
        void journeyEditorRevision
        return Array.from(tracks.values())
    }, [tracks, journeyEditorRevision])
    const memoizedOnChange = useCallback((event) => onChange(event), [onChange])

    if (tracks.size <= 1 || !editor.track) {
        return null
    }

    const handleRequestClose = (event) => {
        event.preventDefault()
    }

    return (
        <WaSelect appearance="filled"
            size="s"
            label={label}
            value={editor.track.slug}
            onChange={memoizedOnChange}
            key={`track-selector-${journeyEditor.keys.track.list}`}
            onWaRequestClose={handleRequestClose}
        >
            <div slot="start" className="lgs--track-colors-in-settings">
                <TrackStylePreview
                    track={editor.track}
                    renderStyle={editor.track.renderStyle}
                    visible={editor.track.visible}
                    compact
                />
            </div>

            {trackList.map(track => (
                <WaOption key={track.slug} value={track.slug}>
                    <div slot="start" className="lgs--track-colors-in-settings">
                        <TrackStylePreview
                            track={track}
                            renderStyle={track.renderStyle}
                            visible={track.visible}
                            compact
                        />
                    </div>
                    {track.title}
                </WaOption>
            ))}
        </WaSelect>
    )
});
