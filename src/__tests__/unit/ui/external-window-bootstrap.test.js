// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: external-window-bootstrap.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-11
 * Last modified: 2026-10-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it, vi} from 'vitest'

const {registerLGS1920IconLibrary} = vi.hoisted(() => ({
    registerLGS1920IconLibrary: vi.fn(),
}))

vi.mock('@awesome.me/webawesome/dist/components/button/button.js', () => ({}))
vi.mock('@awesome.me/webawesome/dist/components/card/card.js', () => ({}))
vi.mock('@awesome.me/webawesome/dist/components/divider/divider.js', () => ({}))
vi.mock('@awesome.me/webawesome/dist/components/icon/icon.js', () => ({}))
vi.mock('@awesome.me/webawesome/dist/components/progress-bar/progress-bar.js', () => ({}))
vi.mock('@awesome.me/webawesome/dist/components/tooltip/tooltip.js', () => ({}))
vi.mock('@lgs1920/timeline', () => ({}))
vi.mock('../../../Utils/LGS1920IconLibrary', () => ({registerLGS1920IconLibrary}))

describe('external window bootstrap', () => {
    it('registers the application icon kits in the external browser context', async () => {
        await import('../../../external-window-bootstrap.js')

        expect(registerLGS1920IconLibrary).toHaveBeenCalledOnce()
    })

    it('reveals the document after the external resources are ready', async () => {
        document.documentElement.style.visibility = 'hidden'

        await import('../../../external-window-bootstrap.js?reveal-test')
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

        expect(document.documentElement.style.visibility).toBe('')
    })
})
