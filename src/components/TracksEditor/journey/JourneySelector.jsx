/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneySelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-05
 * Last modified: 2025-07-05
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { memo, useCallback, useRef, useEffect, useMemo } from 'react'
import { useSnapshot }                                   from 'valtio'
import { SlIcon, SlOption, SlSelect } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                         from '@Utils/FA2SL'
import { faChevronDown }                                 from '@fortawesome/pro-regular-svg-icons'
import { faRoute, faMask, faSquare }                     from '@fortawesome/pro-solid-svg-icons'
import classNames                                        from 'classnames'

// Static icon names to avoid recalculation
const ICON_CHEVRON_DOWN = FA2SL.set(faChevronDown)
const ICON_ROUTE = FA2SL.set(faRoute)
const ICON_MASK = FA2SL.set(faMask)
const ICON_SQUARE = FA2SL.set(faSquare)

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
    const journeySnapshot = useSnapshot(lgs.stores.journeyEditor.journey)
    const trackSnapshot = useSnapshot(lgs.stores.journeyEditor.track)

    // Memoized sorted journeys
    const journeys = useMemo(() => {
        const journeyList = Array.from(list, slug => lgs.getJourneyBySlug(slug)).filter(Boolean)
        return journeyList.length > 1
               ? journeyList.sort((a, b) => b.title.localeCompare(a.title))
               : journeyList
    }, [list])

    // Memoized prefix color function
    const getPrefixColor = useCallback(journey => {
        return journey.tracks.size === 1 ? journey.tracks.values().next().value.color : 'black'
    }, [])

    // Memoized styles for icons
    const selectIconStyle = useMemo(() => ({
        color: journeySnapshot.visible && journeySnapshot.tracks.size === 1 ? trackSnapshot.color : 'black',
    }), [journeySnapshot.visible, journeySnapshot.tracks.size, trackSnapshot.color])

    const singleIconStyle = useMemo(() => ({
        color: journeySnapshot.visible ? trackSnapshot.color : 'var(--lgs-disabled-color)',
    }), [journeySnapshot.visible, trackSnapshot.color])

    // Handle selection change
    const handleChange = useCallback(event => {
        const newSlug = event.target.value
        lgs.stores.main.components.journeyEditor.theJourney = newSlug
        if (onChange) {
            onChange(event)
        }
    }, [onChange])


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
                    value={journeySnapshot.slug || ''}
                    onSlChange={handleChange}
                    key={keys.journey.list}
                    className={classNames('journey-selector', {masked: !journeySnapshot.visible})}
                    ref={ref}
                >
                    <SlIcon
                        library="fa"
                        name={journeySnapshot.visible ? ICON_ROUTE : ICON_MASK}
                        slot="prefix"
                        style={selectIconStyle}
                        disabled={!journeySnapshot.visible}
                    />
                    <SlIcon library="fa" name={ICON_CHEVRON_DOWN} slot="expand-icon"/>
                    {journeys.map(journey => (
                        <SlOption
                            key={journey.slug}
                            value={journey.slug}
                            className={classNames('journey-title', {masked: !journey.visible})}
                        >
                            <SlIcon
                                library="fa"
                                name={journey.visible ? ICON_SQUARE : ICON_MASK}
                                slot="prefix"
                                style={{color: getPrefixColor(journey)}}
                            />
                            {journey.title}
                        </SlOption>
                    ))}
                </SlSelect>
            )}
            {journeys.length === 1 && single && (
                <div
                    className={classNames(
                        'journey-title',
                        {'lgs-one-line-card': isStyledCard, masked: !journeySnapshot.visible},
                    )}
                >
                    <SlIcon
                        className="journey-title-prefix"
                        disabled={!journeySnapshot.visible}
                        library="fa"
                        name={journeySnapshot.visible ? ICON_ROUTE : ICON_MASK}
                        slot="prefix"
                        style={singleIconStyle}
                    />
                    {journeySnapshot.title}
                </div>
            )}
        </>
    )
})