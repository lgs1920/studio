/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyGroupManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
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

    create = async ({name, description = '', color = DEFAULT_GROUP_COLOR}) => {
        const now = Date.now()
        const idBase = __.app.slugify(name) || 'group'
        const group = this.normalizeGroup({
                                              id:        `journey-group#${idBase}#${now.toString(36)}`,
                                              name,
                                              description,
                                              color,
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

        const next = this.normalizeGroup({
                                             ...current,
                                             ...changes,
                                             id:        current.id,
                                             updatedAt: Date.now(),
                                         })
        await this.persist(next)
        return next
    }

    remove = async id => {
        if (!this.store.list[id]) {
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

        if (group.journeys.includes(journeySlug)) {
            return group
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
            journeys:    uniqueList(group.journeys),
            createdAt:   group.createdAt ?? now,
            updatedAt:   group.updatedAt ?? now,
        }
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
