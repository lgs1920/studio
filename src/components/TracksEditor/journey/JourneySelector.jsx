/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneySelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-28
 * Last modified: 2026-04-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Journey } from '@Core/Journey'
import { WaCard, WaIcon, WaOption, WaSelect } from '@web.awesome.me/webawesome-pro/dist/react'
import classNames                             from 'classnames'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useSnapshot }                        from 'valtio'

/**
 * A memoized React component for selecting or displaying a journey.
 * @param {Object} props - Component props
 * @param {string} [props.label] - Label for the select dropdown
 * @param {string} [props.size='medium'] - Size of the select dropdown
 * @param {Function} [props.onChange] - Handler for selection changes
 * @param {Object[]} [props.journeys] - Optional pre-filtered journey list
 * @param {string} [props.value] - Optional controlled selected journey slug
 * @param {boolean} [props.allowEmptyOption=false] - Whether to display an empty association option
 * @param {string} [props.emptyLabel='No associated journey'] - Empty option label
 * @param {string} [props.hint] - Optional select hint
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {boolean} [props.syncEditorSelection=true] - Whether selection should update the journey editor current journey
 * @param {string} [props.className] - Extra CSS class
 * @param {boolean} [props.single] - Whether to display a single journey title
 * @param {boolean} [props.closeOnOutsidePointerDown=false] - Forces close on outside pointerdown
 * @param {React.Ref} [props.ref] - Forwarded ref
 * @returns {JSX.Element|null} The rendered component or null if no journeys
 */
export const JourneySelector = memo(({
                                         label,
                                         size = 'medium',
                                         onChange,
                                         journeys: providedJourneys = null,
                                         value = undefined,
                                         allowEmptyOption = false,
                                         emptyLabel = 'No associated journey',
                                         hint = undefined,
                                         disabled = false,
                                         syncEditorSelection = true,
                                         className,
                                         single,
                                         closeOnOutsidePointerDown = false,
                                         ref,
                                     }) => {
    // Valtio proxy references following '$' prefix convention
    const $journeyEditor = lgs.stores.main.components.journeyEditor
    const $journeyStore = lgs.stores.journeyEditor.journey
    const _select = useRef(null)

    // Snapshot values for reactivity
    const {list, keys} = useSnapshot($journeyEditor)
    const theJourney = useSnapshot($journeyStore)

    // Memoized sorted journeys
    const journeys = useMemo(() => {
        if (Array.isArray(providedJourneys)) {
            return providedJourneys.filter(Boolean)
        }

        const journeyList = Array.from(list, slug => lgs.getJourneyBySlug(slug)).filter(Boolean)
        return journeyList.length > 1
               ? journeyList.sort((a, b) => b.title.localeCompare(a.title))
               : journeyList
    }, [list, providedJourneys])

    const selectedValue = value ?? theJourney?.slug ?? ''
    const selectedJourney = useMemo(
        () => journeys.find(journey => journey.slug === selectedValue) ?? (selectedValue ? theJourney : null),
        [journeys, selectedValue, theJourney],
    )
    const shouldRenderSelect = allowEmptyOption || journeys.length > 1

    // Handle selection change
    const handleChange = useCallback(event => {
        if (syncEditorSelection && event.target.value) {
            $journeyEditor.theJourney = event.target.value
        }
        if (onChange) {
            onChange(event)
        }
    }, [onChange, $journeyEditor, syncEditorSelection])

    const setSelectRef = useCallback((element) => {
        _select.current = element
        if (typeof ref === 'function') {
            ref(element)
        }
        else if (ref) {
            ref.current = element
        }
    }, [ref])

    useEffect(() => {
        if (!closeOnOutsidePointerDown) {
            return
        }

        const handlePointerDownOutside = (event) => {
            const select = _select.current
            if (!select?.open) {
                return
            }
            if (!event.composedPath().includes(select)) {
                select.hide()
            }
        }

        document.addEventListener('pointerdown', handlePointerDownOutside, true)
        return () => document.removeEventListener('pointerdown', handlePointerDownOutside, true)
    }, [closeOnOutsidePointerDown])

    /**
     * Computes the icon style for a specific track.
     * @param {Object} track - The specific track object to style
     * @param {Object} [journey=theJourney] - The journey object context
     * @return {Object} The style object for the icon
     */
    const getTrackIconStyle = useCallback((journey = theJourney, track = null) => {
        return {
            color: track ? track.color : journey.tracks.values().next().value.color,
        }
    }, [theJourney])

    const renderActivityIcon = useCallback((journey = theJourney) => {
        const activity = Journey.activityProfile(journey?.activity, journey?.activitySettings)

        return (
            <WaIcon
                className="lgs--journey-activity-icon"
                name={activity.icon ?? 'person-hiking'}
                title={activity.label}
                variant="regular"
            />
        )
    }, [theJourney])

    const renderJourneyIcons = useCallback((journey = theJourney) => {
        return (
            <span className="lgs--journey-icons-in-settings">
                <span className="lgs--track-colors-in-settings">
                    {journey.visible ?
                     (Array.from(journey.tracks.values()).slice(0, journey.visible ? 3 : 1).map(track => (
                         <WaIcon key={track.slug}
                             name="hexagon"
                             style={getTrackIconStyle(journey, track)}
                             variant="solid"
                         />
                     ))) : (
                         <WaIcon
                             name="mask"
                             style={getTrackIconStyle(journey)}
                             variant="solid"
                         />)}
                </span>
                {renderActivityIcon(journey)}
            </span>
        )
    }, [getTrackIconStyle, renderActivityIcon, theJourney])

    if (journeys.length === 0 && !allowEmptyOption) {
        return null
    }

    return (
        <>
            {shouldRenderSelect && (
                <WaSelect
                    label={label}
                    size={size}
                    onChange={handleChange}
                    key={keys.journey.list}
                    className={classNames('journey-selector', className, {masked: selectedJourney?.visible === false})}
                    ref={setSelectRef}
                    value={selectedValue}
                    disabled={disabled}
                >
                    <div slot="start">
                        {selectedJourney
                         ? renderJourneyIcons(selectedJourney)
                         : allowEmptyOption && <WaIcon name="link-slash" variant="regular"/>}
                    </div>
                    {allowEmptyOption && (
                        <WaOption value="">
                            <WaIcon slot="start" name="link-slash" variant="regular"/>
                            <div>{emptyLabel}</div>
                        </WaOption>
                    )}
                    {journeys.map(journey => (
                        <WaOption
                            key={journey.slug}
                            value={journey.slug}
                            className={classNames('journey-title', {masked: !journey.visible})}
                        >
                            <div slot="start">
                                {renderJourneyIcons(journey)}
                            </div>
                            <div>{journey.title}</div>
                        </WaOption>
                    ))}
                    {hint && <span slot="hint">{hint}</span>}
                </WaSelect>
            )}

            {journeys.length === 1 && !allowEmptyOption && single && (
                <WaCard className="journey-title" appearance="plain">
                    <span>
                        {renderJourneyIcons(journeys[0])} {journeys[0].title}
                    </span>
                </WaCard>
            )}
        </>
    )
})
