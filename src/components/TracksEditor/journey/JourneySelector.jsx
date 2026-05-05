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
import { TrackStylePreview }                  from '../track/TrackStylePreview'

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
    const $editorStore = lgs.theJourneyEditorProxy
    const _select = useRef(null)

    // Snapshot values for reactivity
    const {list, keys} = useSnapshot($journeyEditor)
    const {journey: theJourney} = useSnapshot($editorStore)
    const journeyListVersion = keys.journey.list
    const currentJourney = $editorStore.journey ?? theJourney

    // Memoized sorted journeys
    const journeys = useMemo(() => {
        void journeyListVersion

        if (Array.isArray(providedJourneys)) {
            return providedJourneys.filter(Boolean)
        }

        const journeyList = Array.from(list, slug => lgs.getJourneyBySlug(slug)).filter(Boolean)
        return journeyList.length > 1
               ? journeyList.sort((a, b) => b.title.localeCompare(a.title))
               : journeyList
    }, [list, providedJourneys, journeyListVersion])

    const selectedValue = value ?? theJourney?.slug ?? ''
    const getReactiveJourney = useCallback(
        journey => theJourney?.slug === journey?.slug ? currentJourney : journey,
        [currentJourney, theJourney?.slug],
    )
    const selectedJourney = useMemo(
        () => getReactiveJourney(journeys.find(journey => journey.slug === selectedValue)) ?? (selectedValue ? currentJourney : null),
        [journeys, selectedValue, currentJourney, getReactiveJourney],
    )
    const singleJourney = journeys.length === 1 ? getReactiveJourney(journeys[0]) : null
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

    const renderTrackPreview = useCallback((journey, track) => (
        <TrackStylePreview
            track={track}
            compact
            visible={journey?.visible !== false && track?.visible !== false}
        />
    ), [])

    const renderJourneyIcons = useCallback((journey = theJourney) => {
        const tracks = Array.from(journey.tracks.values())
        if (tracks.length === 1) {
            return (
                <span className="lgs--journey-icons-in-settings">
                    {renderTrackPreview(journey, tracks[0])}
                    {renderActivityIcon(journey)}
                </span>
            )
        }

        return (
            <span className="lgs--journey-icons-in-settings">
                <span className="lgs--track-colors-in-settings">
                    {tracks.slice(0, 3).map(track => (
                        <TrackStylePreview
                            key={track.slug}
                            track={track}
                            compact
                            visible={journey.visible !== false && track.visible !== false}
                        />
                    ))}
                </span>
                {renderActivityIcon(journey)}
            </span>
        )
    }, [renderActivityIcon, renderTrackPreview, theJourney])

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
                    <div slot="start" className="lgs--journey-selector-start">
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
                    {journeys.map(journey => {
                        const reactiveJourney = getReactiveJourney(journey)

                        return (
                            <WaOption
                                key={journey.slug}
                                value={journey.slug}
                                className={classNames('journey-title', {masked: !reactiveJourney.visible})}
                            >
                                <div slot="start" className="lgs--journey-selector-start">
                                    {renderJourneyIcons(reactiveJourney)}
                                </div>
                                <div>{reactiveJourney.title}</div>
                            </WaOption>
                        )
                    })}
                    {hint && <span slot="hint">{hint}</span>}
                </WaSelect>
            )}

            {singleJourney && !allowEmptyOption && single && (
                <WaCard className="journey-title" appearance="plain">
                    <span>
                        {renderJourneyIcons(singleJourney)} {singleJourney.title}
                    </span>
                </WaCard>
            )}
        </>
    )
})
