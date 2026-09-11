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
 * Last modified: 2026-09-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it, vi} from 'vitest'

const {registerLGS1920IconLibrary} = vi.hoisted(() => ({
    registerLGS1920IconLibrary: vi.fn(),
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/components/button/button.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/card/card.js', () => ({}))
vi.mock('@web.awesome.me/webawesome-pro/dist/components/icon/icon.js', () => ({}))
vi.mock('../../../webcomponents/lgs1920-timeline/LGS1920Timeline.js', () => ({}))
vi.mock('../../../Utils/LGS1920IconLibrary', () => ({registerLGS1920IconLibrary}))

describe('external window bootstrap', () => {
    it('registers the application icon kits in the external browser context', async () => {
        await import('../../../external-window-bootstrap.js')

        expect(registerLGS1920IconLibrary).toHaveBeenCalledOnce()
    })
})
