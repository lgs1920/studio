/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyGroupManager.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-06
 * Last modified: 2026-05-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JOURNEY_GROUPS_STORE } from '@Core/constants'

const DEFAULT_GROUP_COLOR = '#f2b705'

const uniqueList = values => Array.from(new Set((values ?? []).filter(Boolean)))
const normalizeGroupParent = parentGroup => {
    const value = typeof parentGroup === 'string' ? parentGroup.trim() : parentGroup
    return value ? value : null
}

export class JourneyGroupManager {
    static #instance = null

    constructor() {
        if (JourneyGroupManager.#instance) {
            return JourneyGroupManager.#instance
        }

        JourneyGroupManager.#instance = this
    }

    get store() {
        return lgs.stores.ui.journeyGroups
    }

    initialize = async () => {
        await this.readAll()
        await this.pruneMissingJourneys()
        await this.pruneDuplicateJourneyAssignments()
        await this.pruneInvalidParentGroups()
        this.store.ready = true
    }

    readAll = async () => {
        const keys = await lgs.db.lgs1920.keys(JOURNEY_GROUPS_STORE)
        const groups = await Promise.all(keys.map(key => lgs.db.lgs1920.get(key, JOURNEY_GROUPS_STORE)))

        this.clearStoreList()
        groups
            .filter(Boolean)
            .map(this.normalizeGroup)
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(group => {
                this.store.list[group.id] = group
            })

        this.bumpVersion()
    }

    create = async ({name, description = '', color = DEFAULT_GROUP_COLOR, parentGroup = null}) => {
        const now = Date.now()
        const idBase = __.app.slugify(name) || 'group'
        const group = this.normalizeGroup({
                                              id:        `journey-group#${idBase}#${now.toString(36)}`,
                                              name,
                                              description,
                                              color,
                                              parentGroup: this.resolveValidParentGroup(null, parentGroup),
                                              journeys:  [],
                                              createdAt: now,
                                              updatedAt: now,
                                          })

        await this.persist(group)
        return group
    }

    update = async (id, changes = {}) => {
        const current = this.get(id)
        if (!current) {
            return null
        }

        const parentGroup = Object.prototype.hasOwnProperty.call(changes, 'parentGroup')
                              ? this.resolveValidParentGroup(id, changes.parentGroup)
                              : current.parentGroup ?? null

        const next = this.normalizeGroup({
                                             ...current,
                                             ...changes,
                                             id:        current.id,
                                             parentGroup,
                                             updatedAt: Date.now(),
                                         })
        await this.persist(next)
        return next
    }

    remove = async id => {
        const current = this.get(id)
        if (!current) {
            return false
        }

        const hasChildren = this.childrenOf(id).length > 0
        if (current.journeys.length > 0 || hasChildren) {
            return false
        }

        await lgs.db.lgs1920.delete(id, JOURNEY_GROUPS_STORE)
        delete this.store.list[id]
        this.bumpVersion()
        return true
    }

    get = id => {
        const group = this.store.list[id]
        return group ? this.normalizeGroup(group) : null
    }

    list = () => Object.values(this.store.list).map(this.normalizeGroup)

    roots = () => this.list()
        .filter(group => !group.parentGroup)
        .sort((a, b) => a.name.localeCompare(b.name))

    childrenOf = groupId => this.list()
        .filter(group => group.parentGroup === groupId)
        .sort((a, b) => a.name.localeCompare(b.name))

    descendantsOf = (groupId, visited = new Set()) => {
        if (!groupId || visited.has(groupId)) {
            return []
        }

        visited.add(groupId)
        const children = this.childrenOf(groupId)
        return children.flatMap(child => [child.id, ...this.descendantsOf(child.id, visited)])
    }

    resolveValidParentGroup = (groupId, parentGroup) => {
        const nextParent = normalizeGroupParent(parentGroup)
        if (!nextParent || nextParent === groupId) {
            return null
        }

        const knownGroups = new Set(this.list().map(group => group.id))
        if (!knownGroups.has(nextParent)) {
            return null
        }

        const descendants = new Set(this.descendantsOf(groupId))
        if (descendants.has(nextParent)) {
            return null
        }

        return nextParent
    }

