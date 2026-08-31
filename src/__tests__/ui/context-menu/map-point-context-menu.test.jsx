// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: map-point-context-menu.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-30
 * Last modified: 2026-08-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@Components/MainUI/MapPOI/openPOIEditor', () => ({
    openPOIEditor: vi.fn(),
}))

vi.mock('@Components/MainUI/widgets/openWidgetManagementDrawer', () => ({
    getManageableWidgets: vi.fn(() => []),
    openWidgetManagementDrawer: vi.fn(),
}))

vi.mock('@Core/MapPOI', () => ({
    MapPOI: class {},
}))

vi.mock('@Core/OrbitSettings', () => ({
    getOrbitSettings: vi.fn(() => ({})),
    setOrbitStoreSettings: vi.fn(),
}))

vi.mock('@Utils/UIToast', () => ({
    UIToast: {
        success: vi.fn(),
        warning: vi.fn(),
    },
}))

vi.mock('@Utils/UnitUtils', () => ({
    ELEVATION_UNITS: {metric: 'm'},
    UnitUtils: {
        convert: vi.fn(() => ({to: vi.fn(() => 0)})),
    },
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button {...props}>{children}</button>,
    WaDivider: () => <hr/>,
    WaIcon: ({name}) => <span data-icon={name}/>,
}))

import { MapPointContextMenu } from '@Components/MainUI/context-menu/MapPointContextMenu'

describe('MapPointContextMenu video preparation actions', () => {
    const target = {
        latitude:        48.8566,
        longitude:       2.3522,
        simulatedHeight: 35,
    }

    beforeEach(() => {
        globalThis.lgs = {
            settings: {
                ui: proxy({toolbars: {opacity: 1}}),
                scene: proxy({mode: {value: 3}}),
                coordinateSystem: {current: 'decimal'},
                unitSystem: {current: 'metric'},
            },
            stores: {
                main: {
                    components: {
                        pois: {list: new Map()},
                    },
                },
                ui: proxy({
                    mainUI: {
                        rotate:    {running: false},
                        panorama: {active: false},
                    },
                    video: {
                        editing:     true,
                        preRecording: false,
                        cropper: {
                            presetEditor: false,
                            ratioEditor:  false,
                            widgetEditor: false,
                        },
                    },
                    widget: {
                        list:    new Map(),
                        current: {id: null},
                    },
                }),
            },
            gutter: {xs: 8},
            colors: {poiDefaultBackground: '', poiDefault: ''},
        }
        globalThis.__ = {
            convert: vi.fn(() => ({to: vi.fn(() => '0')})),
            ui: {
                contextMenu: {hide: vi.fn()},
                widgetManager: {
                    getWidgetConfig: vi.fn(() => ({rotate: 0})),
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('shows Resize Video in the Cesium map context menu during preparation', () => {
        render(<MapPointContextMenu target={target} menuRef={{current: null}} hideVideoActions/>)

        const resizeItem = screen.getByText('Resize Video').closest('li')

        expect(resizeItem).not.toBeNull()
        expect(resizeItem?.previousElementSibling?.querySelector('hr')).not.toBeNull()
    })

    it('activates crop editing and selects the crop zone from Resize Video', () => {
        render(<MapPointContextMenu target={target} menuRef={{current: null}} hideVideoActions/>)

        fireEvent.click(screen.getByText('Resize Video'))

        expect(lgs.stores.ui.video.cropper.ratioEditor).toBe(true)
        expect(lgs.stores.ui.video.cropper.presetEditor).toBe(true)
        expect(lgs.stores.ui.video.cropper.resizable).toBe(true)
        expect(lgs.stores.ui.video.cropper.widgetEditor).toBe(true)
        expect(lgs.stores.ui.video.cropper.selectionRequestKey).toBe(1)
        expect(lgs.stores.ui.widget.current.id).toBe('video-crop-zone')
        expect(__.ui.contextMenu.hide).toHaveBeenCalledOnce()
    })

    it('hides Resize Video outside video preparation', () => {
        lgs.stores.ui.video.editing = false

        render(<MapPointContextMenu target={target} menuRef={{current: null}} hideVideoActions/>)

        expect(screen.queryByText('Resize Video')).toBeNull()
    })
})
