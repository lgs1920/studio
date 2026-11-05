/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: profile-chart-replay-colors.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-05
 * Last modified: 2026-11-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, render} from '@testing-library/react'
import {proxy} from 'valtio'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const chartState = vi.hoisted(() => ({chart: null}))

vi.mock('@Core/ui/ECharts', () => ({
    echarts: {getInstanceByDom: () => null, init: () => chartState.chart},
}))
vi.mock('@Core/ui/Profiler', () => ({
    DISTANCE: 'Distance', ELEVATION: 'Elevation', TIME: 'Time', POINT: 'point',
    getProfileChartRegistryKey: id => id,
    registerProfileChart: (charts, id, chart) => charts.set(id, chart),
    unregisterProfileChart: (charts, id) => charts.delete(id),
}))
vi.mock('@Components/MainUI/widgets/useWidgetScaleCorrection', () => ({useWidgetScaleCorrection: () => 1}))
vi.mock('@Components/MainUI/widgets/editor/usePreviewChartResize', () => ({usePreviewChartResize: () => {}}))
vi.mock('@Core/ui/ProfileChartResize', () => ({scheduleProfileChartResize: () => {}}))
vi.mock('@Components/Profile/profileCurveGradient', () => ({createProfileCurveGradient: () => document.createElement('canvas')}))
vi.mock('@awesome.me/webawesome/dist/react', () => ({WaIcon: () => <span/>}))

import {ProfileChart} from '@Components/Profile/ProfileChart'
import {renderReplayWidgetFrames} from '@Core/ui/replay/ReplayWidgetFrameRenderers'

const widgetId = 'profile-widget#replay-colors'
const completedId = 'replay-profile-completed-graphic'
const markerId = 'replay-profile-current-marker-graphic'

/** Build a route sample whose distance maps directly to a percentage of the plot. */
const sampleAt = progress => ({distanceFromStart: progress * 1000, altitude: 50, progress})

/** Build the public profile dataset passed to the chart. */
const profileData = () => ({
    dimensions: ['Distance', 'Elevation', 'Time', 'point'],
    dataset: [{id: 'track', source: [[0, 50], [0.5, 75], [1, 50]]}],
    options: [{dataset: 'track', color: '#ffffff', name: 'Route'}],
})

/** Publish a canonical frame without advancing a second playback clock. */
const publishFrame = (kind, progress, sample = sampleAt(progress)) => {
    const phase = {kind, slot: kind}
    const $replay = lgs.stores.replay
    Object.assign($replay, {
        active: true,
        playing: kind === 'replay',
        progress,
        sample,
        replayFramePhase: phase,
        dynamicFrameState: {active: true, playing: kind === 'replay', progress, direction: 1, sample, phase},
    })
}

/** Read the actual graphics prepared by the registered capture renderer. */
const captureGraphics = async () => {
    await act(async () => renderReplayWidgetFrames({widgetKeys: [widgetId]}))
    return chartState.chart.setOption.mock.calls.at(-1)[0].graphic
}

/** Assert that the completed area and line retain their acquired color. */
const expectCompletedColor = (graphics, width) => {
    const completed = graphics.find(graphic => graphic.id === completedId)
    expect(completed.invisible).not.toBe(true)
    expect(completed.clipPath.shape.width).toBe(width)
    expect(completed.children.find(child => child.type === 'polyline').style.stroke).toBe('rgb(249, 115, 22)')
    expect(completed.children.some(child => child.type === 'image')).toBe(true)
}

