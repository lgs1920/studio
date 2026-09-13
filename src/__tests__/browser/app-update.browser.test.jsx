/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: app-update.browser.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-13
 * Last modified: 2026-09-13
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {render} from 'vitest-browser-react'
import {afterEach, expect, test, vi} from 'vitest'
import {proxy} from 'valtio'

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button {...props}>{children}</button>,
    WaCallout: ({children, ...props}) => <div {...props}>{children}</div>,
    WaDialog: ({children, open}) => open ? <div role="dialog">{children}</div> : null,
    WaCopyButton: () => null,
    WaDetails: ({children}) => <div>{children}</div>,
    WaIcon: () => null,
    WaSpinner: () => null,
    WaTextarea: () => null,
}))

vi.mock('@Components/MainUI/LGSScrollbars', () => ({
    LGSScrollbars: ({children}) => <>{children}</>,
}))

import {AppUpdate} from '@Components/AppUpdate'

afterEach(() => {
    globalThis.lgs = undefined
    globalThis.__ = undefined
})

test('renders the update dialog in the browser', async () => {
    globalThis.lgs = {
        pwa: true,
        settings: {ui: {pwa: proxy({canInstall: false})}},
        versions: {studio: '1.0.0'},
    }
    globalThis.__ = {
        device: {
            browser: 'Chrome',
            isAndroid: false,
            isDesktop: true,
            isIOS: false,
            os: 'windows',
        },
        updater: {
            store: proxy({
                applyUpdate: vi.fn(),
                automaticUpdateError: null,
                buildTime: '2026-09-13T12:00:00Z',
                installOutcome: null,
                isAutomaticUpdateInProgress: false,
                isUpdateApplying: false,
                isInstallPromptAvailable: false,
                isUpdateAvailable: true,
                isUpdateCheckPending: false,
                tag: 'new-version-ready',
                updateApplyError: null,
            }),
        },
    }

    const screen = await render(<AppUpdate/>)

    await expect.element(screen.getByRole('dialog')).toBeVisible()
    await expect.element(screen.getByText(/A new version \(2026-09-13T12:00:00Z\) is ready/)).toBeVisible()
    await expect.element(screen.getByRole('button', {name: 'Later'})).toBeVisible()
})
