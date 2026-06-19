/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyGroupsDrawer.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-03
 * Last modified: 2026-06-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import DrawerFooter              from '@Components/DrawerFooter'
import { LGSPopup }              from '@Components/LGSPopup'
import { LGSScrollbars }         from '@Components/MainUI/LGSScrollbars'
import PanelActions              from '@Components/PanelsActions'
import { PopupAnchor }           from '@Components/PopupAnchor'
import WaDrawer                  from '@Components/WaDrawerNonModal'
import { JOURNEY_GROUPS_DRAWER } from '@Core/constants'
import { UIToast }               from '@Utils/UIToast'
import { Journey }               from '@Core/Journey'
import {
    WaButton, WaCallout, WaCard, WaColorPicker, WaDivider, WaIcon, WaInput, WaOption,
    WaSelect, WaTab, WaTabGroup, WaTabPanel, WaTextarea, WaTooltip, WaTree, WaTreeItem,
}                                from '@web.awesome.me/webawesome-pro/dist/react'
import classNames                from 'classnames'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal }          from 'react-dom'
import Sortable                  from 'sortablejs'
import { useSnapshot }           from 'valtio'
import { JourneyGroupColorIcon } from './JourneyGroupsInfo'
import { TrackStylePreview }     from '@Components/TracksEditor/track/TrackStylePreview'


const emptyGroupForm = () => ({
    name:        '',
    description: '',
    color:       '#ffffff',
    parentGroup: null,
})

const CREATE_GROUP_POPUP_ANCHOR = 'journey-group-create-popup-anchor'
const EDIT_GROUP_POPUP_ANCHOR = 'journey-group-edit-popup-anchor'
const GROUP_COLOR_SWATCHES = [
    '#f2b705',
    '#f97316',
    '#ef4444',
    '#ec4899',
    '#8b5cf6',
    '#3b82f6',
    '#14b8a6',
    '#22c55e',
    '#64748b',
].join(';')

const groupTabId = (groupId, suffix) => `journey-group-${groupId.replace(/[^a-zA-Z0-9_-]/g, '-')}-${suffix}`
const groupPopupAnchorId = groupId => groupTabId(groupId, 'popup-anchor')