describe('Profile chart Replay colors', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        const gridRect = {x: 0, y: 0, width: 100, height: 100}
        chartState.chart = {
            setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn(), isDisposed: () => false,
            on: vi.fn(), off: vi.fn(), getWidth: () => 100, getHeight: () => 100,
            getZr: () => ({on: vi.fn(), off: vi.fn(), flush: vi.fn()}),
            convertToPixel: (_, [distance, elevation]) => [distance * 100, 100 - elevation],
            getModel: () => ({
                getComponent: type => type === 'grid'
                    ? {coordinateSystem: {getRect: () => gridRect}}
                    : {axis: {scale: {getExtent: () => [0, type === 'xAxis' ? 1 : 100]}}},
            }),
        }
        const configuration = {
            mainAxis: {thickness: 1}, secondAxis: {thickness: 1},
            xAxis: {}, yAxis: {}, gradient: {show: true}, border: {show: false}, background: {show: false},
        }
        vi.stubGlobal('lgs', {
            settings: {
                widgets: {'profile-widget': {configuration: proxy({default: configuration})}},
                unitSystem: proxy({current: 0}),
                ui: {
                    replay: proxy({progression: {fill: {color: '#f97316'}}}),
                    profile: proxy({liveData: false}),
                },
            },
            stores: {
                replay: proxy({active: false, playing: false, paused: false, direction: 1}),
                main: {components: {profile: proxy({})}},
                ui: {video: {exporting: true}},
            },
        })
        vi.stubGlobal('__', {ui: {profiler: {charts: new Map()}, replay: {}}})
    })

    afterEach(() => {
        cleanup()
        vi.clearAllTimers()
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it('retains completed colors during stop clips and focus while hiding the moving marker', async () => {
        render(<ProfileChart data={profileData()} id={widgetId} basicReplayProfile width={100} height={100}/>)
        publishFrame('replay', 0.5)
        expectCompletedColor(await captureGraphics(), 50)

        publishFrame('post-replay', 1, sampleAt(0.25))
        const stopGraphics = await captureGraphics()
        expectCompletedColor(stopGraphics, 100)
        expect(stopGraphics.find(graphic => graphic.id === markerId).invisible).toBe(true)

        publishFrame('post-replay', 1, sampleAt(0.75))
        lgs.settings.ui.replay.progression.fill.color = '#ffffff'
        expectCompletedColor(await captureGraphics(), 100)

        publishFrame('pre-replay', 0)
        const startGraphics = await captureGraphics()
        expect(startGraphics.find(graphic => graphic.id === completedId).invisible).toBe(true)
        expect(startGraphics.find(graphic => graphic.id === markerId).invisible).toBe(true)

        publishFrame('replay', 0.1)
        const nextReplay = (await captureGraphics()).find(graphic => graphic.id === completedId)
        expect(nextReplay.clipPath.shape.width).toBe(10)
        expect(nextReplay.children.find(child => child.type === 'polyline').style.stroke).toBe('rgb(255, 255, 255)')
    })

    it.each([true, false])('preserves colors through terminal cleanup without stop clips (Basic: %s)', async basicReplayProfile => {
        const data = profileData()
        const view = render(<ProfileChart data={data} id={widgetId} basicReplayProfile={basicReplayProfile} width={100} height={100}/>)
        publishFrame('replay', 1)
        expectCompletedColor(await captureGraphics(), 100)

        Object.assign(lgs.stores.replay, {
            active: false, playing: false, progress: 0, sample: null, replayFramePhase: null, dynamicFrameState: null,
        })
        expectCompletedColor(await captureGraphics(), 100)

        view.rerender(<ProfileChart data={data} id={widgetId} basicReplayProfile={basicReplayProfile} width={200} height={100}/>)
        expectCompletedColor(await captureGraphics(), 100)

        view.rerender(<ProfileChart data={profileData()} id={widgetId} basicReplayProfile={basicReplayProfile} width={200} height={100}/>)
        expect((await captureGraphics()).find(graphic => graphic.id === completedId).invisible).toBe(true)
    })

    it('uses the completed export phase even when the live controller still publishes an earlier sample', async () => {
        render(<ProfileChart data={profileData()} id={widgetId} basicReplayProfile width={100} height={100}/>)
        publishFrame('replay', 0.5)
        expectCompletedColor(await captureGraphics(), 50)
        lgs.stores.replay.deferredExportPlan = {
            runtime: {
                status: 'exporting',
                frameState: {active: true, playing: false, progress: 1, sample: sampleAt(0.2), phase: {kind: 'post-replay'}},
            },
        }
        const graphics = await captureGraphics()
        expectCompletedColor(graphics, 100)
        expect(graphics.find(graphic => graphic.id === markerId).invisible).toBe(true)
    })

    it('keeps the exact completed extent when terminal cleanup precedes the next chart frame', async () => {
        render(<ProfileChart data={profileData()} id={widgetId} basicReplayProfile width={100} height={100}/>)
        publishFrame('replay', 0.5)
        expectCompletedColor(await captureGraphics(), 50)
        __.ui.replay.controller = {progress: 1, direction: 1, running: false, currentSample: () => sampleAt(1)}
        Object.assign(lgs.stores.replay, {
            active: false, playing: false, progress: 0, sample: null, replayFramePhase: null, dynamicFrameState: null,
        })
        const graphics = await captureGraphics()
        expectCompletedColor(graphics, 100)
        expect(graphics.find(graphic => graphic.id === markerId).invisible).toBe(true)
    })

    it('redraws retained colors when the stopped chart finishes a resize', async () => {
        render(<ProfileChart data={profileData()} id={widgetId} basicReplayProfile width={100} height={100}/>)
        publishFrame('replay', 1)
        await captureGraphics()
        publishFrame('post-replay', 1)
        await captureGraphics()
        chartState.chart.getWidth = () => 200
        chartState.chart.convertToPixel = (_, [distance, elevation]) => [distance * 200, 100 - elevation]
        chartState.chart.getModel = () => ({
            getComponent: type => type === 'grid'
                ? {coordinateSystem: {getRect: () => ({x: 0, y: 0, width: 200, height: 100})}}
                : {axis: {scale: {getExtent: () => [0, type === 'xAxis' ? 1 : 100]}}},
        })
        const finished = chartState.chart.on.mock.calls.find(([event]) => event === 'finished')[1]
        await act(async () => finished())
        expectCompletedColor(chartState.chart.setOption.mock.calls.at(-1)[0].graphic, 200)
    })
})
