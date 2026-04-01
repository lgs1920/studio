/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneySelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-01
 * Last modified: 2026-04-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaCard, WaIcon, WaOption, WaSelect } from '@web.awesome.me/webawesome-pro/dist/react'
import classNames                             from 'classnames'
import { memo, useCallback, useMemo, useRef } from 'react'
import { useSnapshot }                        from 'valtio'

/**
 * A memoized React component for selecting or displaying a journey.
 * @param {Object} props - Component props
 * @param {string} [props.label] - Label for the select dropdown
 * @param {string} [props.size='medium'] - Size of the select dropdown
 * @param {Function} [props.onChange] - Handler for selection changes
 * @param {boolean} [props.single] - Whether to display a single journey title
 * @param {string} [props.style] - Style variant ('card' for card-like display)
 * @param {React.Ref} [props.ref] - Forwarded ref
 * @returns {JSX.Element|null} The rendered component or null if no journeys
 */
export const JourneySelector = memo(({label, size = 'medium', onChange, single, style, ref}) => {
    // Valtio proxy references following '$' prefix convention
    const $journeyEditor = lgs.stores.main.components.journeyEditor
    const $journeyStore = lgs.stores.journeyEditor.journey
    const $editorProxy = lgs.theJourneyEditorProxy

    // Snapshot values for reactivity
    const {list, keys} = useSnapshot($journeyEditor)
    const theJourney = useSnapshot($journeyStore)
    const editorStore = useSnapshot($editorProxy)

    // Handle ref naming convention
    const _internalRef = useRef(null)

    // Memoized sorted journeys
    const journeys = useMemo(() => {
        const journeyList = Array.from(list, slug => lgs.getJourneyBySlug(slug)).filter(Boolean)
        return journeyList.length > 1
               ? journeyList.sort((a, b) => b.title.localeCompare(a.title))
               : journeyList
    }, [list])

    // Handle selection change
    const handleChange = useCallback(event => {
        const newSlug = event.target.value
        $journeyEditor.theJourney = newSlug
        if (onChange) {
            onChange(event)
        }
    }, [onChange, $journeyEditor])

    /**
     * Computes the icon style for a specific track.
     * @param {Object} track - The specific track object to style
     * @param {Object} [journey=theJourney] - The journey object context
     * @return {Object} The style object for the icon
     */
    const getTrackIconStyle = useCallback((journey = theJourney, track = null) => {
        return {color: track ? track.color : journey.tracks.values().next().value.color}
    }, [theJourney, editorStore.track])

    if (journeys.length === 0) {
        return null
    }

    return (
        <>
            {journeys.length > 1 && (
                <WaSelect
                    label={label}
                    size={size}
                    onChange={handleChange}
                    key={keys.journey.list}
                    className={classNames({masked: !theJourney.visible})}
                    ref={ref}
                    value={theJourney.slug}
                >
                    <div slot="start" className="lgs--track-colors-in-settings">
                        {Array.from(lgs.theJourney.tracks.values()).slice(0, 2).map(track => (
                            <WaIcon
                                name={theJourney.visible ? 'square' : 'mask'}
                                style={getTrackIconStyle(lgs.theJourney, track)}
                                variant="solid"
                            />
                        ))}
                    </div>
                    {journeys.map(journey => (
                        <WaOption
                            key={journey.slug}
                            value={journey.slug}
                            className={classNames('journey-title', {masked: !journey.visible})}
                        >
                            <div slot="start" className="lgs--track-colors-in-settings">
                                {journey.visible ?
                                 (Array.from(journey.tracks.values()).slice(0, 2).map(track => (
                                     <WaIcon
                                         name="square"
                                         style={getTrackIconStyle(journey, track)}
                                         variant="solid"
                                     />
                                 ))) : (
                                     <WaIcon
                                         name="mask"
                                         style={getTrackIconStyle(journey)}
                                         variant="solid"
                                     />)}
                            </div>
                            {journey.title}
                        </WaOption>
                    ))}
                </WaSelect>
            )}

            {journeys.length === 1 && single && (
                <WaCard className="journey-title">
                    <span>
                        <WaIcon
                            name={theJourney.visible ? 'square' : 'mask'}
                            style={getTrackIconStyle()}
                        /> {theJourney.title}
                    </span>
                </WaCard>
            )}
        </>
    )
})