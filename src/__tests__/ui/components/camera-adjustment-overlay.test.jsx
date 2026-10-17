/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: camera-adjustment-overlay.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-27
 * Last modified: 2026-10-17
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { act, cleanup, render, waitFor } from '@testing-library/react'
import { CameraAdjustmentOverlay } from '@Components/MainUI/CameraAdjustmentOverlay'
import { IMPERIAL, INTERNATIONAL } from '@Utils/UnitUtils'
import { Cartographic, Event } from 'cesium'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

const widgetMock = vi.hoisted(() => ({childRef: null}))
const CAMERA_ADJUSTMENT_HIDE_DELAY = 2000
const initialLgs = globalThis.lgs

vi.mock('@Components/MainUI/widgets/Widget', () => ({
    Widget: ({children, className, childRef, isVisible = true}) => {
        widgetMock.childRef = childRef
        return isVisible ? <div className={className}>{children}</div> : null
    },
}))

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaIcon: ({name, ...props}) => <span data-icon={name} {...props}/>,
    WaTooltip: ({children, for: target}) => <span data-tooltip-for={target}>{children}</span>,
}))

/**
 * Install a physical camera and cached terrain with real Cesium event lifecycles.
 *
 * @param {Object} [options] - Initial camera and terrain values.
 * @param {number} [options.height=1200] - Camera height in meters.
 * @param {number} [options.terrainHeight=350] - Cached terrain height in meters.
 * @param {number} [options.unitSystem=INTERNATIONAL] - Selected unit system.
 * @returns {Object} Camera, terrain and unit preferences exposed to the overlay.
 */
const installCameraTerrain = ({height = 1200, terrainHeight = 350, unitSystem = INTERNATIONAL} = {}) => {
    const camera = {
        changed: new Event(),
        heading: 0,
        pitch: -0.5,
        roll: 0,
        positionCartographic: Cartographic.fromDegrees(5, 45, height),
    }
    const globe = {
        getHeight: vi.fn(() => terrainHeight),
        tileLoadProgressEvent: new Event(),
    }
    const $unitSystem = proxy({current: unitSystem})
    globalThis.lgs = {
        camera,
        viewer: {scene: {globe}},
        settings: {unitSystem: $unitSystem},
        stores: {
            replay: proxy({camera: {cameraAngle: 180}}),
            ui: {video: proxy({editing: false})},
        },
    }
    return {camera, globe, $unitSystem}
}

afterEach(() => {
    cleanup()
    vi.useRealTimers()
    widgetMock.childRef = null
    globalThis.lgs = initialLgs
})

