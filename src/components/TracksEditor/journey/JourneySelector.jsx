/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneySelector.jsx
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

import { FontAwesomeIcon } from '@Components/FontAwesomeIcon'
import { memo, useCallback, useRef, useEffect, useMemo } from 'react'
import { useSnapshot }     from 'valtio'
import { SlIcon, SlOption, SlSelect } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }           from '@Utils/FA2SL'
import { faChevronDown }   from '@fortawesome/pro-regular-svg-icons'
import { faMask, faSquare } from '@fortawesome/pro-solid-svg-icons'
import classNames          from 'classnames'

// Static icon names to avoid recalculation
const ICON_CHEVRON_DOWN = faChevronDown
const ICON_MULTI = 'multi-tracks.svg'
const ICON_MASK = faMask
const ICON_SQUARE = faSquare

/**
 * A memoized React component for selecting or displaying a journey.
 * @param {Object} props - Component props
 * @param {string} [props.label] - Label for the select dropdown
 * @param {string} [props.size='medium'] - Size of the select dropdown
 * @param {Function} [props.onChange] - Handler for selection changes
 * @param {boolean} [props.single] - Whether to display a single journey title
 * @param {string} [props.style] - Style variant ('card' for card-like display)
 * @returns {JSX.Element|null} The rendered component or null if no journeys
 */
export const JourneySelector = memo(({label, size = 'medium', onChange, single, style, ref}) => {
    // Granular snapshots to minimize re-renders
    const {list, keys} = useSnapshot(lgs.stores.main.components.journeyEditor)
    const theJourney = useSnapshot(lgs.stores.journeyEditor.journey)

    // Snapshot the editor store to be reactive to track changes
    const editorStore = useSnapshot(lgs.theJourneyEditorProxy)

    // Memoized sorted journeys
    const journeys = useMemo(() => {
        const journeyList = Array.from(list, slug => lgs.getJourneyBySlug(slug)).filter(Boolean)
        return journeyList.length > 1
               ? journeyList.sort((a, b) => b.title.localeCompare(a.title))
               : journeyList
    }, [list])

    // Derive track colors for reactivity - use both theJourney.tracks and editorStore.track
    const trackColors = useMemo(() => {
        // For single track, use the editor store to be reactive to color changes
        if (theJourney.tracks.size === 1 && editorStore.track) {
            return editorStore.track.color
        }
        // For multiple tracks, use the journey tracks
        return Array.from(theJourney.tracks.values()).map(track => track.color).join('-')
    }, [theJourney.tracks, editorStore.track?.color])

    // Handle selection change
    const handleChange = useCallback(event => {
        const newSlug = event.target.value
        lgs.stores.main.components.journeyEditor.theJourney = newSlug
        if (onChange) {
            onChange(event)
        }
    }, [onChange])

    /**
     * Determines the icon based on the number of tracks in the journey.
     * @param {Object} [journey] - The journey object
     * @return {string|Object} The icon to use
     */
    const icon = (journey = theJourney) => {
        return journey.tracks.size === 1 ? ICON_SQUARE : ICON_MULTI
    }

    /**
     * Computes the icon style based on journey visibility and track colors.
     * @param {Object} [journey] - The journey object
     * @return {Object} The style object for the icon
     */
    const getIconStyle = useCallback((journey = theJourney) => {
        if (!journey.tracks.size) {
            return {color: 'var(--lgs-disabled-color)'}
        }
        if (journey.tracks.size === 1) {
            // For single track, use the editor store color to be reactive
            const trackColor = (journey === theJourney && editorStore.track)
                               ? editorStore.track.color
                               : journey.tracks.values().next().value?.color
            return {
                color: journey.visible
                       ? trackColor || 'var(--lgs-disabled-color)'
                       : 'var(--lgs-disabled-color)',
            }
        }
        const [[, first], [, second]] = journey.tracks
        return {
            '--fa-primary-color':     first?.color || 'black',
            '--fa-secondary-color':   second?.color || 'black',
            '--fa-primary-opacity':   1,
            '--fa-secondary-opacity': 1,
        }
    }, [theJourney, editorStore.track?.color])

    if (journeys.length === 0) {
        return null
    }

    const isStyledCard = style === 'card'

    return (
        <>
            {journeys.length > 1 && (
                <SlSelect
                    label={label}
                    size={size}
                    value={theJourney.slug || ''}
                    onSlChange={handleChange}
                    key={keys.journey.list}
                    className={classNames('journey-selector', {masked: !theJourney.visible})}
                    ref={ref}
                >
                    <FontAwesomeIcon
                        icon={theJourney.visible ? icon() : ICON_MASK}
                        slot="prefix"
                        style={getIconStyle()}
                    />
                    <SlIcon library="fa" name={FA2SL.set(ICON_CHEVRON_DOWN)} slot="expand-icon"/>
                    {journeys.map(journey => (
                        <SlOption
                            key={journey.slug}
                            value={journey.slug}
                            className={classNames('journey-title', {masked: !journey.visible})}
                        >
                            <FontAwesomeIcon
                                icon={journey.visible ? icon(journey) : ICON_MASK}
                                slot="prefix"
                                style={getIconStyle(journey)}
                            />
                            {journey.title}
                        </SlOption>
                    ))}
                </SlSelect>
            )}
            {journeys.length === 1 && single && (
                <div
                    className={classNames(
                        'journey-title', 'lgs-one-line-card',
                        {masked: !theJourney.visible},
                    )}
                >
                    <FontAwesomeIcon
                        className="journey-title-prefix"
                        icon={theJourney.visible ? icon() : ICON_MASK}
                        slot="prefix"
                        style={getIconStyle()}
                    />
                    {theJourney.title}
                </div>
            )}
        </>
    )
})