const renderJourneyIcons = (journey) => {
    const tracks = Array.from(journey.tracks?.values?.() ?? [])

    if (tracks.length === 0) {
        return <WaIcon name="route" variant="regular"/>
    }

    if (tracks.length === 1) {
        return (
            <span className="lgs--journey-icons-in-settings">
                <TrackStylePreview track={tracks[0]} compact
                                   visible={journey.visible !== false && tracks[0].visible !== false}/>
                <WaIcon className="lgs--journey-activity-icon"
                        name={Journey.activityProfile(journey?.activity, journey?.activitySettings).icon ?? 'person-hiking'}
                        title={Journey.activityProfile(journey?.activity, journey?.activitySettings).label}
                        variant="regular"/>
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
            <WaIcon className="lgs--journey-activity-icon"
                    name={Journey.activityProfile(journey?.activity, journey?.activitySettings).icon ?? 'person-hiking'}
                    title={Journey.activityProfile(journey?.activity, journey?.activitySettings).label}
                    variant="regular"/>
        </span>
    )
}

const JourneySortableRow = ({journey, actionIcon, actionLabel, onAction}) => {
    const handleAction = event => {
        event.stopPropagation()
        onAction?.(journey.slug)
    }

    return (
        <WaCard
            appearance="outlined"
            className="lgs--card-hoverable journey-group-journey-row"
            data-id={journey.slug}
        >
            <span className="journey-group-drag-handle" aria-hidden="true">
                <WaIcon name="grip-dots-vertical" variant="solid"/>
            </span>
            {renderJourneyIcons(journey)}
            <span className="journey-group-journey-title">
                {journey.title}
            </span>
            {onAction && (
                <WaButton
                    size="s"
                    variant="brand"
                    appearance="plain"
                    onClick={handleAction}
                    aria-label={actionLabel}
                >
                    <WaIcon name={actionIcon} variant="regular"/>
                </WaButton>
            )}
        </WaCard>
    )
}

const renderJourneyGroupTreeItems = (
    groups,
    childrenByParent,
    selectedGroupId,
    onSelect,
    onEditGroup     = null,
    onRemoveGroup   = null,
    onUnlinkJourney = null,
    showJourneys    = true,
) => groups.map(group => {
    const childGroups = childrenByParent.get(group.id) ?? []
    const journeys = showJourneys
                     ? group.journeys
                         .map(slug => lgs.getJourneyBySlug(slug))
                         .filter(Boolean)
                         .sort((a, b) => a.title.localeCompare(b.title))
                     : []
    const hasItems = childGroups.length > 0 || journeys.length > 0
    const popupAnchorId = groupPopupAnchorId(group.id)

    return (
        <WaTreeItem
            key={group.id}
            className="lgs--tree-item-hoverable"
            data-empty-group={hasItems ? undefined : ''}
            selected={selectedGroupId === group.id}
            onClick={event => {
                event.stopPropagation()
                onSelect?.(group.id)
            }}
        >
            <div
                className="journey-group-tree-row"
                onClick={event => {
                    event.preventDefault()
                    event.stopPropagation()
                    onSelect?.(group.id)
                    if (!hasItems) {
                        onEditGroup?.(group.id, popupAnchorId)
                    }
                }}
            >
                <span className="lgs--journey-tree-group-header">
                    {!hasItems && (
                        <span className="journey-group-tree-empty-folder">
                            <WaIcon name="folder" variant="regular"/>
                        </span>
                    )}
                    <JourneyGroupColorIcon color={group.color}/>
                    <span>{group.name}</span>
                </span>
                {onRemoveGroup && !hasItems && (
                    <WaButton
                        size="s"
                        variant="brand"
                        appearance="plain"
                        className="journey-group-tree-action"
                        aria-label={`Remove ${group.name}`}
                        onClick={event => {
                            event.preventDefault()
                            event.stopPropagation()
                            onRemoveGroup(group.id)
                        }}
                    >
                        <WaIcon name="trash" variant="regular"/>
                    </WaButton>
                )}
                {onEditGroup && (
                    <WaButton
                        size="s"
                        variant="brand"
                        appearance="plain"
                        className="journey-group-tree-action"
                        aria-label={`Edit ${group.name}`}
                        onClick={event => {
                            event.preventDefault()
                            event.stopPropagation()
                            onEditGroup(group.id, popupAnchorId)
                        }}
                    >
                        <WaIcon name="pen-to-square" variant="regular"/>
                    </WaButton>
                )}
                <div className="journey-group-tree-popup-anchor">
                    <PopupAnchor id={popupAnchorId}/>
                </div>
            </div>
            <WaIcon slot="expand-icon" name="folder" variant="regular"/>
            <WaIcon slot="collapse-icon" name="folder-open" style={{transform: 'rotate(-90deg)'}} variant="regular"/>
            {renderJourneyGroupTreeItems(childGroups, childrenByParent, selectedGroupId, onSelect, onEditGroup, onRemoveGroup, onUnlinkJourney, showJourneys)}
            {journeys.map(journey => (
                <WaTreeItem
                    key={journey.slug}
                    className="lgs--tree-item-hoverable lgs--journey-tree-leaf"
                    onClick={event => event.stopPropagation()}
                >
                    <span className="journey-group-tree-row">
                        <span className="lgs--journey-tree-item-content">
                            <WaIcon name="route" variant="regular"/>
                            {renderJourneyIcons(journey)}
                            <span className="lgs--journey-tree-item-title">{journey.title}</span>
                        </span>
                        {onUnlinkJourney && (
                            <WaButton
                                size="s"
                                variant="brand"
                                appearance="plain"
                                className="journey-group-tree-unlink"
                                aria-label={`Remove ${journey.title} from ${group.name}`}
                                onClick={event => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    onUnlinkJourney(group.id, journey.slug)
                                }}
                            >
                                <WaIcon name="link-simple-slash" variant="regular"/>
                            </WaButton>
                        )}
                    </span>
                </WaTreeItem>
            ))}
        </WaTreeItem>
    )
})

const renderUngroupedJourneyTreeItems = (journeys) => journeys.map(journey => (
    <WaTreeItem
        key={journey.slug}
        className="lgs--tree-item-hoverable lgs--journey-tree-leaf lgs--journey-tree-ungrouped"
        onClick={event => event.stopPropagation()}
    >
        <span className="journey-group-tree-row">
            <span className="lgs--journey-tree-item-content">
                <WaIcon name="route" variant="regular"/>
                {renderJourneyIcons(journey)}
                <span className="lgs--journey-tree-item-title">{journey.title}</span>
            </span>
        </span>
    </WaTreeItem>
))

