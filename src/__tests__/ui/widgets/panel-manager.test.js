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

import { ui } from '../../../core/stores/ui.js'
import { PanelManager } from '../../../core/ui/panels/PanelManager.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const createTabGroup = (id, active) => {
    const tabGroup = document.createElement('wa-tab-group')
    if (id) {
        tabGroup.id = id
    }
    tabGroup.active = active
    tabGroup.show = vi.fn((tabName) => {
        tabGroup.active = tabName
    })
    return tabGroup
}

const createTab = (panel, id = '') => {
    const tab = document.createElement('wa-tab')
    tab.setAttribute('panel', panel)
    if (id) {
        tab.id = id
    }
    return tab
}

const createDetails = (id, open = false) => {
    const details = document.createElement('wa-details')
    if (id) {
        details.id = id
    }
    details.open = open
    return details
}

const createTabPanel = name => {
    const tabPanel = document.createElement('wa-tab-panel')
    tabPanel.setAttribute('name', name)
    return tabPanel
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

    it('forces an explicitly requested tab over the restored drawer tab', () => {
        const settingsDrawer = document.createElement('wa-drawer')
        settingsDrawer.id = 'settings-drawer'

        const tabGroup = createTabGroup('main-tabs', 'tab-ui')
        tabGroup.append(createTab('tab-tools'), createTab('tab-ui'), createTab('tab-user', 'manage-user-profile'))
        settingsDrawer.append(tabGroup)
        document.body.append(settingsDrawer)

        manager.attachEvents()

        settingsDrawer.dispatchEvent(new CustomEvent('wa-after-show', {
            bubbles:  true,
            composed: true,
        }))
        tabGroup.dispatchEvent(new CustomEvent('wa-tab-show', {
            detail:   {name: 'tab-ui'},
            bubbles:  true,
            composed: true,
        }))

        manager.open('settings-drawer', {tab: 'manage-user-profile'})

        expect(tabGroup.show).toHaveBeenCalledWith('tab-user')
        expect(tabGroup.active).toBe('tab-user')
        expect(manager.tabActive('tab-user')).toBe(true)
    })

    it('restores the active tab before restoring details inside that tab when going back', () => {
        const settingsDrawer = document.createElement('wa-drawer')
        settingsDrawer.id = 'settings-drawer'

        const tabGroup = createTabGroup('main-tabs', 'tab-tools')
        tabGroup.append(createTab('tab-tools'), createTab('tab-user', 'manage-user-profile'))

        const toolsPanel = createTabPanel('tab-tools')
        const userPanel = createTabPanel('tab-user')
        const profileDetails = createDetails('profile-details', false)
        const toolsDetails = createDetails('tools-details', true)

        userPanel.append(profileDetails)
        toolsPanel.append(toolsDetails)
        settingsDrawer.append(tabGroup, toolsPanel, userPanel)

        const widgetsDrawer = document.createElement('wa-drawer')
        widgetsDrawer.id = 'widgets-drawer'

        document.body.append(settingsDrawer, widgetsDrawer)

        manager.attachEvents()

        manager.open('settings-drawer', {tab: 'manage-user-profile'})
        profileDetails.open = true
        profileDetails.dispatchEvent(new CustomEvent('wa-show', {
            bubbles:  true,
            composed: true,
        }))
        toolsDetails.open = false
        toolsDetails.dispatchEvent(new CustomEvent('wa-hide', {
            bubbles:  true,
            composed: true,
        }))

        manager.open('widgets-drawer', {stacked: true})

        tabGroup.active = 'tab-tools'
        profileDetails.open = false
        toolsDetails.open = true

        manager.close()

        expect(ui.drawers.open).toBe('settings-drawer')
        expect(tabGroup.show).toHaveBeenCalledWith('tab-user')
        expect(tabGroup.active).toBe('tab-user')
        expect(profileDetails.open).toBe(true)
        expect(toolsDetails.open).toBe(false)
    })
})