    groupsForJourney = journeySlug => {
        if (!journeySlug) {
            return []
        }

        return this.list()
            .filter(group => group.journeys.includes(journeySlug))
            .sort((a, b) => a.name.localeCompare(b.name))
    }

    addJourneyToGroup = async (groupId, journeySlug) => {
        const group = this.get(groupId)
        if (!group || !journeySlug) {
            return null
        }

        const conflictingGroups = this.list()
            .filter(current => current.id !== groupId && current.journeys.includes(journeySlug))

        if (conflictingGroups.length > 0) {
            await Promise.all(
                conflictingGroups.map(current => this.update(current.id, {
                    journeys: current.journeys.filter(slug => slug !== journeySlug),
                })),
            )
        }

        if (group.journeys.includes(journeySlug)) {
            return this.get(groupId)
        }

        return this.update(groupId, {journeys: [...group.journeys, journeySlug]})
    }

    removeJourneyFromGroup = async (groupId, journeySlug) => {
        const group = this.get(groupId)
        if (!group || !journeySlug) {
            return null
        }

        return this.update(groupId, {journeys: group.journeys.filter(slug => slug !== journeySlug)})
    }

    toggleJourneyInGroup = async (groupId, journeySlug, checked) => {
        return checked
               ? this.addJourneyToGroup(groupId, journeySlug)
               : this.removeJourneyFromGroup(groupId, journeySlug)
    }

    reorderGroupJourneys = async (groupId, journeySlugs) => {
        const group = this.get(groupId)
        if (!group) {
            return null
        }

        const knownJourneys = new Set(lgs.stores.main.components.journeyEditor.list)
        const journeys = uniqueList(journeySlugs).filter(slug => knownJourneys.has(slug))
        return this.update(groupId, {journeys})
    }

    removeJourneyFromAll = async journeySlug => {
        if (!journeySlug) {
            return
        }

        const updates = this.list()
            .filter(group => group.journeys.includes(journeySlug))
            .map(group => this.update(group.id, {journeys: group.journeys.filter(slug => slug !== journeySlug)}))

        await Promise.all(updates)
    }

    pruneMissingJourneys = async () => {
        const knownJourneys = new Set(lgs.stores.main.components.journeyEditor.list)
        const updates = this.list()
            .map(group => ({
                group,
                journeys: group.journeys.filter(slug => knownJourneys.has(slug)),
            }))
            .filter(({group, journeys}) => journeys.length !== group.journeys.length)
            .map(({group, journeys}) => this.update(group.id, {journeys}))

        await Promise.all(updates)
    }

    pruneDuplicateJourneyAssignments = async () => {
        const assignedJourneys = new Set()
        const updates = this.list()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(group => {
                const journeys = group.journeys.filter(slug => {
                    if (assignedJourneys.has(slug)) {
                        return false
                    }

                    assignedJourneys.add(slug)
                    return true
                })

                return journeys.length === group.journeys.length
                       ? null
                       : this.update(group.id, {journeys})
            })
            .filter(Boolean)

        await Promise.all(updates)
    }

    persist = async group => {
        await lgs.db.lgs1920.put(group.id, group, JOURNEY_GROUPS_STORE)
        this.store.list[group.id] = group
        this.bumpVersion()
    }

    normalizeGroup = group => {
        const now = Date.now()
        return {
            id:          group.id,
            name:        String(group.name ?? '').trim(),
            description: String(group.description ?? '').trim(),
            color:       group.color || DEFAULT_GROUP_COLOR,
            icon:        'folder',
            parentGroup: normalizeGroupParent(group.parentGroup),
            journeys:    uniqueList(group.journeys),
            createdAt:   group.createdAt ?? now,
            updatedAt:   group.updatedAt ?? now,
        }
    }

    pruneInvalidParentGroups = async () => {
        const knownGroups = new Set(this.list().map(group => group.id))
        const updates = this.list()
            .filter(group => group.parentGroup && (!knownGroups.has(group.parentGroup) || group.parentGroup === group.id))
            .map(group => this.update(group.id, {parentGroup: null}))

        await Promise.all(updates)
    }

    bumpVersion = () => {
        this.store.version += 1
    }

    clearStoreList = () => {
        Object.keys(this.store.list).forEach(key => {
            delete this.store.list[key]
        })
    }
}