const JourneyGroupEditorPanel = ({
                                     group,
                                     childrenByParent,
                                     groupJourneys,
                                     groupColorSwatches,
                                     selectedEditForm,
                                     updateEditForm,
                                     closeEditPopup,
                                     parentGroupOptions,
                                     availableJourneys,
                                     availablePopupOpen,
                                     availablePopupAnchorId,
                                     closeAvailablePopup,
                                     openAvailablePopup,
                                     addJourneyToGroup,
                                     removeGroup,
                                     removeJourneyFromGroup,
                                     memberListRef,
                                     availableListRef,
                                     onCreateChildGroup,
                                     onEditGroup,
                                     onSelectGroup,
                                     selectedGroupId,
                                 }) => {
    const childGroups = childrenByParent.get(group.id) ?? []
    const detailsPanelId = groupTabId(group.id, 'details')
    const contentPanelId = groupTabId(group.id, 'content')
    const contentIcon = childGroups.length > 1 ? 'folders' : 'folder'
    const addJourneyButtonId = groupTabId(group.id, 'add-journey')
    const addGroupButtonId = groupTabId(group.id, 'add-group')
    const actionsPopupAnchorId = groupTabId(group.id, 'actions-popup-anchor')

    return (
        <section className="journey-group-editor">
            <WaTabGroup className="journey-group-editor-tabs">
                <WaTab panel={contentPanelId}>
                    <WaIcon name={contentIcon} variant="regular"/>
                    {'Content'}
                </WaTab>
                <WaTab panel={detailsPanelId}>
                    <WaIcon name="paintbrush-pencil" variant="regular"/>
                    {'Details'}
                </WaTab>
                <div className="lgs--tabs-right-menu journey-group-tabs-actions" slot="nav">
                    <WaTooltip for={addJourneyButtonId} placement="bottom">{'Add journey'}</WaTooltip>
                    <WaButton
                        id={addJourneyButtonId}
                        appearance="plain"
                        variant="neutral"
                        size="s"
                        aria-label="Add journey"
                        disabled={availableJourneys.length === 0}
                        onClick={() => openAvailablePopup?.(actionsPopupAnchorId)}
                    >
                        <WaIcon name="route" variant="regular"/>
                    </WaButton>
                    <WaTooltip for={addGroupButtonId} placement="bottom">{'Add group'}</WaTooltip>
                    <WaButton
                        id={addGroupButtonId}
                        appearance="plain"
                        variant="neutral"
                        size="s"
                        aria-label="Add group"
                        onClick={() => onCreateChildGroup?.(group.id, actionsPopupAnchorId)}
                    >
                        <WaIcon name="folder" variant="regular"/>
                    </WaButton>
                </div>

                <PopupAnchor id={actionsPopupAnchorId}/>

                <WaTabPanel name={contentPanelId}>
                    <LGSPopup
                        active={availablePopupOpen}
                        anchor={availablePopupAnchorId}
                        onRequestClose={closeAvailablePopup}
                        placement="bottom"
                    >
                        {availableJourneys.length &&
                            <WaCard className="lgs--popup-in-drawer lgs-slide-down" appearance="filled">
                            <WaButton appearance="plain" slot="header-actions" onClick={closeAvailablePopup}>
                                <WaIcon size="s" name="xmark" variant="regular"/>
                            </WaButton>
                                <span slot="header" className="journey-group-create-popup-title">
                                <WaIcon name="route" variant="regular"/>{'Add journeys'}
                                    <WaDivider/>
                            </span>
                            <div ref={availableListRef} className="details-sortable-list">
                                {availableJourneys.map(journey => (
                                    <JourneySortableRow
                                        key={journey.slug}
                                        journey={journey}
                                        actionIcon="link-simple"
                                        actionLabel="Add journey to group"
                                        onAction={slug => addJourneyToGroup(group.id, slug)}
                                    />
                                ))}
                            </div>
                        </WaCard>
                        }
                    </LGSPopup>

                    {childGroups.length > 0 && (
                        <WaCard
                            appearance="plain"
                            className="journey-group-content-tree journey-selector-tree-panel journey-selector-tree-card"
                        >
                            <WaTree selection="leaf" className="journey-group-tree">
                                {renderJourneyGroupTreeItems(childGroups, childrenByParent, selectedGroupId, onSelectGroup, onEditGroup, removeGroup, removeJourneyFromGroup)}
                            </WaTree>
                        </WaCard>
                    )}

                    <div className="journey-group-assignment">
                        <div ref={memberListRef} className="lgs--details-list">
                            {groupJourneys.map(journey => (
                                <JourneySortableRow
                                    key={journey.slug}
                                    journey={journey}
                                    actionIcon="link-simple-slash"
                                    actionLabel="Remove journey from group"
                                    onAction={slug => removeJourneyFromGroup(group.id, slug)}
                                />
                            ))}
                            {groupJourneys.length === 0 && childGroups.length === 0 && (
                                <WaCallout size="s" variant="warning" appearance="outlined">
                                    <WaIcon slot="icon" name="warning" variant="regular"/>
                                    {'This group is empty.'}
                                </WaCallout>
                            )}
                        </div>
                    </div>
                </WaTabPanel>

                <WaTabPanel name={detailsPanelId}>
                    <div className="journey-group-form">
                        <div className="journey-group-create-title-row">
                            <WaInput
                                className="journey-group-create-title-input"
                                required
                                label="Name"
                                size="s"
                                value={selectedEditForm.name}
                                onInput={event => updateEditForm('name', event.target.value)}
                            />
                            <div className="journey-group-color-row">
                                <WaColorPicker
                                    size="s"
                                    swatches={groupColorSwatches}
                                    value={selectedEditForm.color}
                                    onInput={event => updateEditForm('color', event.target.value)}
                                />
                            </div>
                        </div>
                        <WaSelect
                            label="Parent group"
                            size="s"
                            value={selectedEditForm.parentGroup ?? ''}
                            onInput={event => updateEditForm('parentGroup', event.target.value || null)}
                        >
                            <WaOption value="">{'No parent'}</WaOption>
                            {parentGroupOptions.map(groupOption => (
                                <WaOption key={groupOption.id} value={groupOption.id}>
                                    {groupOption.name}
                                </WaOption>
                            ))}
                        </WaSelect>
                        <WaTextarea
                            label="Description"
                            rows={3}
                            value={selectedEditForm.description}
                            onInput={event => updateEditForm('description', event.target.value)}
                        />
                        <div className="journey-group-form-actions journey-group-form-actions-end">
                            <WaButton
                                size="s"
                                variant="brand"
                                appearance="filled"
                                onClick={closeEditPopup}
                            >
                                <WaIcon name="xmark" variant="regular"/>
                                {'Close'}
                            </WaButton>
                        </div>
                    </div>
                </WaTabPanel>
            </WaTabGroup>
        </section>
    )
}

