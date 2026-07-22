/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-group-manager.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-24
 * Last modified: 2026-05-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JOURNEY_GROUPS_STORE } from '@Core/constants'
import { JourneyGroupManager }   from '@Core/ui/JourneyGroupManager'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const createDbMock = () => {
    const store = new Map()

    return {
        store,
        api: {
            keys: vi.fn(async () => Array.from(store.keys())),
            get: vi.fn(async (key) => store.get(key)?.data ?? null),
            put: vi.fn(async (key, value) => {
                store.set(key, {data: value})
            }),
            delete: vi.fn(async key => store.delete(key)),
        },
    }
}

describe('JourneyGroupManager subgroups', () => {
    let db
    let manager

    beforeEach(() => {
        db = createDbMock()
        vi.stubGlobal('__', {
            app: {
                slugify: value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
            },
        })
        vi.stubGlobal('lgs', {
            db: {
                lgs1920: db.api,
            },
            stores: {
                ui: {
                    journeyGroups: {
                        list: {},
                        ready: false,
                        version: 0,
                    },
                },
                main: {
                    components: {
                        journeyEditor: {
                            list: [],
                        },
                    },
                },
            },
        })
        manager = new JourneyGroupManager()
        manager.clearStoreList()
        lgs.stores.ui.journeyGroups.version = 0
        lgs.stores.ui.journeyGroups.ready = false
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('persists parentGroup and exposes direct children', async () => {
        const parent = await manager.create({
                                                name:        'Parent',
                                                description: 'Root group',
                                                parentGroup: null,
                                            })
        const child = await manager.create({
                                               name:        'Child',
                                               description: 'Nested group',
                                               parentGroup: parent.id,
                                           })

        expect(parent.parentGroup).toBeNull()
        expect(child.parentGroup).toBe(parent.id)
        expect(manager.childrenOf(parent.id).map(group => group.id)).toEqual([child.id])
        expect(manager.roots().map(group => group.id)).toEqual([parent.id])
    })

    it('rejects parent cycles when updating a group', async () => {
        const parent = await manager.create({name: 'Parent'})
        const child = await manager.create({name: 'Child', parentGroup: parent.id})
        const grandChild = await manager.create({name: 'Grand Child', parentGroup: child.id})

        const updated = await manager.update(parent.id, {parentGroup: grandChild.id})

        expect(updated.parentGroup).toBeNull()
        expect(manager.get(parent.id).parentGroup).toBeNull()
    })

    it('refuses to remove a group that still has children', async () => {
        const parent = await manager.create({name: 'Parent'})
        const child = await manager.create({name: 'Child', parentGroup: parent.id})

        const removed = await manager.remove(parent.id)

        expect(removed).toBe(false)
        expect(db.api.delete).not.toHaveBeenCalledWith(parent.id, JOURNEY_GROUPS_STORE)
        expect(manager.get(parent.id)?.id).toBe(parent.id)
        expect(manager.get(child.id).parentGroup).toBe(parent.id)
    })

    it('refuses to remove a group that still has journeys', async () => {
        const group = await manager.create({name: 'Group'})
        await manager.addJourneyToGroup(group.id, 'journey-a')

        const removed = await manager.remove(group.id)

        expect(removed).toBe(false)
        expect(db.api.delete).not.toHaveBeenCalledWith(group.id, JOURNEY_GROUPS_STORE)
        expect(manager.get(group.id)?.journeys).toEqual(['journey-a'])
    })

    it('moves a journey to the new group instead of duplicating it', async () => {
        const first = await manager.create({name: 'Alpha'})
        const second = await manager.create({name: 'Beta'})

        await manager.addJourneyToGroup(first.id, 'journey-a')
        await manager.addJourneyToGroup(second.id, 'journey-a')

        expect(manager.get(first.id)?.journeys).toEqual([])
        expect(manager.get(second.id)?.journeys).toEqual(['journey-a'])
        expect(manager.groupsForJourney('journey-a').map(group => group.id)).toEqual([second.id])
    })

    it('prunes duplicate journey assignments on initialize', async () => {
        db.store.set('group-a', {
            data: {
                id: 'group-a',
                name: 'Alpha',
                color: '#f2b705',
                journeys: ['journey-a', 'journey-b'],
            },
        })
        db.store.set('group-b', {
            data: {
                id: 'group-b',
                name: 'Beta',
                color: '#f97316',
                journeys: ['journey-a', 'journey-c'],
            },
        })
        lgs.stores.main.components.journeyEditor.list = ['journey-a', 'journey-b', 'journey-c']

        await manager.initialize()

        expect(manager.get('group-a')?.journeys).toEqual(['journey-a', 'journey-b'])
        expect(manager.get('group-b')?.journeys).toEqual(['journey-c'])
        expect(manager.groupsForJourney('journey-a').map(group => group.id)).toEqual(['group-a'])
    })
})