describe('CameraAdjustmentOverlay', () => {
    it.each([
        [INTERNATIONAL, '850 m'],
        [IMPERIAL, '2789 ft'],
    ])('displays the camera clearance in unit system %s', (unitSystem, expected) => {
        const {camera, globe} = installCameraTerrain({unitSystem})
        const view = render(<CameraAdjustmentOverlay visible />)
        const metric = view.getByLabelText('Height above ground')

        expect(metric.textContent.trim()).toBe(expected)
        expect(metric.tabIndex).toBe(0)
        expect(metric.querySelector('[data-icon="ruler-vertical"][variant="regular"]')).not.toBeNull()
        expect(view.container.querySelector('[data-tooltip-for]').getAttribute('data-tooltip-for')).toBe(metric.id)
        expect(globe.getHeight).toHaveBeenCalledWith(camera.positionCartographic)
    })

    it('reformats the current altitude and clearance when the measurement system changes', async () => {
        const {camera, $unitSystem} = installCameraTerrain({height: 1000})
        const view = render(<CameraAdjustmentOverlay />)

        await act(async () => {
            camera.positionCartographic.height = 1200
            camera.changed.raiseEvent()
        })
        expect(view.getByText('1200 m')).toBeTruthy()
        expect(view.getByLabelText('Height above ground').textContent.trim()).toBe('850 m')

        await act(async () => {
            $unitSystem.current = IMPERIAL
        })

        expect(view.getByText('3937 ft')).toBeTruthy()
        expect(view.getByLabelText('Height above ground').textContent.trim()).toBe('2789 ft')
    })

    it.each([undefined, null, NaN, Infinity])('shows an unavailable clearance when terrain height is %s', terrainHeight => {
        const {globe} = installCameraTerrain()
        globe.getHeight.mockReturnValue(terrainHeight)
        const view = render(<CameraAdjustmentOverlay visible />)

        expect(view.getByLabelText('Height above ground').textContent).toBe('—')
    })

    it.each([
        [100, 0, '100 m'],
        [350, 350, '0 m'],
        [100, -450, '550 m'],
    ])('measures a camera at %s meters over terrain at %s meters', (height, terrainHeight, expected) => {
        installCameraTerrain({height, terrainHeight})
        const view = render(<CameraAdjustmentOverlay visible />)

        expect(view.getByLabelText('Height above ground').textContent.trim()).toBe(expected)
    })

    it('refreshes loaded terrain without revealing the overlay and releases its listeners', async () => {
        const {camera, globe} = installCameraTerrain()
        globe.getHeight.mockReturnValue(undefined)
        const view = render(<CameraAdjustmentOverlay />)

        expect(view.getByLabelText('Height above ground').textContent).toBe('—')
        await act(async () => {
            globe.getHeight.mockReturnValue(400)
            globe.tileLoadProgressEvent.raiseEvent(0)
        })

        expect(view.getByLabelText('Height above ground').textContent.trim()).toBe('800 m')
        expect(view.getByLabelText('Height above ground').tabIndex).toBe(-1)
        expect(view.container.querySelector('.adjustment-visible')).toBeNull()

        view.unmount()
        expect(camera.changed.numberOfListeners).toBe(0)
        expect(globe.tileLoadProgressEvent.numberOfListeners).toBe(0)
    })

    it('subscribes after camera initialization and cancels retries on unmount', async () => {
        vi.useFakeTimers()
        const {camera, globe} = installCameraTerrain()
        globalThis.lgs.camera = null
        const view = render(<CameraAdjustmentOverlay visible />)

        expect(view.getByLabelText('Height above ground').textContent).toBe('—')
        await act(async () => {
            globalThis.lgs.camera = camera
            vi.advanceTimersToNextTimer()
        })
        expect(view.getByLabelText('Height above ground').textContent.trim()).toBe('850 m')

        view.unmount()
        expect(camera.changed.numberOfListeners).toBe(0)
        expect(globe.tileLoadProgressEvent.numberOfListeners).toBe(0)
        expect(vi.getTimerCount()).toBe(0)
    })

    it('updates shared orbit and panorama clearance while retaining their visibility control', async () => {
        const {camera} = installCameraTerrain()
        const config = {id: 'panorama-camera-adjustment-widget'}
        const view = render(<CameraAdjustmentOverlay config={config} values={{height: '1200 m'}} />)

        await act(async () => {
            camera.positionCartographic.height = 1500
            camera.changed.raiseEvent()
        })
        expect(view.getByLabelText('Height above ground').textContent.trim()).toBe('1150 m')
        expect(view.container.querySelector('.adjustment-visible')).toBeNull()

        camera.positionCartographic.height = 1600
        view.rerender(<CameraAdjustmentOverlay config={config} values={{height: '1600 m'}} />)
        expect(view.getByLabelText('Height above ground').textContent.trim()).toBe('1250 m')
    })

    it('shares the camera metrics and renders the replay camera angle', () => {
        globalThis.lgs = {
            stores: {
                replay: proxy({
                    userMode: 'expert',
                    camera: {
                        cameraAngle: -30,
                    },
                }),
                ui: {
                    video: proxy({editing: true}),
                },
            },
        }

        const view = render(
            <CameraAdjustmentOverlay
                config={{id: 'camera-adjustment-widget'}}
                isVisible
                values={{height: '1 200 m', level: 'L12', pitch: '-45°'}}
                visible
            />,
        )

        expect(view.container.querySelectorAll('.camera-adjustment-overlay')).toHaveLength(1)
        expect(view.getByText('1 200 m')).toBeTruthy()
        expect(view.getByText('-45°')).toBeTruthy()
        expect(view.getByText('L12')).toBeTruthy()
        const angleMetric = view.getByLabelText('Replay camera angle')
        expect(angleMetric.textContent).toContain('30°')
        expect([...angleMetric.children].map(element => element.tagName)).toEqual(['SPAN', 'STRONG'])
        expect(angleMetric.querySelector('[data-icon="video"]')).not.toBeNull()
        expect(view.container.querySelector('.camera-adjustment-angle-direction')).toBeNull()
    })

    it('hides the replay camera angle outside video preparation', () => {
        globalThis.lgs = {
            stores: {
                replay: proxy({
                    camera: {cameraAngle: -30},
                }),
                ui: {
                    video: proxy({editing: false}),
                },
            },
        }

        const view = render(
            <CameraAdjustmentOverlay
                config={{id: 'camera-adjustment-widget'}}
                isVisible
                values={{height: '1 200 m', level: 'L12', pitch: '-45°'}}
                visible
            />,
        )

        expect(view.queryByLabelText('Replay camera angle')).toBeNull()
    })

    it('shows the replay camera angle in Basic Replay preparation', () => {
        globalThis.lgs = {
            stores: {
                replay: proxy({
                    userMode: 'basic',
                    camera: {cameraAngle: -30},
                }),
                ui: {
                    video: proxy({editing: true}),
                },
            },
        }

        const view = render(
            <CameraAdjustmentOverlay
                config={{id: 'camera-adjustment-widget'}}
                isVisible
                values={{height: '1 200 m', level: 'L12', pitch: '-45°'}}
                visible
            />,
        )

        expect(view.getByLabelText('Replay camera angle').textContent).toContain('-30°')
    })

    it('hides the Replay camera angle metric during linked Replay dry run', () => {
        globalThis.lgs = {
            stores: {
                replay: proxy({
                    active: true,
                    recordingSync: true,
                    userMode: 'expert',
                    camera: {cameraAngle: -30},
                }),
                ui: {
                    video: proxy({
                        editing: true,
                        preRecording: false,
                        exporting: false,
                        snapshot: false,
                        finalizing: false,
                    }),
                },
            },
        }

        const view = render(
            <CameraAdjustmentOverlay
                config={{id: 'camera-adjustment-widget'}}
                isVisible
                values={{height: '1 200 m', level: 'L12', pitch: '-45°'}}
                visible
            />,
        )

        expect(view.getByText('1 200 m')).toBeTruthy()
        expect(view.queryByLabelText('Replay camera angle')).toBeNull()
    })

    it('does not display a separate Ahead or Behind direction', () => {
        globalThis.lgs = {
            stores: {
                replay: proxy({
                    userMode: 'expert',
                    camera: {
                        cameraAngle: 30,
                    },
                }),
                ui: {
                    video: proxy({editing: true}),
                },
            },
        }

        const view = render(
            <CameraAdjustmentOverlay
                config={{id: 'camera-adjustment-widget'}}
                isVisible
                values={{height: '1 200 m', level: 'L12', pitch: '-45°'}}
                visible
            />,
        )

        expect(view.getByLabelText('Replay camera angle').textContent).toContain('30°')
        expect(view.container.querySelector('.camera-adjustment-angle-direction')).toBeNull()
    })

    it('shows the widget after any camera change', async () => {
        const cameraChangedListeners = []
        globalThis.lgs = {
            camera: {
                heading: 0,
                pitch: -0.5,
                roll: 0,
                positionCartographic: {height: 1000, latitude: 2, longitude: 1},
                changed: {
                    addEventListener: listener => {
                        cameraChangedListeners.push(listener)
                        return () => {}
                    },
                },
            },
            scene: {},
            settings: {unitSystem: proxy({current: 'metric'})},
            stores: {
                replay: proxy({camera: {cameraAngle: 180}}),
                ui: {video: proxy({preRecording: false})},
            },
        }

        const view = render(
            <CameraAdjustmentOverlay
                config={{id: 'camera-adjustment-widget'}}
                isVisible
                values={{height: '1 000 m', level: 'L12', pitch: '-29°'}}
            />,
        )

        await act(async () => {
            globalThis.lgs.camera.positionCartographic.height = 1200
            cameraChangedListeners.forEach(listener => listener())
        })

        await waitFor(() => {
            expect(view.container.querySelector('.camera-adjustment-widget-shell.adjustment-visible')).not.toBeNull()
            expect(view.getByText('1200')).toBeTruthy()
        })
    })

    it('keeps the overlay visible while dragging and restarts its timer after release', async () => {
        vi.useFakeTimers()
        const cameraChangedListeners = []
        globalThis.lgs = {
            camera: {
                heading: 0,
                pitch: -0.5,
                roll: 0,
                positionCartographic: {height: 1000, latitude: 2, longitude: 1},
                changed: {
                    addEventListener: listener => {
                        cameraChangedListeners.push(listener)
                        return () => {}
                    },
                },
            },
            scene: {},
            settings: {unitSystem: proxy({current: 'metric'})},
            stores: {
                replay: proxy({camera: {cameraAngle: 180}}),
                ui: {video: proxy({preRecording: false})},
            },
        }

        const view = render(
            <CameraAdjustmentOverlay
                config={{id: 'camera-adjustment-widget'}}
                isVisible
                values={{height: '1 000 m', level: 'L12', pitch: '-29°'}}
            />,
        )

        globalThis.lgs.camera.positionCartographic.height = 1200
        await act(async () => cameraChangedListeners.forEach(listener => listener()))
        expect(view.container.querySelector('.camera-adjustment-widget-shell.adjustment-visible')).not.toBeNull()

        await act(async () => widgetMock.childRef.current.onDragStart())
        await act(async () => vi.advanceTimersByTime(CAMERA_ADJUSTMENT_HIDE_DELAY))
        expect(view.container.querySelector('.camera-adjustment-widget-shell.adjustment-visible')).not.toBeNull()

        await act(async () => widgetMock.childRef.current.onDragEnd())
        await act(async () => vi.advanceTimersByTime(CAMERA_ADJUSTMENT_HIDE_DELAY - 1))
        expect(view.container.querySelector('.camera-adjustment-widget-shell.adjustment-visible')).not.toBeNull()

        await act(async () => vi.advanceTimersByTime(1))
        expect(view.container.querySelector('.camera-adjustment-widget-shell.adjustment-visible')).toBeNull()
    })
})
