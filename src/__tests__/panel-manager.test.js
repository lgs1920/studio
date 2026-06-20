/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: panel-manager.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-19
 * Last modified: 2026-06-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ui } from '../core/stores/ui.js'
import { PanelManager } from '../core/ui/panels/PanelManager.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const createTabGroup = (id, active) => {
    const tabGroup = document.createElement('wa-tab-group')
    if (id) {
        tabGroup.id = id
    }
    tabGroup.active = active
    return tabGroup
}

const createDetails = (id, open = false) => {
    const details = document.createElement('wa-details')
    if (id) {
        details.id = id
    }
    details.open = open
    return details
}

describe('PanelManager drawer UI state', () => {
    let manager
    let originalRaf
    let originalCancelRaf

    beforeEach(() => {
        document.body.innerHTML = ''
        ui.drawers.open = null
        ui.drawers.action = null
        ui.drawers.entity = null
        ui.drawers.suppressFocusOnOpen = false
        PanelManager.instance = undefined

        originalRaf = globalThis.requestAnimationFrame
        originalCancelRaf = globalThis.cancelAnimationFrame
        globalThis.requestAnimationFrame = cb => {
            cb?.(0)
            return 1
        }
        globalThis.cancelAnimationFrame = () => {}

        manager = new PanelManager()
    })

    afterEach(() => {
        document.body.innerHTML = ''
        PanelManager.instance = undefined
        globalThis.requestAnimationFrame = originalRaf
        globalThis.cancelAnimationFrame = originalCancelRaf
    })

    it('restores every tabgroup and details element when a stacked drawer reopens', () => {
        const settingsDrawer = document.createElement('wa-drawer')
        settingsDrawer.id = 'settings-drawer'

        const tabGroupA = createTabGroup('main-tabs', 'tab-tools')
        const tabGroupB = createTabGroup(null, 'tab-alpha')
        const detailA = createDetails('details-a', true)
        const detailB = createDetails(null, false)

        settingsDrawer.append(tabGroupA, tabGroupB, detailA, detailB)

        const widgetsDrawer = document.createElement('wa-drawer')
        widgetsDrawer.id = 'widgets-drawer'

        document.body.append(settingsDrawer, widgetsDrawer)

        manager.attachEvents()

        settingsDrawer.dispatchEvent(new CustomEvent('wa-after-show', {
            bubbles:  true,
            composed: true,
        }))

        tabGroupA.dispatchEvent(new CustomEvent('wa-tab-show', {
            detail:   {name: 'tab-ui'},
            bubbles:  true,
            composed: true,
        }))
        tabGroupA.active = 'tab-ui'
        tabGroupB.dispatchEvent(new CustomEvent('wa-tab-show', {
            detail:   {name: 'tab-beta'},
            bubbles:  true,
            composed: true,
        }))
        tabGroupB.active = 'tab-beta'
        detailA.open = false
        detailA.dispatchEvent(new CustomEvent('wa-hide', {
            bubbles:  true,
            composed: true,
        }))
        detailB.open = true
        detailB.dispatchEvent(new CustomEvent('wa-show', {
            bubbles:  true,
            composed: true,
        }))

        expect(tabGroupA.active).toBe('tab-ui')
        expect(tabGroupB.active).toBe('tab-beta')
        expect(detailA.open).toBe(false)
        expect(detailB.open).toBe(true)

        manager.open('settings-drawer')
        manager.open('widgets-drawer', {stacked: true})

        tabGroupA.active = 'tab-tools'
        tabGroupB.active = 'tab-alpha'
        detailA.open = true
        detailB.open = false

        manager.close()

        expect(ui.drawers.open).toBe('settings-drawer')
        expect(tabGroupA.active).toBe('tab-ui')
        expect(tabGroupB.active).toBe('tab-beta')
        expect(detailA.open).toBe(false)
        expect(detailB.open).toBe(true)
    })
})
