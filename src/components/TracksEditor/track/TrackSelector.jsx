/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackSelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-06
 * Last modified: 2026-04-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { faChevronDown, faEye, faEyeSlash } from '@fortawesome/pro-regular-svg-icons'
import { faRoute, faSquare, faMask }             from '@fortawesome/pro-solid-svg-icons'
import { SlIcon, SlOption, SlSelect }            from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                      from '@Utils/FA2SL'
import { WaIcon, WaOption, WaSelect } from '@web.awesome.me/webawesome-pro/dist/react'
import { useSnapshot }                from 'valtio'
import { useEffect, useMemo, useCallback, memo } from 'react'

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
    const trackIconStyle = useMemo(() => ({color: editor.track?.color}), [editor.track?.color])

    if (tracks.size <= 1 || !editor.track) {
        return null
    }

    const handleRequestClose = (event) => {
        event.preventDefault()
    }

    return (
        <WaSelect
            size="small"
            label={label}
            value={editor.track.slug}
            onChange={memoizedOnChange}
            key={`track-selector-${journeyEditor.keys.track.list}`}
            onWaRequestClose={handleRequestClose}
        >
            <div slot="start" className="lgs--track-colors-in-settings">
                <WaIcon
                    name={lgs.theTrack.visible ? 'hexagon' : 'mask'}
                    style={trackIconStyle}
            />
            </div>

            {trackList.map(track => (
                <WaOption key={track.slug} value={track.slug}>
                    <div slot="start" className="lgs--track-colors-in-settings">
                        <WaIcon
                            name={track.visible ? 'hexagon' : 'mask'}
                            style={{color: track.color}}
                    />
                    </div>
                    {track.title}
                </WaOption>
            ))}
        </WaSelect>
    )
});