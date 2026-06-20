/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneySelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-26
 * Last modified: 2026-05-26
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
import { JourneyGroupColorIcon }                                          from '../groups/JourneyGroupsInfo'
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
                                         size = 'm',
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

    const {rootGroups, childrenByParent, ungroupedJourneys, hasGroups} = useMemo(() => {
        void groupsVersion
        const manager = __.ui?.journeyGroupManager
        if (!manager) {
            return {rootGroups: [], childrenByParent: new Map(), ungroupedJourneys: journeys, hasGroups: false}
        }

        const allGroups = manager.list()
        if (allGroups.length === 0) {
            return {rootGroups: [], childrenByParent: new Map(), ungroupedJourneys: journeys, hasGroups: false}
        }

        const journeyMap = new Map(journeys.map(j => [j.slug, j]))
        const assignedSlugs = new Set()
        const map = new Map()

        for (const group of allGroups) {
            const parentId = group.parentGroup ?? null
            if (!map.has(parentId)) {
                map.set(parentId, [])
            }
            map.get(parentId).push(group)

            group.journeys
                .map(slug => journeyMap.get(slug))
                .filter(Boolean)
                .forEach(journey => assignedSlugs.add(journey.slug))
        }

        for (const children of map.values()) {
            children.sort((a, b) => a.name.localeCompare(b.name))
        }

        const ungrouped = journeys
            .filter(j => !assignedSlugs.has(j.slug))
            .sort(naturalSortJourneys)

        return {
            rootGroups:        map.get(null) ?? [],
            childrenByParent:  map,
            ungroupedJourneys: ungrouped,
            hasGroups:         allGroups.length > 0,
        }
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

    const renderTreeJourneyItem = useCallback((journey, ungrouped = false) => {
        const rj = getReactiveJourney(journey)
        return (
            <WaTreeItem
                key={journey.slug}
                data-slug={journey.slug}
                selected={selectedValue === journey.slug}
                className={classNames('lgs--tree-item-hoverable lgs--journey-tree-leaf', {
                    'lgs--journey-tree-ungrouped': ungrouped,
                    masked:                        !rj.visible,
                })}
            >
                <span className="journey-group-tree-row">
                    <span className="lgs--journey-tree-item-content">
                        <WaIcon name="route" variant="regular"/>
                        {renderJourneyIcons(rj)}
                        <span className="lgs--journey-tree-item-title">{rj.title}</span>
                    </span>
                </span>
            </WaTreeItem>
        )
    }, [getReactiveJourney, renderJourneyIcons, selectedValue])

    const renderTreeGroupItems = useCallback((groups) => groups.map(group => {
        const childGroups = childrenByParent.get(group.id) ?? []
        const groupJourneys = group.journeys
            .map(slug => lgs.getJourneyBySlug(slug))
            .filter(Boolean)
            .sort(naturalSortJourneys)
        const hasItems = childGroups.length > 0 || groupJourneys.length > 0
        if (!hasItems) {
            return null
        }
        return (
            <WaTreeItem
                key={group.id}
                className="lgs--tree-item-hoverable"
                data-empty-group={hasItems ? undefined : ''}
                expanded={expandedGroups[group.id] !== false}
                onWaExpand={event => {
                    event.stopPropagation()
                    if (event.target !== event.currentTarget) {
                        return
                    }
                    handleGroupExpand(group.id)
                }}
                onWaCollapse={event => {
                    event.stopPropagation()
                    if (event.target !== event.currentTarget) {
                        return
                    }
                    handleGroupCollapse(group.id)
                }}
            >
                <span className="journey-group-tree-row">
                    <span className="lgs--journey-tree-group-header">
                        {!hasItems && (
                            <span className="journey-group-tree-empty-folder">
                                <WaIcon name="folder" variant="regular"/>
                            </span>
                        )}
                        <JourneyGroupColorIcon color={group.color}/>
                        <span>{group.name}</span>
                    </span>
                </span>
                <WaIcon slot="expand-icon" name="folder" variant="regular"/>
                <WaIcon slot="collapse-icon" name="folder-open" variant="regular" style={{transform: 'rotate(-90deg)'}}/>
                {renderTreeGroupItems(childGroups)}
                {groupJourneys.map(journey => renderTreeJourneyItem(journey))}
            </WaTreeItem>
        )
    }), [childrenByParent, expandedGroups, handleGroupCollapse, handleGroupExpand, renderTreeJourneyItem])

    if (journeys.length === 0 && !allowEmptyOption) {
        return null
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
                                className="journey-group-tree"
                                selection="leaf"
                                onWaSelectionChange={handleTreeSelection}
                            >
                                {renderTreeGroupItems(rootGroups)}
                                {ungroupedJourneys.map(journey => renderTreeJourneyItem(journey, true))}
                            </WaTree>
                        </div>
                        {/* </LGSScrollbars> */}
                    </LGSPopup>
                </div>
            )}

            {shouldRenderSelect && (!hasGroups || allowEmptyOption) && (
                <WaSelect appearance="filled"
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
                         : allowEmptyOption && <WaIcon name="link-simple-slash" variant="regular"/>}
                    </div>
                    {allowEmptyOption && (
                        <WaOption value="">
                            <WaIcon slot="start" name="link-simple-slash" variant="regular"/>
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
