/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyGroupsDrawer.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-11
 * Last modified: 2026-05-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import DrawerFooter                 from '@Components/DrawerFooter'
import { LGSScrollbars }            from '@Components/MainUI/LGSScrollbars'
import PanelActions                 from '@Components/PanelsActions'
import { PopupAnchor }              from '@Components/PopupAnchor'
import { LGSPopup }                 from '@Components/LGSPopup'
import WaDrawer                     from '@Components/WaDrawerNonModal'
import { JOURNEY_GROUPS_DRAWER }    from '@Core/constants'
import { UIToast }                  from '@Utils/UIToast'
import {
    WaButton, WaCallout, WaCard, WaColorPicker, WaDetails, WaDivider, WaIcon, WaInput, WaSwitch, WaTextarea,
    WaTooltip,
}                                   from '@web.awesome.me/webawesome-pro/dist/react'
import classNames                   from 'classnames'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal }             from 'react-dom'
import Sortable                     from 'sortablejs'
import { useSnapshot }              from 'valtio'
import { JourneyGroupColorIcon }    from './JourneyGroupsInfo'

const DEFAULT_GROUP_COLOR = '#f2b705'
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

const emptyGroupForm = () => ({
    name:        '',
    description: '',
    color:       DEFAULT_GROUP_COLOR,
})

const CREATE_GROUP_POPUP_ANCHOR = 'journey-group-create-popup-anchor'

