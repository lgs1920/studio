/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneySelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-09
 * Last modified: 2026-05-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSPopup }                                                       from '@Components/LGSPopup'
import { Journey }                                                        from '@Core/Journey'
import {
    WaCard, WaIcon, WaOption, WaSelect, WaTree, WaTreeItem,
}                                                                         from '@web.awesome.me/webawesome-pro/dist/react'
import classNames                                                         from 'classnames'
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                                    from 'valtio'
import { TrackStylePreview }                                              from '../track/TrackStylePreview'

const GROUPS_EXPANDED_KEY = 'lgs1920-journey-selector-groups-expanded'

const naturalSortJourneys = (a, b) =>
    a.title.localeCompare(b.title, undefined, {numeric: true, sensitivity: 'base'})

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
 * @param {boolean} [props.syncEditorSelection=true] - Whether selection should update the journey editor current
 *     journey
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
    const $journeyEditor = lgs.stores.main.components.journeyEditor
    const $editorStore = lgs.theJourneyEditorProxy
    const _select = useRef(null)
    const _treeTrigger = useRef(null)
    const _treePanel = useRef(null)

    const rawId = useId()
    const anchorId = 'lgs-jst' + rawId.replace(/:/g, '')

    const [treeOpen, setTreeOpen] = useState(false)
    const [triggerWidth, setTriggerWidth] = useState(0)
    const [expandedGroups, setExpandedGroups] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(GROUPS_EXPANDED_KEY) ?? '{}')
        }
        catch {
            return {}
        }
    })

    const {list, keys} = useSnapshot($journeyEditor)
    const {journey: theJourney} = useSnapshot($editorStore)
    const {version: groupsVersion} = useSnapshot(lgs.stores.ui.journeyGroups)
    const journeyListVersion = keys.journey.list
    const currentJourney = $editorStore.journey ?? theJourney

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

    const {groupedSections, ungroupedJourneys, hasGroups} = useMemo(() => {
        void groupsVersion
        const manager = __.ui?.journeyGroupManager
        if (!manager) {
            return {groupedSections: [], ungroupedJourneys: journeys, hasGroups: false}
        }

        const allGroups = manager.list()
        if (allGroups.length === 0) {
            return {groupedSections: [], ungroupedJourneys: journeys, hasGroups: false}
        }

        const journeyMap = new Map(journeys.map(j => [j.slug, j]))
        const assignedSlugs = new Set()

        const sections = allGroups
            .map(group => {
                const groupJourneys = group.journeys
                    .map(slug => journeyMap.get(slug))
                    .filter(Boolean)
                groupJourneys.forEach(j => assignedSlugs.add(j.slug))
                return {group, journeys: groupJourneys}
            })
            .filter(({journeys: gj}) => gj.length > 0)

        const ungrouped = journeys
            .filter(j => !assignedSlugs.has(j.slug))
            .sort(naturalSortJourneys)

        return {groupedSections: sections, ungroupedJourneys: ungrouped, hasGroups: sections.length > 0}
    }, [journeys, groupsVersion])

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

    const handleChange = useCallback(event => {
        if (syncEditorSelection && event.target.value) {
            $journeyEditor.theJourney = event.target.value
        }
        if (onChange) {
            onChange(event)
        }
    }, [onChange, $journeyEditor, syncEditorSelection])

    const handleTreeSelection = useCallback(event => {
        const selectedItem = event.detail.selection[0]
        if (!selectedItem) {
            return
        }
        const slug = selectedItem.dataset.slug
        if (!slug) {
            return
        }
        setTreeOpen(false)
        if (syncEditorSelection) {
            $journeyEditor.theJourney = slug
        }
        if (onChange) {
            onChange({target: {value: slug}})
        }
    }, [onChange, $journeyEditor, syncEditorSelection])

    const handleGroupExpand = useCallback(groupId => {
        setExpandedGroups(prev => {
            const next = {...prev, [groupId]: true}
            localStorage.setItem(GROUPS_EXPANDED_KEY, JSON.stringify(next))
            return next
        })
    }, [])

    const handleGroupCollapse = useCallback(groupId => {
        setExpandedGroups(prev => {
            const next = {...prev, [groupId]: false}
            localStorage.setItem(GROUPS_EXPANDED_KEY, JSON.stringify(next))
            return next
        })
    }, [])

    const handleToggleTree = useCallback(() => {
        if (disabled) {
            return
        }
        if (!treeOpen && _treeTrigger.current) {
            setTriggerWidth(_treeTrigger.current.getBoundingClientRect().width)
        }
        setTreeOpen(o => !o)
    }, [disabled, treeOpen])

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

    // WaTreeItem only has default slot — icons + title go inline together
    const renderTreeJourneyItem = (journey, ungrouped = false) => {
        const rj = getReactiveJourney(journey)
        return (
            <WaTreeItem
                key={journey.slug}
                data-slug={journey.slug}
                className={classNames('lgs--journey-tree-item', {
                    'lgs--journey-tree-ungrouped': ungrouped,
                    masked:                        !rj.visible,
                })}
            >
                <span className="lgs--journey-tree-item-content">
                    {renderJourneyIcons(rj)}
                    <span className="lgs--journey-tree-item-title">{rj.title}</span>
                </span>
            </WaTreeItem>
        )
    }

    return (
        <>
            {shouldRenderSelect && hasGroups && !allowEmptyOption && (
                <div
                    className={classNames('journey-selector journey-selector--tree', className, {masked: selectedJourney?.visible === false})}
                    onClick={e => e.stopPropagation()}>
                    <div
                        ref={_treeTrigger}
                        id={anchorId}
                        className={classNames('journey-selector-trigger', {open: treeOpen, disabled})}
                        onClick={handleToggleTree}
                        role="combobox"
                        aria-expanded={treeOpen}
                        aria-haspopup="tree"
                    >
                        <div className="lgs--journey-selector-start">
                            {selectedJourney
                             ? renderJourneyIcons(selectedJourney)
                             : <WaIcon name="route" variant="regular"/>}
                        </div>
                        <span className="journey-selector-label">
                            {selectedJourney?.title ?? label ?? ''}
                        </span>
                        <WaIcon name="chevron-down" className="journey-selector-chevron" variant="regular"/>
                    </div>

                    <LGSPopup
                        anchor={anchorId}
                        active={treeOpen}
                        onRequestClose={() => setTreeOpen(false)}
                        placement="bottom-start"
                        flip
                        shift
                    >
                        {/* <LGSScrollbars style={{maxHeight: '20rem'}}> */}
                        <div
                            ref={_treePanel}
                            className="journey-selector-tree-panel"
                            style={triggerWidth > 0 ? {minWidth: `${triggerWidth}px`} : undefined}
                        >

                            <WaTree
                                selection="leaf"
                                onWaSelectionChange={handleTreeSelection}
                            >
                                <WaIcon name="folder" variant="regular" slot="expand-icon"/>
                                <WaIcon name="folder-open" variant="regular" slot="collapse-icon"
                                        style={{transform: 'rotate(-90deg)'}}/>
                                {groupedSections.map(({group, journeys: groupJourneys}) => (
                                    <WaTreeItem
                                        key={group.id}
                                        expanded={expandedGroups[group.id] !== false}
                                        onWaExpand={() => handleGroupExpand(group.id)}
                                        onWaCollapse={() => handleGroupCollapse(group.id)}
                                    >
                                        <span className="lgs--journey-tree-group-header">
                                            <WaIcon
                                                name="square"
                                                variant="solid"
                                                className="journey-group-color-icon"
                                                style={{color: group.color}}
                                            />
                                            <span>{group.name}</span>
                                        </span>
                                        {groupJourneys.map(journey => renderTreeJourneyItem(journey))}
                                    </WaTreeItem>
                                ))}
                                {ungroupedJourneys.map(journey => renderTreeJourneyItem(journey, true))}
                            </WaTree>
                        </div>
                        {/* </LGSScrollbars> */}
                    </LGSPopup>
                </div>
            )}

            {shouldRenderSelect && (!hasGroups || allowEmptyOption) && (
                <WaSelect
                    label={label}
                    size={size}
                    onChange={handleChange}
                    key={keys.journey.list}
                    className={classNames('journey-selector', className, {masked: selectedJourney?.visible === false})}
                    ref={setSelectRef}
                    value={selectedValue}
                    disabled={disabled}
                    onClick={e => e.stopPropagation()}
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
                <WaCard className="journey-title" appearance="plain" onClick={e => e.stopPropagation()}>
                    <span>
                        {renderJourneyIcons(singleJourney)} {singleJourney.title}
                    </span>
                </WaCard>
            )}
        </>
    )
})
