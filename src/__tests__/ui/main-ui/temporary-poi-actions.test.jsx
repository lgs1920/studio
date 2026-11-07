/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: temporary-poi-actions.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-07
 * Last modified: 2026-11-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { POI_STANDARD_TYPE, POI_TMP_TYPE } from '@Core/constants'
import { UI_ACTIONS } from '@Core/ui/metadata/uiActionCatalog'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import { proxyMap } from 'valtio/utils'

const { addPOIToLibrary, openPOIEditor, startPOIMove } = vi.hoisted(() => ({
    addPOIToLibrary: vi.fn(),
    openPOIEditor: vi.fn(),
    startPOIMove: vi.fn(),
}))

vi.mock('@Components/MainUI/MapPOI/addPOIToLibrary', () => ({addPOIToLibrary}))
vi.mock('@Components/MainUI/MapPOI/openPOIEditor', () => ({openPOIEditor}))
vi.mock('@Components/MainUI/MapPOI/poiMoveStore', () => ({startPOIMove}))
vi.mock('@Components/MainUI/MapPOI/poiPresentationClipboard', () => ({
    usePOIPresentationClipboard: () => ({canPaste: false, copy: vi.fn(), paste: vi.fn()}),
}))
vi.mock('@Core/OrbitSettings', () => ({
    DEFAULT_PANORAMA_HEIGHT_OFFSET: 100,
    DEFAULT_PANORAMA_PITCH: -30,
    getOrbitSettings: vi.fn(() => ({})),
    setOrbitStoreSettings: vi.fn(),
}))
vi.mock('@Utils/UnitUtils', () => ({
    ELEVATION_UNITS: ['m'],
    UnitUtils: {
        convert: vi.fn(() => ({to: vi.fn(() => 12)})),
        formatCoordinate: vi.fn(value => String(value)),
    },
}))
vi.mock('@Utils/UIToast', () => ({UIToast: {success: vi.fn(), warning: vi.fn()}}))
vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaButton: ({children, ...props}) => <button {...props}>{children}</button>,
    WaCallout: ({children}) => <aside>{children}</aside>,
    WaDivider: () => <hr/>,
    WaIcon: ({name}) => <span data-icon={name}/>,
}))

import { MapPOIContextMenu } from '@Components/MainUI/MapPOI/MapPOIContextMenu'
import { TemporaryPOIWarning } from '@Components/MainUI/MapPOI/TemporaryPOIWarning'

describe('temporary POI actions', () => {
    let poi
    let pois

    beforeEach(() => {
        vi.clearAllMocks()
        poi = proxy({
            id: 'temporary-location',
            type: POI_TMP_TYPE,
            title: 'Paris',
            latitude: 48.8566,
            longitude: 2.3522,
            simulatedHeight: 35,
            expanded: false,
            visible: true,
        })
        pois = proxyMap([[poi.id, poi]])
        globalThis.lgs = {
            settings: {
                ui: proxy({toolbars: {opacity: 1}}),
                scene: proxy({mode: {value: 3}}),
                coordinateSystem: {current: 'dd'},
                unitSystem: {current: 0},
            },
            stores: {
                main: {components: {pois: {list: pois}}},
                ui: proxy({
                    contextMenu: {type: 'poi', visible: true, position: {x: 20, y: 30}},
                    mainUI: {
                        rotate: {running: false, target: null},
                        panorama: {active: false, target: null},
                    },
                }),
            },
            gutter: {xs: 8},
        }
        globalThis.__ = {
            ui: {
                poiManager: {
                    isPOIRotating: vi.fn(() => false),
                    isRotating: vi.fn(() => false),
                },
                contextMenu: {
                    hide: vi.fn(),
                    initialize: vi.fn(),
                    showAt: vi.fn(),
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('shows the editor warning and sends Add it through the shared conversion operation', () => {
        expect(UI_ACTIONS.addPOIToLibraryFromEditor.icon).toEqual({name: 'circle-plus', variant: 'regular'})
        render(<TemporaryPOIWarning poiId={poi.id}/>)

        const warningText = screen.getByText("This POI is temporary and won't be saved. Add it to the library to save it.")
        const addButton = screen.getByText(UI_ACTIONS.addPOIToLibraryFromEditor.label)
        expect(warningText.parentElement.className).toBe('temporary-poi-warning-content')
        expect(addButton.parentElement).toBe(warningText.parentElement)
        fireEvent.click(addButton)

        expect(addPOIToLibrary).toHaveBeenCalledWith(poi.id, {openEditor: false})
    })

    it('removes the editor warning after the POI becomes standard', async () => {
        render(<TemporaryPOIWarning poiId={poi.id}/>)
        poi.type = POI_STANDARD_TYPE

        await waitFor(() => expect(screen.queryByText("This POI is temporary and won't be saved. Add it to the library to save it.")).toBeNull())
        expect(screen.queryByText(UI_ACTIONS.addPOIToLibraryFromEditor.label)).toBeNull()
    })

    it('offers Add for a temporary marker and removes it reactively after conversion', async () => {
        render(<MapPOIContextMenu
            targetId={{id: poi.id}}
            menuRef={{current: null}}
        />)

        fireEvent.click(screen.getByText(UI_ACTIONS.addPOIToLibrary.label))
        expect(addPOIToLibrary).toHaveBeenCalledWith(poi.id)
        expect(__.ui.contextMenu.hide).toHaveBeenCalled()

        poi.type = POI_STANDARD_TYPE
        await waitFor(() => expect(screen.queryByText(UI_ACTIONS.addPOIToLibrary.label)).toBeNull())
    })
})
