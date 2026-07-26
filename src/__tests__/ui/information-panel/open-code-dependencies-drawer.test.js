/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: open-code-dependencies-drawer.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-26
 * Last modified: 2026-07-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { openCodeDependenciesDrawer } from '@Components/InformationPanel/openCodeDependenciesDrawer'
import { CODE_DEPENDENCIES_DRAWER } from '@Core/constants'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('openCodeDependenciesDrawer', () => {
    beforeEach(() => {
        globalThis.__ = {
            ui: {
                drawerManager: {
                    tab:  null,
                    open: vi.fn(),
                },
            },
        }
    })

    it('opens the code dependencies drawer in stacked mode', () => {
        openCodeDependenciesDrawer()

        expect(__.ui.drawerManager.tab).toBe('tab-credits')
        expect(__.ui.drawerManager.open).toHaveBeenCalledWith(CODE_DEPENDENCIES_DRAWER, {
            stacked: true,
        })
    })
})
