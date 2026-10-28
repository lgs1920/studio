/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poi-context-menu-creation.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-24
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'
import {proxyMap} from 'valtio/utils'

vi.mock('@Editor/Utils', () => ({Utils: {updateJourneyEditor: vi.fn()}}))
vi.mock('@Components/MainUI/widgets/openWidgetManagementDrawer', () => ({
    getManageableWidgets: () => [],
    openWidgetManagementDrawer: vi.fn(),
}))
vi.mock('@Utils/UIToast', () => ({UIToast: {success: vi.fn(), warning: vi.fn()}}))
vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaButton: ({children, ...props}) => <button {...props}>{children}</button>,
    WaDivider: () => <hr/>,
    WaIcon: ({name}) => <span data-icon={name}/>,
}))

import {MapPointContextMenu} from '@Components/MainUI/context-menu/MapPointContextMenu'
import {MapPOI} from '@Core/MapPOI'
import {POIManager} from '@Core/ui/POIManager'
import {POIS_EDITOR_DRAWER} from '@Core/constants'
import {UIToast} from '@Utils/UIToast'

const OLD_PLACE = {longitude: 2.3522, latitude: 48.8566, simulatedHeight: 40}
const FIRST_PLACE = {longitude: 5.735, latitude: 45.325, simulatedHeight: 1100}
const SECOND_PLACE = {longitude: 5.739, latitude: 45.329, simulatedHeight: 1200}

beforeEach(() => {
    vi.clearAllMocks()
    const $pois = proxy({current: 'old-poi', list: proxyMap()})
    $pois.list.set('old-poi', new MapPOI({id: 'old-poi', type: 'poi', ...OLD_PLACE}))
    vi.stubGlobal('lgs', {
        settings: {
            ui: proxy({toolbars: {opacity: 1}}),
            scene: proxy({mode: {value: 3}}),
            coordinateSystem: {current: 'dd'},
            unitSystem: {current: 0},
            camera: {...OLD_PLACE, heading: 0, pitch: -30, roll: 0, range: 2000},
            starter: {...OLD_PLACE},
        },
        colors: {poiDefaultBackground: '#ffffff', poiDefault: '#000000'},
        stores: {
            main: {components: {pois: $pois}},
            journeyEditor: proxy({fixPathEditorOpen: false}),
            ui: proxy({
                contextMenu: {type: null, targetId: null, visible: false},
                drawers: {open: null},
                mainUI: {rotate: {running: false}, panorama: {active: false}},
                video: {},
                widget: {list: proxyMap(), current: {}},
            }),
        },
        db: {lgs1920: {put: vi.fn(async () => undefined)}},
    })
    vi.stubGlobal('__', {
        app: {deepClone: value => value},
        convert: () => ({to: () => '0'}),
        ui: {
            contextMenu: {hide: vi.fn()},
            drawerManager: {open: vi.fn()},
            sceneManager: {focus: vi.fn()},
        },
    })
    __.ui.poiManager = new POIManager()
})

afterEach(() => {
    cleanup()
    POIManager.instance?.destroy()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('POI context-menu creation and editing', () => {
    it('creates, saves, edits and focuses each clicked POI independently from the old map state', async () => {
        const view = render(<MapPointContextMenu target={FIRST_PLACE}/>)
        fireEvent.click(screen.getByText('Create POI'))
        await waitFor(() => expect(UIToast.success).toHaveBeenCalledTimes(1))
        const first = Array.from(lgs.stores.main.components.pois.list.values()).find(poi => poi.id !== 'old-poi')
        expect(first).toMatchObject({
            ...FIRST_PLACE,
            background:   true,
            bgColor:      '#ffffff',
            category:     'poi',
            color:        '#000000',
            description:  '',
            title:        'Point Of Interest',
            type:         'poi',
        })
        const firstToast = UIToast.success.mock.calls[0][0]

        view.rerender(<MapPointContextMenu target={SECOND_PLACE}/>)
        fireEvent.click(screen.getByText('Create POI'))
        await waitFor(() => expect(UIToast.success).toHaveBeenCalledTimes(2))
        const second = Array.from(lgs.stores.main.components.pois.list.values())
            .find(poi => poi.id !== 'old-poi' && poi.id !== first.id)
        expect(second).toMatchObject(SECOND_PLACE)
        expect(lgs.db.lgs1920.put.mock.calls.map(([, record]) => [record.longitude, record.latitude]))
            .toEqual([[FIRST_PLACE.longitude, FIRST_PLACE.latitude], [SECOND_PLACE.longitude, SECOND_PLACE.latitude]])

        view.unmount()
        const toast = render(firstToast.text)
        fireEvent.click(screen.getByText('Edit'))
        await waitFor(() => expect(__.ui.drawerManager.open).toHaveBeenCalledWith(POIS_EDITOR_DRAWER,
            expect.objectContaining({entity: first.id})))
        expect(lgs.stores.main.components.pois.current).toBe(first.id)
        await __.ui.poiManager.focusPOI(first.id)
        expect(__.ui.sceneManager.focus).toHaveBeenLastCalledWith(
            expect.objectContaining({longitude: FIRST_PLACE.longitude, latitude: FIRST_PLACE.latitude}),
            expect.anything())

        toast.rerender(UIToast.success.mock.calls[1][0].text)
        fireEvent.click(screen.getByText('Edit'))
        await waitFor(() => expect(lgs.stores.main.components.pois.current).toBe(second.id))
        await __.ui.poiManager.focusPOI(second.id)
        expect(__.ui.sceneManager.focus).toHaveBeenLastCalledWith(
            expect.objectContaining({longitude: SECOND_PLACE.longitude, latitude: SECOND_PLACE.latitude}),
            expect.anything())
        expect(first).toMatchObject(FIRST_PLACE)
        expect(second).toMatchObject(SECOND_PLACE)
    })
})
