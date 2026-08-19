/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: app-update.test.jsx
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {proxy} from 'valtio'
import {afterEach, describe, expect, it, vi} from 'vitest'

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

/**
 * Installs the minimum global application context required by AppUpdate.
 *
 * @param {{isUpdateAvailable?: boolean, applyUpdate?: Function}} options - Updater state overrides.
 * @returns {{applyUpdate: Function}} The mocked update action.
 */
const setupAppContext = ({
                           applyUpdate = vi.fn(),
                           automaticUpdateError = null,
                           isAutomaticUpdateInProgress = false,
                           isUpdateApplying = false,
                           isPwa = true,
                           isUpdateAvailable = true,
                           isUpdateCheckPending = false,
                           updateApplyError = null,
                       } = {}) => {
    globalThis.lgs = {
        pwa: isPwa,
        settings: {
            ui: {
                pwa: proxy({canInstall: true}),
            },
        },
        versions: {
            studio: '1.0.0',
        },
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
                applyUpdate,
                automaticUpdateError,
                buildTime: '2026-08-18T12:00:00Z',
                installOutcome: null,
                isAutomaticUpdateInProgress,
                isUpdateApplying,
                isInstallPromptAvailable: false,
                isUpdateAvailable,
                isUpdateCheckPending,
                tag: 'new-version-ready',
                updateApplyError,
            }),
        },
    }

    return {applyUpdate}
}

describe('AppUpdate', () => {
    afterEach(() => {
        cleanup()
        window.localStorage.removeItem('lgs-install-prompt-dismissed')
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('uses a dismissible installation dialog instead of an installation banner', async () => {
        setupAppContext({isPwa: false, isUpdateAvailable: false})

        render(<AppUpdate/>)

        expect(await screen.findByRole('dialog')).not.toBeNull()
        expect(screen.getByText('You can close this dialog and install it later from your browser address bar or menu.')).not.toBeNull()
        expect(document.querySelector('.lgs-install-banner')).toBeNull()

        fireEvent.click(screen.getByRole('button', {name: 'Later'}))

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    })

    it('keeps an available PWA update in a persistent dialog until Later is selected', async () => {
        setupAppContext()

        render(<AppUpdate/>)

        expect(await screen.findByRole('dialog')).not.toBeNull()
        expect(screen.getByText(/A new version \(2026-08-18T12:00:00Z\) is ready to be installed/)).not.toBeNull()
        expect(screen.getByText('The application will restart once the update is complete.')).not.toBeNull()
        expect(screen.getByRole('button', {name: 'Later'})).not.toBeNull()
        expect(screen.getByRole('button', {name: 'Update'})).not.toBeNull()

        fireEvent.click(screen.getByRole('button', {name: 'Later'}))

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    })

    it('keeps update errors visible in the dialog', async () => {
        const applyUpdate = vi.fn().mockRejectedValue(new Error('The new service worker is not ready yet'))
        setupAppContext({applyUpdate})

        render(<AppUpdate/>)
        fireEvent.click(await screen.findByRole('button', {name: 'Update'}))

        expect(await screen.findByText('The new service worker is not ready yet')).not.toBeNull()
        expect(applyUpdate).toHaveBeenCalledOnce()
        expect(screen.getByRole('dialog')).not.toBeNull()
    })

    it('shows PWA update progress and restart information while applying an update', async () => {
        let resolveUpdate
        const applyUpdate = vi.fn(() => new Promise(resolve => {
            resolveUpdate = resolve
        }))
        setupAppContext({applyUpdate})

        render(<AppUpdate/>)
        fireEvent.click(await screen.findByRole('button', {name: 'Update'}))

        expect(screen.getByText('The update is being installed. Please wait.')).not.toBeNull()
        expect(screen.getByText('The application will restart once the update is complete.')).not.toBeNull()
        expect(screen.getByText('Installing update...')).not.toBeNull()
        expect(screen.queryByRole('button', {name: 'Update'})).toBeNull()

        resolveUpdate()
    })

    it('leaves the PWA update dialog actionable after activation times out', async () => {
        setupAppContext({
            isUpdateApplying: true,
            updateApplyError: 'The update could not be activated automatically. Please reload Studio.',
        })

        render(<AppUpdate/>)

        expect(screen.getByText('The update could not be activated automatically. Please reload Studio.')).not.toBeNull()
        expect(screen.getByRole('button', {name: 'Update'})).not.toBeNull()
        expect(screen.queryByText('Installing update...')).toBeNull()
    })

    it('shows webapp update progress before allowing the application to continue', async () => {
        setupAppContext({
            isAutomaticUpdateInProgress: true,
            isPwa: false,
            isUpdateAvailable: false,
        })

        render(<AppUpdate/>)

        expect((await screen.findByRole('status')).getAttribute('variant')).toBe('info')
        expect(screen.getByText('A new version is being installed. The application will restart once the update is complete.')).not.toBeNull()
    })

    it('shows a relaunch action when the automatic webapp update fails', async () => {
        setupAppContext({
            automaticUpdateError: 'The update could not be activated automatically. Please reload Studio.',
            isPwa: false,
            isUpdateAvailable: false,
        })

        render(<AppUpdate/>)

        expect(await screen.findByRole('button', {name: 'Relaunch Studio'})).not.toBeNull()
        expect(screen.getByText(/The latest version could not be installed automatically/)).not.toBeNull()
    })
})