export const JourneyGroupsDrawer = memo(() => {
    const groupStore = useSnapshot(lgs.stores.ui.journeyGroups)
    const {drawers: {open: drawerOpen, entity}} = useSnapshot(lgs.stores.ui)
    const journeyEditor = useSnapshot(lgs.stores.main.components.journeyEditor)
    const {drawer: drawerPlacement} = useSnapshot(lgs.editorSettingsProxy.menu)

    const memberListRef = useRef(null)
    const availableListRef = useRef(null)
    const memberSortableRef = useRef(null)
    const availableSortableRef = useRef(null)

    const [selectedGroupId, setSelectedGroupId] = useState(null)
    const [newForm, setNewForm] = useState(emptyGroupForm)
    const [editForm, setEditForm] = useState({id: null, ...emptyGroupForm()})
    const [createPopupOpen, setCreatePopupOpen] = useState(false)
    const [createPopupAnchorId, setCreatePopupAnchorId] = useState(CREATE_GROUP_POPUP_ANCHOR)
    const [editPopupOpen, setEditPopupOpen] = useState(false)
    const [editPopupAnchorId, setEditPopupAnchorId] = useState(EDIT_GROUP_POPUP_ANCHOR)
    const [availablePopupOpen, setAvailablePopupOpen] = useState(false)
    const [availablePopupAnchorId, setAvailablePopupAnchorId] = useState(CREATE_GROUP_POPUP_ANCHOR)
    const isStacked = __.ui.drawerManager.isStacked(JOURNEY_GROUPS_DRAWER)
    const groupColorSwatches = useMemo(
        () => lgs.settings.getSwatches?.list?.join(';') || GROUP_COLOR_SWATCHES,
        [],
    )

    const groups = useMemo(() => {
        void groupStore.version
        return Object.values(groupStore.list)
            .filter(Boolean)
            .sort((a, b) => a.name.localeCompare(b.name))
    }, [groupStore.list, groupStore.version])

    const groupsByParent = useMemo(() => {
        const map = new Map()

        for (const group of groups) {
            const parentId = group.parentGroup ?? null
            if (!map.has(parentId)) {
                map.set(parentId, [])
            }
            map.get(parentId).push(group)
        }

        for (const children of map.values()) {
            children.sort((a, b) => a.name.localeCompare(b.name))
        }

        return map
    }, [groups])
    const rootGroups = useMemo(() => groupsByParent.get(null) ?? [], [groupsByParent])

    const journeys = useMemo(() => {
        void journeyEditor.keys?.journey?.list
        return Array.from(journeyEditor.list, slug => lgs.getJourneyBySlug(slug))
            .filter(Boolean)
            .sort((a, b) => a.title.localeCompare(b.title))
    }, [journeyEditor.keys?.journey?.list, journeyEditor.list])

    const currentJourneySlug = useMemo(() => {
        if (entity && lgs.getJourneyBySlug(entity)) {
            return entity
        }

        return lgs.theJourney?.slug ?? null
    }, [entity])

    const effectiveSelectedGroupId = useMemo(() => {
        if (selectedGroupId && groups.some(group => group.id === selectedGroupId)) {
            return selectedGroupId
        }

        const relatedGroup = currentJourneySlug
                             ? groups.find(group => group.journeys.includes(currentJourneySlug))
                             : null

        return relatedGroup?.id ?? groups[0]?.id ?? null
    }, [currentJourneySlug, groups, selectedGroupId])

    const selectedGroup = useMemo(
        () => groups.find(group => group.id === effectiveSelectedGroupId) ?? null,
        [effectiveSelectedGroupId, groups],
    )
    const selectedGroupDescendants = useMemo(() => {
        if (!selectedGroup) {
            return new Set()
        }

        return new Set(__.ui.journeyGroupManager?.descendantsOf?.(selectedGroup.id) ?? [])
    }, [selectedGroup])

    const selectedJourneySlugs = useMemo(() => selectedGroup?.journeys ?? [], [selectedGroup])
    const selectedJourneySlugSet = useMemo(() => new Set(selectedJourneySlugs), [selectedJourneySlugs])
    const groupJourneys = useMemo(
        () => selectedJourneySlugs.map(slug => lgs.getJourneyBySlug(slug)).filter(Boolean),
        [selectedJourneySlugs],
    )
    const availableJourneys = useMemo(
        () => journeys.filter(journey => !selectedJourneySlugSet.has(journey.slug)),
        [journeys, selectedJourneySlugSet],
    )
    const assignedJourneySlugSet = useMemo(
        () => new Set(groups.flatMap(group => group.journeys ?? [])),
        [groups],
    )
    const ungroupedJourneys = useMemo(
        () => journeys.filter(journey => !assignedJourneySlugSet.has(journey.slug)),
        [assignedJourneySlugSet, journeys],
    )

    const selectedEditForm = useMemo(() => {
        if (!selectedGroup) {
            return {id: null, ...emptyGroupForm()}
        }

        if (editForm.id === selectedGroup.id) {
            return editForm
        }

        return {
            id:          selectedGroup.id,
            name:        selectedGroup.name,
            description: selectedGroup.description,
            color:       selectedGroup.color,
            parentGroup: selectedGroup.parentGroup ?? null,
        }
    }, [editForm, selectedGroup])

    const parentGroupOptions = useMemo(() => {
        if (!selectedGroup) {
            return groups
        }

        return groups.filter(group => group.id !== selectedGroup.id && !selectedGroupDescendants.has(group.id))
    }, [groups, selectedGroup, selectedGroupDescendants])
    useEffect(() => {
        if (drawerOpen === JOURNEY_GROUPS_DRAWER && !groupStore.ready) {
            void __.ui.journeyGroupManager.initialize()
        }
    }, [drawerOpen, groupStore.ready])

    const closeDrawerWithManager = useCallback(() => {
        window.dispatchEvent(new Event('resize'))
        setSelectedGroupId(null)
        setEditForm({id: null, ...emptyGroupForm()})
        setCreatePopupOpen(false)
        setCreatePopupAnchorId(CREATE_GROUP_POPUP_ANCHOR)
        setEditPopupOpen(false)
        setAvailablePopupOpen(false)
        setAvailablePopupAnchorId(CREATE_GROUP_POPUP_ANCHOR)
        if (__.ui.drawerManager.isCurrent(JOURNEY_GROUPS_DRAWER)) {
            __.ui.drawerManager.close()
        }
    }, [])

    const handleRequestClose = useCallback((event) => {
        if (event.target.tagName !== 'WA-DRAWER') {
            event.preventDefault()
            return
        }
        if (!__.ui.drawerManager.isCurrent(JOURNEY_GROUPS_DRAWER)) {
            return
        }

        closeDrawerWithManager()
    }, [closeDrawerWithManager])

    const updateNewForm = useCallback((key, value) => {
        setNewForm(current => ({...current, [key]: value}))
    }, [])

    const openCreatePopup = useCallback((parentGroup = null, anchorId = CREATE_GROUP_POPUP_ANCHOR) => {
        setNewForm({
                       ...emptyGroupForm(),
                       parentGroup,
                   })
        setAvailablePopupOpen(false)
        setAvailablePopupAnchorId(CREATE_GROUP_POPUP_ANCHOR)
        setCreatePopupAnchorId(anchorId ?? CREATE_GROUP_POPUP_ANCHOR)
        setCreatePopupOpen(true)
    }, [])

    const openAvailablePopup = useCallback((anchorId = CREATE_GROUP_POPUP_ANCHOR) => {
        setCreatePopupOpen(false)
        setCreatePopupAnchorId(CREATE_GROUP_POPUP_ANCHOR)
        setAvailablePopupAnchorId(anchorId ?? CREATE_GROUP_POPUP_ANCHOR)
        setAvailablePopupOpen(true)
    }, [])

    const closeAvailablePopup = useCallback(() => {
        setAvailablePopupOpen(false)
        setAvailablePopupAnchorId(CREATE_GROUP_POPUP_ANCHOR)
    }, [])

    const closeEditPopup = useCallback((event) => {
        event?.preventDefault?.()
        setEditPopupOpen(false)
        setEditPopupAnchorId(EDIT_GROUP_POPUP_ANCHOR)
    }, [])

    const closeCreatePopup = useCallback((event) => {
        event?.preventDefault?.()
        setCreatePopupOpen(false)
        setCreatePopupAnchorId(CREATE_GROUP_POPUP_ANCHOR)
    }, [])

    const updateEditForm = useCallback((key, value) => {
        const swatches = Array.from(lgs.settings.getSwatches.list.values())
        const lastValue = swatches[swatches.length - 1]
        setEditForm(current => ({
            id:          selectedGroup?.id ?? current.id,
            name:        current.id === selectedGroup?.id ? current.name : selectedGroup?.name ?? '',
            description: current.id === selectedGroup?.id ? current.description : selectedGroup?.description ?? '',
            color:       current.id === selectedGroup?.id ? current.color : selectedGroup?.color ?? lastValue,
            parentGroup: current.id === selectedGroup?.id ? current.parentGroup ?? null : selectedGroup?.parentGroup ?? null,
            [key]: value,
        }))
    }, [selectedGroup])

    const selectGroup = useCallback(groupId => {
        const group = groups.find(item => item.id === groupId)
        setSelectedGroupId(groupId)
        if (group) {
            setEditForm({
                            id:          group.id,
                            name:        group.name,
                            description: group.description,
                            color:       group.color,
                            parentGroup: group.parentGroup ?? null,
                        })
        }
    }, [groups])

    const openEditPopup = useCallback((groupId = null, anchorId = null) => {
        if (groupId) {
            selectGroup(groupId)
            setEditPopupAnchorId(anchorId ?? groupPopupAnchorId(groupId))
        }
        else if (anchorId) {
            setEditPopupAnchorId(anchorId)
        }
        setEditPopupOpen(true)
    }, [selectGroup])

    const selectEditablePopupGroup = useCallback(groupId => {
        const group = groups.find(item => item.id === groupId)
        if (!group) {
            return
        }

        const childGroups = groupsByParent.get(group.id) ?? []
        const hasItems = childGroups.length > 0 || (group.journeys?.length ?? 0) > 0

        if (!hasItems) {
            selectGroup(groupId)
        }
    }, [groups, groupsByParent, selectGroup])

    const createGroup = useCallback(async () => {
        const name = newForm.name.trim()
        if (!name) {
            UIToast.warning({caption: 'Journey group', text: 'A group name is required.'})
            return
        }

        const group = await __.ui.journeyGroupManager.create({
                                                                 name,
                                                                 description: newForm.description,
                                                                 color:       newForm.color,
                                                                 parentGroup: newForm.parentGroup,
                                                             })
        setSelectedGroupId(group.id)
        setCreatePopupOpen(false)
        setCreatePopupAnchorId(CREATE_GROUP_POPUP_ANCHOR)
        setEditPopupAnchorId(groupPopupAnchorId(group.id))
        setEditPopupOpen(true)
        setEditForm({
                        id:          group.id,
                        name:        group.name,
                        description: group.description,
                        color:       group.color,
                        parentGroup: group.parentGroup ?? null,
                    })
        setNewForm(emptyGroupForm())
        UIToast.success({caption: group.name, text: 'Group created.'})
    }, [newForm])

    const editFormIsSynced = useMemo(() => {
        if (!selectedGroup || selectedEditForm.id !== selectedGroup.id) {
            return true
        }

        return selectedEditForm.name.trim() === selectedGroup.name
            && selectedEditForm.description === selectedGroup.description
            && selectedEditForm.color === selectedGroup.color
            && (selectedEditForm.parentGroup ?? null) === (selectedGroup.parentGroup ?? null)
    }, [selectedEditForm, selectedGroup])

    useEffect(() => {
        if (!editPopupOpen || !selectedGroup || selectedEditForm.id !== selectedGroup.id || editFormIsSynced) {
            return
        }

        const name = selectedEditForm.name.trim()
        if (!name) {
            return
        }

        const timeoutId = window.setTimeout(() => {
            void __.ui.journeyGroupManager.update(selectedGroup.id, {
                name,
                description: selectedEditForm.description,
                color:       selectedEditForm.color,
                parentGroup: selectedEditForm.parentGroup,
            })
        }, 200)

        return () => window.clearTimeout(timeoutId)
    }, [editFormIsSynced, editPopupOpen, selectedEditForm, selectedGroup])

    const addJourneyToGroup = useCallback(async (groupId, journeySlug) => {
        if (!groupId) {
            return
        }

        await __.ui.journeyGroupManager.addJourneyToGroup(groupId, journeySlug)
    }, [])

    const removeJourneyFromGroup = useCallback(async (groupId, journeySlug) => {
        if (!groupId) {
            return
        }

        await __.ui.journeyGroupManager.removeJourneyFromGroup(groupId, journeySlug)
    }, [])

    const removeGroup = useCallback(async groupId => {
        if (!groupId) {
            return
        }

        const removed = await __.ui.journeyGroupManager.remove(groupId)
        if (!removed) {
            UIToast.warning({caption: 'Journey group', text: 'Only empty groups can be removed.'})
            return
        }

        if (selectedGroupId === groupId || effectiveSelectedGroupId === groupId) {
            setSelectedGroupId(null)
            setEditForm({id: null, ...emptyGroupForm()})
            setEditPopupOpen(false)
            setEditPopupAnchorId(EDIT_GROUP_POPUP_ANCHOR)
        }

        UIToast.success({caption: 'Journey group', text: 'Group removed.'})
    }, [effectiveSelectedGroupId, selectedGroupId])


    const persistMembersOrder = useCallback(async () => {
        if (!selectedGroup || !memberSortableRef.current) {
            return
        }

        await __.ui.journeyGroupManager.reorderGroupJourneys(selectedGroup.id, memberSortableRef.current.toArray())
    }, [selectedGroup])

    useEffect(() => {
        memberSortableRef.current?.destroy()
        availableSortableRef.current?.destroy()
        memberSortableRef.current = null
        availableSortableRef.current = null

        if (!selectedGroup || !memberListRef.current || !availableListRef.current) {
            return undefined
        }

        const sortableGroup = `journey-group-members-${selectedGroup.id}`
        const sharedOptions = {
            animation:   150,
            forceFallback: true,
            dataIdAttr:  'data-id',
            handle:      '.journey-group-drag-handle',
            ghostClass:  'widget-row-ghost',
            chosenClass: 'widget-row-chosen',
            dragClass:   'widget-row-drag',
        }

        memberSortableRef.current = new Sortable(memberListRef.current, {
            ...sharedOptions,
            group:    {name: sortableGroup, pull: true, put: true},
            onAdd:    () => {
                void persistMembersOrder()
            },
            onUpdate: () => {
                void persistMembersOrder()
            },
            onRemove: () => {
                void persistMembersOrder()
            },
        })

        availableSortableRef.current = new Sortable(availableListRef.current, {
            ...sharedOptions,
            group: {name: sortableGroup, pull: 'clone', put: true},
            sort:  false,
            onAdd: event => {
                event.item.remove()
                void persistMembersOrder()
            },
        })

        return () => {
            memberSortableRef.current?.destroy()
            availableSortableRef.current?.destroy()
            memberSortableRef.current = null
            availableSortableRef.current = null
        }
    }, [availableJourneys.length, groupJourneys.length, persistMembersOrder, selectedGroup])

    const drawerRoot = __.ui.drawerManager.drawerRoot
    const content = (
        <>
            {drawerOpen === JOURNEY_GROUPS_DRAWER &&
                <WaDrawer
                    id={JOURNEY_GROUPS_DRAWER}
                    open={true}
                    onWaAfterHide={handleRequestClose}
                    placement={drawerPlacement}
                    className={classNames('journey-groups-drawer', {'drawer-is-stacked': isStacked})}
                >
                    <span slot="label" className="journey-groups-drawer-title">
                        <WaIcon name="folders" variant="regular"/>
                        {'Journey Groups'}
                    </span>
                    <PanelActions stackedPanel={isStacked} onBack={isStacked ? closeDrawerWithManager : null}/>

                    <div className="journey-groups-drawer-content">
                        <PopupAnchor id={EDIT_GROUP_POPUP_ANCHOR}/>
                        <PopupAnchor id={CREATE_GROUP_POPUP_ANCHOR}/>
                        <LGSScrollbars>
                            <div className="journey-groups-layout">
                                <section className="journey-groups-section journey-groups-tree-panel">
                                    <div className="journey-group-create-header">
                                        <WaButton
                                            variant="brand"
                                            appearance="filled"
                                            size="s"
                                            onClick={openCreatePopup}
                                        >
                                            <WaIcon slot="start" name="folder-plus" variant="regular"/>
                                            {'New group'}
                                        </WaButton>
                                    </div>

                                    {rootGroups.length > 0 || ungroupedJourneys.length > 0
                                     ? (
                                         <WaCard
                                             appearance="filled"
                                             className="journey-selector-tree-panel journey-selector-tree-card"
                                         >
                                             <WaTree selection="leaf" className="journey-group-tree">
                                                 {renderJourneyGroupTreeItems(rootGroups, groupsByParent, effectiveSelectedGroupId, selectGroup, openEditPopup, removeGroup, removeJourneyFromGroup)}
                                                 {renderUngroupedJourneyTreeItems(ungroupedJourneys)}
                                             </WaTree>
                                         </WaCard>
                                     )
                                     : (
                                         <WaCallout size="s" variant="warning" appearance="outlined">
                                             <WaIcon slot="icon" name="warning" variant="regular"/>
                                             {'No journey groups yet.'}
                                         </WaCallout>
                                     )}
                                </section>

                                <LGSPopup
                                    active={editPopupOpen && Boolean(selectedGroup)}
                                    anchor={editPopupAnchorId}
                                    onRequestClose={closeEditPopup}
                                    placement="bottom"
                                    distance={lgs.gutter.xs}
                                >
                                    <WaCard
                                        className="lgs--popup-in-drawer lgs-slide-down journey-group-edit-popup"
                                        appearance="filled"
                                    >
                                        <WaButton appearance="plain" slot="header-actions" onClick={closeEditPopup}>
                                            <WaIcon size="s" name="xmark" variant="regular"/>
                                        </WaButton>

                                        <h3 slot="header" className="journey-group-create-popup-title">
                                            <JourneyGroupColorIcon color={selectedGroup?.color ?? '#ffffff'}/>
                                            <WaIcon
                                                name={selectedGroup && (selectedGroup.journeys.length > 1 ? 'folders' : 'folder')}
                                                variant="regular"/>
                                            <span>{selectedGroup?.name ?? 'Group'}</span>
                                        </h3>

                                        {selectedGroup && (
                                            <JourneyGroupEditorPanel
                                                group={selectedGroup}
                                                childrenByParent={groupsByParent}
                                                groupJourneys={groupJourneys}
                                                groupColorSwatches={groupColorSwatches}
                                                selectedEditForm={selectedEditForm}
                                                updateEditForm={updateEditForm}
                                                closeEditPopup={closeEditPopup}
                                                parentGroupOptions={parentGroupOptions}
                                                availableJourneys={availableJourneys}
                                                availablePopupOpen={availablePopupOpen}
                                                availablePopupAnchorId={availablePopupAnchorId}
                                                closeAvailablePopup={closeAvailablePopup}
                                                openAvailablePopup={openAvailablePopup}
                                                addJourneyToGroup={addJourneyToGroup}
                                                removeGroup={removeGroup}
                                                removeJourneyFromGroup={removeJourneyFromGroup}
                                                memberListRef={memberListRef}
                                                availableListRef={availableListRef}
                                                onCreateChildGroup={openCreatePopup}
                                                onEditGroup={openEditPopup}
                                                onSelectGroup={selectEditablePopupGroup}
                                                selectedGroupId={effectiveSelectedGroupId}
                                            />
                                        )}
                                    </WaCard>
                                </LGSPopup>

                                <LGSPopup
                                    active={createPopupOpen}
                                    anchor={createPopupAnchorId}
                                    onRequestClose={closeCreatePopup}
                                    placement="bottom"
                                >
                                    <WaCard appearance="filled"
                                        className="lgs--popup-in-drawer lgs-slide-down journey-group-create-popup">
                                        <WaButton appearance="plain" slot="header-actions"
                                                  onClick={closeCreatePopup}>
                                            <WaIcon size="s" name="xmark" variant="regular"/>
                                        </WaButton>

                                        <span slot="header" className="journey-group-create-popup-title">
                                            <WaIcon name="folder-plus" variant="regular"/>{'Add a new group'}
                                        </span>

                                        <div className="journey-group-create-title-row">
                                            <WaInput
                                                className="journey-group-create-title-input"
                                                required
                                                label="Name"
                                                size="s"
                                                value={newForm.name}
                                                onInput={event => updateNewForm('name', event.target.value)}
                                            />
                                            <div className="journey-group-color-row journey-group-create-color-row">
                                                <WaColorPicker
                                                    size="s"
                                                    placement="bottom"
                                                    swatches={groupColorSwatches}
                                                    value={newForm.color}
                                                    onInput={event => updateNewForm('color', event.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <WaSelect
                                            label="Parent group"
                                            size="s"
                                            value={newForm.parentGroup ?? ''}
                                            onInput={event => updateNewForm('parentGroup', event.target.value || null)}
                                        >
                                            <WaOption value="">{'No parent'}</WaOption>
                                            {groups.map(groupOption => (
                                                <WaOption key={groupOption.id} value={groupOption.id}>
                                                    {groupOption.name}
                                                </WaOption>
                                            ))}
                                        </WaSelect>

                                        <WaTextarea
                                            label="Description"
                                            rows={3}
                                            value={newForm.description}
                                            onInput={event => updateNewForm('description', event.target.value)}
                                        />

                                        <div slot="footer">
                                            <div className="lgs--popup-in-drawer-footer">
                                                <WaButton
                                                    size="s"
                                                    variant="brand"
                                                    appearance="outlined"
                                                    onClick={closeCreatePopup}
                                                >
                                                    <WaIcon slot="start" size="s" name="xmark" variant="regular"/>
                                                    {'Close'}
                                                </WaButton>
                                                <WaButton
                                                    size="s"
                                                    variant="brand"
                                                    appearance="filled"
                                                    onClick={createGroup}
                                                    disabled={!newForm.name.trim()}
                                                >
                                                    <WaIcon slot="start" size="s" name="folder-plus"
                                                            variant="regular"/>
                                                    {'Create'}
                                                </WaButton>
                                            </div>
                                        </div>
                                    </WaCard>
                                </LGSPopup>
                            </div>
                        </LGSScrollbars>
                    </div>
                    <DrawerFooter/>
                </WaDrawer>
            }
        </>
    )

    return drawerRoot ? createPortal(content, drawerRoot) : content
})
