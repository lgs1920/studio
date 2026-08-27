import { act, render, waitFor } from '@testing-library/react'
import { CameraAdjustmentOverlay } from '@Components/MainUI/CameraAdjustmentOverlay'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

const widgetMock = vi.hoisted(() => ({childRef: null}))
const CAMERA_ADJUSTMENT_HIDE_DELAY = 2000

vi.mock('@Components/MainUI/widgets/Widget', () => ({
    Widget: ({children, className, childRef, isVisible = true}) => {
        widgetMock.childRef = childRef
        return isVisible ? <div className={className}>{children}</div> : null
    },
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaIcon: ({name, ...props}) => <span data-icon={name} {...props}/>,
}))

vi.mock('@Utils/FA2SL', () => ({
    FA2SL: {
        set: icon => icon?.iconName ?? `${icon ?? ''}`,
    },
}))

afterEach(() => {
    vi.useRealTimers()
    widgetMock.childRef = null
    globalThis.lgs = undefined
})

describe('CameraAdjustmentOverlay', () => {
    it('shares the camera metrics and renders the replay Behind angle', () => {
        globalThis.lgs = {
            stores: {
                replay: proxy({
                    camera: {
                        headingOffset: -30,
                        positionMode:  'behind',
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
        expect([...angleMetric.children].map(element => element.tagName)).toEqual(['SL-ICON', 'STRONG', 'SPAN'])
        const direction = view.container.querySelector('.camera-adjustment-angle-direction')
        expect(direction?.dataset.direction).toBe('behind')
        expect(direction?.dataset.icon).toBe('caret-up')
    })

    it('hides the replay camera angle outside video preparation', () => {
        globalThis.lgs = {
            stores: {
                replay: proxy({
                    camera: {headingOffset: -30, positionMode: 'behind'},
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

    it('renders an upward solid chevron for the replay Ahead angle', () => {
        globalThis.lgs = {
            stores: {
                replay: proxy({
                    camera: {
                        headingOffset: 30,
                        positionMode:  'ahead',
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

        const direction = view.container.querySelector('.camera-adjustment-angle-direction')
        expect(direction?.dataset.direction).toBe('ahead')
        expect(direction?.dataset.icon).toBe('caret-down')
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
                replay: proxy({camera: {headingOffset: 0, positionMode: 'system'}}),
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
        cameraChangedListeners[0]()

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
                replay: proxy({camera: {headingOffset: 0, positionMode: 'system'}}),
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
        await act(async () => cameraChangedListeners[0]())
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
