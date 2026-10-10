/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-preparation-inputs.browser.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-10
 * Last modified: 2026-10-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {render} from 'vitest-browser-react'
import {page} from 'vitest/browser'
import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'
import {proxyMap} from 'valtio/utils'
import {REPLAY_DRAWER} from '@Core/constants'
import {defaultJourneyReplaySettings} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {JourneyReplayDrawer} from '@Components/JourneyReplay/JourneyReplayDrawer'

// Keep the drawer layout independent of its application host while exercising
// the installed number input, shadow DOM, native events, and React wrapper.
vi.mock('@web.awesome.me/webawesome-pro/dist/react', async importOriginal => ({
    ...await importOriginal(),
    WaTab: ({children}) => <span>{children}</span>,
    WaTabGroup: ({children}) => <div>{children}</div>,
    WaTabPanel: ({children}) => <div>{children}</div>,
}))

vi.mock('@Components/DrawerFooter', () => ({default: () => null}))
vi.mock('@Components/MainUI/LGSScrollbars', () => ({LGSScrollbars: ({children}) => <>{children}</>}))
vi.mock('@Components/PanelsActions', () => ({default: ({children}) => <>{children}</>}))
vi.mock('@Components/WaDrawerNonModal', () => ({default: ({children, open}) => open ? <div>{children}</div> : null}))
vi.mock('@Components/PopupDrawer', () => ({PopupDrawer: () => null}))
vi.mock('@Components/JourneyReplay/JourneyReplayProgressBar', () => ({JourneyReplayProgressBar: () => null}))

beforeEach(() => {
    const settings = defaultJourneyReplaySettings()
    settings.userMode = 'basic'
    settings.simple = {camera: {...settings.camera, altitude: 539, pitch: -5}}
    vi.stubGlobal('lgs', {
        colors: {poiDefault: '#fff', poiDefaultBackground: '#000'},
        settings: proxy({ui: {replay: settings}, unitSystem: {current: 0}}),
        stores: {
            ui: proxy({drawers: {open: REPLAY_DRAWER}, video: {editing: true}}),
            main: proxy({theJourney: {slug: 'prepared'}, components: {pois: {list: proxyMap()}}}),
            replay: proxy({...settings, camera: {...settings.simple.camera}, simplePreparationActive: true, nearbyPois: []}),
        },
        scene: {requestRender: vi.fn(), globe: {getHeight: () => 120}},
        viewer: {container: document.body, entities: {getById: () => null}, dataSources: {length: 0, getByName: () => []}},
        editorSettingsProxy: {menu: proxy({drawer: 'right'})},
    })
    vi.stubGlobal('__', {ui: {
        cameraManager: {stopRotate: vi.fn()},
        drawerManager: {drawerRoot: document.body, isCurrent: () => true, isStacked: () => false, restoreDrawerUiState: vi.fn()},
        poiManager: {getJourneyReplayPOIsForJourney: () => []},
        replay: {configure: vi.fn(), refresh: vi.fn(), refreshCamera: vi.fn()},
    }})
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

it.each([-23, -45, -65])('commits pitch %s through the real Web Awesome preparation input before Record', async pitch => {
    await render(<JourneyReplayDrawer/>)
    await page.getByLabelText('Pitch (deg)').fill(String(pitch))
    await expect.poll(() => lgs.stores.replay.camera.pitch).toBe(pitch)
    await expect.poll(() => lgs.settings.ui.replay.simple.camera.pitch).toBe(pitch)
    await page.getByLabelText('Altitude (m)').fill('2630')
    await expect.poll(() => lgs.stores.replay.camera.altitude).toBe(2630)
    expect(lgs.stores.replay.camera.pitch).toBe(pitch)
    page.getByLabelText('Pitch (deg)').element().focus()
    expect(lgs.settings.ui.replay.simple.camera).toMatchObject({pitch, altitude: 2630})
})