const JourneySortableRow = ({journey, actionIcon, actionLabel, onAction}) => {
    const handleAction = event => {
        event.stopPropagation()
        onAction?.(journey.slug)
    }

    return (
        <WaCard
            appearance="outlined"
            className="lgs--card-hoverable widget-ordering-row journey-group-journey-row"
            data-id={journey.slug}
        >
            <span className="journey-group-drag-handle">
                <WaIcon name="grip-dots-vertical" variant="solid"/>
            </span>
            <WaIcon name="route" variant="regular"/>
            <span className="journey-group-journey-title">{journey.title}</span>
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

const JourneyGroupDeleteButton = ({group, onDelete}) => {
    const [dialog, setDialog] = useState(false)
    const removeButtonId = useMemo(
        () => `remove-${group.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
        [group.id],
    )

    const hideRemoveDialog = useCallback(event => {
        event?.preventDefault?.()
        event?.stopPropagation?.()
        setDialog(false)
    }, [])

    const toggleRemoveDialog = useCallback(event => {
        event.preventDefault()
        event.stopPropagation()
        setDialog(open => !open)
    }, [])

    const removeGroup = useCallback(async event => {
        event?.preventDefault?.()
        event?.stopPropagation?.()
        setDialog(false)
        await onDelete(group)
    }, [group, onDelete])

    return (
        <span className="journey-group-detail-actions">
            <WaTooltip placement="bottom" for={removeButtonId}>{'Remove group'}</WaTooltip>
            <WaButton
                id={removeButtonId}
                size="s"
                variant="brand"
                appearance="plain"
                aria-label={`Remove ${group.name}`}
                onClick={toggleRemoveDialog}
            >
                <WaIcon name="trash-can" variant="regular"/>
            </WaButton>
            <LGSPopup
                anchor={removeButtonId}
                active={dialog}
                onRequestClose={hideRemoveDialog}
                hover-bridge="true"
                shift="true"
                placement="bottom-end"
                distance={lgs.gutter.xs}
            >
                <WaCard className="lgs--popup-in-drawer lgs--popup-in-drawer-small lgs-slide-down">
                    <div className="journey-group-delete-confirmation">
                        <span>{'Are you sure to remove this group? (Your journeys won\'t be deleted.)'}</span>
                    </div>
                    <div slot="footer">
                        <div className="lgs--popup-in-drawer-footer">
                            <WaButton variant="neutral" appearance="outlined" size="s" onClick={hideRemoveDialog}>
                                <WaIcon name="xmark"/> {'No'}
                            </WaButton>
                            <WaButton variant="danger" appearance="filled-outlined" size="s" onClick={removeGroup}>
                                <WaIcon name="trash-can"/> {'Yes'}
                            </WaButton>
                        </div>
                    </div>
                </WaCard>
            </LGSPopup>
        </span>
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

    const currentJourney = useMemo(
        () => currentJourneySlug ? lgs.getJourneyBySlug(currentJourneySlug) : null,
        [currentJourneySlug],
    )

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

    const selectedHasCurrentJourney = Boolean(currentJourneySlug && selectedJourneySlugSet.has(currentJourneySlug))
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
        }
    }, [editForm, selectedGroup])

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
        if (__.ui.drawerManager.isCurrent(JOURNEY_GROUPS_DRAWER)) {
            __.ui.drawerManager.close()
        }
    }, [])

    const handleRequestClose = useCallback((event) => {
        if (event.target.tagName !== 'WA-DRAWER') {
            event.preventDefault()
            return
        }

        closeDrawerWithManager()
    }, [closeDrawerWithManager])

    const closeDrawer = useCallback((event) => {
        if (window.isOK(event) && __.ui.drawerManager.isCurrent(JOURNEY_GROUPS_DRAWER)) {
            closeDrawerWithManager()
        }
    }, [closeDrawerWithManager])

    const updateNewForm = useCallback((key, value) => {
        setNewForm(current => ({...current, [key]: value}))
    }, [])

    const openCreatePopup = useCallback(() => {
        setNewForm(emptyGroupForm())
        setCreatePopupOpen(true)
    }, [])

    const closeCreatePopup = useCallback((event) => {
        event?.preventDefault?.()
        setCreatePopupOpen(false)
    }, [])

    const updateEditForm = useCallback((key, value) => {
        setEditForm(current => ({
            id: selectedGroup?.id ?? current.id,
            name: current.id === selectedGroup?.id ? current.name : selectedGroup?.name ?? '',
            description: current.id === selectedGroup?.id ? current.description : selectedGroup?.description ?? '',
            color: current.id === selectedGroup?.id ? current.color : selectedGroup?.color ?? DEFAULT_GROUP_COLOR,
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
                        })
        }
    }, [groups])

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
        })
        setSelectedGroupId(group.id)
        setCreatePopupOpen(false)
        setEditForm({
                        id:          group.id,
                        name:        group.name,
                        description: group.description,
                        color:       group.color,
                    })
        setNewForm(emptyGroupForm())
        UIToast.success({caption: group.name, text: 'Group created.'})
    }, [newForm])

    const saveGroup = useCallback(async () => {
        if (!selectedGroup) {
            return
        }

        const name = selectedEditForm.name.trim()
        if (!name) {
            UIToast.warning({caption: 'Journey group', text: 'A group name is required.'})
            return
        }

        const group = await __.ui.journeyGroupManager.update(selectedGroup.id, {
            name,
            description: selectedEditForm.description,
            color:       selectedEditForm.color,
        })

        setEditForm({
                        id:          group.id,
                        name:        group.name,
                        description: group.description,
                        color:       group.color,
                    })
        UIToast.success({caption: group.name, text: 'Group updated.'})
    }, [selectedEditForm, selectedGroup])

    const deleteGroup = useCallback(async group => {
        if (!group) {
            return
        }

        const groupName = group.name
        const removed = await __.ui.journeyGroupManager.remove(group.id)
        if (!removed) {
            return
        }

        const nextGroupId = groups.find(item => item.id !== group.id)?.id ?? null
        if (group.id === effectiveSelectedGroupId) {
            setSelectedGroupId(nextGroupId)
            setEditForm({id: null, ...emptyGroupForm()})
        }
        else {
            setEditForm(current => current.id === group.id ? {id: null, ...emptyGroupForm()} : current)
        }

        UIToast.success({caption: groupName, text: 'Group removed.'})
    }, [effectiveSelectedGroupId, groups])

    const addJourneyToSelectedGroup = useCallback(async journeySlug => {
        if (!selectedGroup) {
            return
        }

        await __.ui.journeyGroupManager.addJourneyToGroup(selectedGroup.id, journeySlug)
    }, [selectedGroup])

    const removeJourneyFromSelectedGroup = useCallback(async journeySlug => {
        if (!selectedGroup) {
            return
        }

        await __.ui.journeyGroupManager.removeJourneyFromGroup(selectedGroup.id, journeySlug)
    }, [selectedGroup])

    const toggleCurrentJourneyInSelectedGroup = useCallback(async event => {
        if (!selectedGroup || !currentJourneySlug) {
            return
        }

        await __.ui.journeyGroupManager.toggleJourneyInGroup(selectedGroup.id, currentJourneySlug, event.target.checked)
    }, [currentJourneySlug, selectedGroup])

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
            onAdd:    () => { void persistMembersOrder() },
            onUpdate: () => { void persistMembersOrder() },
            onRemove: () => { void persistMembersOrder() },
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
                    onSlAfterHide={closeDrawer}
                    placement={drawerPlacement}
                    className={classNames('journey-groups-drawer', {'drawer-is-stacked': isStacked})}
                >
                    <span slot="label" className="journey-groups-drawer-title">
                        <WaIcon name="folders" variant="regular"/>
                        {'Journey Groups'}
                    </span>
                    <PanelActions stackedPanel={isStacked} onBack={isStacked ? closeDrawerWithManager : null}/>

                    <div className="journey-groups-drawer-content">
                        <LGSScrollbars>
                            <div className="journey-groups-layout">
                                <section className="journey-groups-section">
                                    <div className="journey-group-create-header">
                                        <WaButton
                                            variant="brand"
                                            appearance="filled"
                                            size="s"
                                            onClick={openCreatePopup}
                                        >
                                            <WaIcon slot="start" name="circle-plus" variant="regular"/>
                                            {'Create'}
                                        </WaButton>
                                    </div>
                                    <LGSPopup
                                        active={createPopupOpen}
                                        anchor={CREATE_GROUP_POPUP_ANCHOR}
                                        onRequestClose={closeCreatePopup}
                                        placement="bottom"
                                    >
                                        <WaCard className="lgs--popup-in-drawer lgs-slide-down journey-group-create-popup">
                                            <WaButton appearance="plain" slot="header-actions" onClick={closeCreatePopup}>
                                                <WaIcon size="s" name="xmark" variant="regular"/>
                                            </WaButton>

                                            <h3 slot="header" className="journey-group-create-popup-title">
                                                <WaIcon name="folder-plus" variant="regular"/>
                                                <span>{'Create group'}</span>
                                            </h3>

                                            <div className="journey-group-create-title-row">
                                                <WaInput
                                                    className="journey-group-create-title-input"
                                                    label="Title"
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
                                    <PopupAnchor id={CREATE_GROUP_POPUP_ANCHOR}/>
                                </section>

                                <WaDivider/>

                                <section className="journey-groups-section">
                                    <div className="journey-groups-list">
                                        {groups.length > 0
                                         ? groups.map(group => (
                                                <div key={group.id} className="journey-group-detail-wrapper">
                                                    <WaDetails
                                                        small
                                                        open={group.id === effectiveSelectedGroupId}
                                                        className="lgs--details-hoverable journey-group-detail"
                                                        onWaShow={() => selectGroup(group.id)}
                                                    >
                                                        <div slot="summary" className="journey-group-detail-summary">
                                                         <span className="journey-group-detail-summary-main">
                                                             <JourneyGroupColorIcon color={group.color}/>
                                                             <span
                                                                 className="journey-group-detail-title">{group.name}</span>
                                                         </span>
                                                        </div>
                                                        {group.id === effectiveSelectedGroupId && selectedGroup && (
                                                            <>
                                                                <div className="journey-group-form">
                                                                    <WaInput
                                                                        label="Name"
                                                                        size="s"
                                                                        value={selectedEditForm.name}
                                                                        onInput={event => updateEditForm('name', event.target.value)}
                                                                    />
                                                                    <WaTextarea
                                                                        label="Description"
                                                                        rows={3}
                                                                        value={selectedEditForm.description}
                                                                        onInput={event => updateEditForm('description', event.target.value)}
                                                                    />
                                                                    <div className="journey-group-color-row">
                                                                        <span>{'Color'}</span>
                                                                        <WaColorPicker
                                                                            size="s"
                                                                            swatches={groupColorSwatches}
                                                                            value={selectedEditForm.color}
                                                                            onInput={event => updateEditForm('color', event.target.value)}
                                                                        />
                                                                    </div>
                                                                    {currentJourney && (
                                                                        <div
                                                                            className="journey-group-current-association">
                                                                            <div>
                                                                                <WaIcon name="route" variant="regular"/>
                                                                                <span>{currentJourney.title}</span>
                                                                            </div>
                                                                            <WaSwitch
                                                                                size="xs"
                                                                                label-at-start
                                                                                checked={selectedHasCurrentJourney}
                                                                                onChange={toggleCurrentJourneyInSelectedGroup}
                                                                            >
                                                                                {'Current journey'}
                                                                            </WaSwitch>
                                                                        </div>
                                                                    )}
                                                                    <div className="journey-group-form-actions">
                                                                        <WaButton
                                                                            variant="brand"
                                                                            appearance="filled"
                                                                            size="s"
                                                                            onClick={saveGroup}
                                                                            disabled={!selectedEditForm.name.trim()}
                                                                        >
                                                                            <WaIcon name="floppy-disk"
                                                                                    variant="regular"/>
                                                                            {'Save'}
                                                                        </WaButton>
                                                                    </div>
                                                                </div>

                                                                <WaDivider/>

                                                                <div className="journey-group-assignment">
                                                                    <div className="journey-groups-section-title">
                                                                        <WaIcon name="route" variant="regular"/>
                                                                        <span>{'Journeys in group'}</span>
                                                                    </div>
                                                                    <div ref={memberListRef}
                                                                         className="widget-sortable-list journey-group-sortable-list">
                                                                        {groupJourneys.map(journey => (
                                                                            <JourneySortableRow
                                                                                key={journey.slug}
                                                                                journey={journey}
                                                                                actionIcon="link-simple-slash"
                                                                                actionLabel="Remove journey from group"
                                                                                onAction={removeJourneyFromSelectedGroup}
                                                                            />
                                                                        ))}
                                                                        {groupJourneys.length === 0 && (
                                                                            <p className="journey-groups-empty-state">{'Drag journeys here.'}</p>
                                                                        )}
                                                                    </div>

                                                                    <div className="journey-groups-section-title">
                                                                        <WaIcon name="plus" variant="regular"/>
                                                                        <span>{'Available journeys'}</span>
                                                                    </div>
                                                                    <div ref={availableListRef}
                                                                         className="widget-sortable-list journey-group-sortable-list">
                                                                        {availableJourneys.map(journey => (
                                                                            <JourneySortableRow
                                                                                key={journey.slug}
                                                                                journey={journey}
                                                                                actionIcon="link-simple"
                                                                                actionLabel="Add journey to group"
                                                                                onAction={addJourneyToSelectedGroup}
                                                                            />
                                                                        ))}
                                                                        {availableJourneys.length === 0 && (
                                                                            <p className="journey-groups-empty-state">{'No available journey.'}</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </WaDetails>
                                                    <JourneyGroupDeleteButton group={group} onDelete={deleteGroup}/>
                                                </div>
                                         ))
                                         : (
                                             <WaCallout size="s" variant="warning" appearance="outlined">
                                                 <WaIcon slot="icon" name="warning" variant="regular"/>
                                                 {'No journey groups yet.'}
                                             </WaCallout>
                                         )}
                                    </div>
                                </section>
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
