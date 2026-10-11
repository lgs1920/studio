/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: webawesome-registry.browser.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-11
 * Last modified: 2026-10-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it} from 'vitest'

describe('Web Awesome registry identity', () => {
    it('shares the button definition between the app and Timeline imports', async () => {
        await import('@awesome.me/webawesome/dist/components/button/button.js')
        const buttonDefinition = customElements.get('wa-button')

        expect(buttonDefinition).toBeDefined()

        await import('@lgs1920/timeline')

        expect(customElements.get('wa-button')).toBe(buttonDefinition)
    })
})
