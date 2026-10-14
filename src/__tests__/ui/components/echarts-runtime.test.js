/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: echarts-runtime.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-14
 * Last modified: 2026-10-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it} from 'vitest'
import {echarts} from '@Core/ui/ECharts'
import {echarts as echartsCore} from '@Core/ui/EChartsCore'

describe('shared ECharts runtime', () => {
    let chart
    let element

    afterEach(() => {
        chart?.dispose()
        element?.remove()
        chart = null
        element = null
    })

    it('registers chart modules on the shared ECharts core namespace', () => {
        expect(echarts).toBe(echartsCore)
    })

    it.each(['canvas', 'svg'])('renders profile features with the %s renderer', (renderer) => {
        element = document.createElement('div')
        document.body.append(element)
        chart = echarts.init(element, null, {renderer, width: 320, height: 180})

        chart.setOption({
            animation: false,
            dataset:  {source: [[0, 10], [1, 20]]},
            dataZoom: [{type: 'inside'}],
            graphic:  [{id: 'profile-overlay', type: 'line', shape: {x1: 0, y1: 20, x2: 100, y2: 20}}],
            grid:     {left: 0, top: 0, right: 0, bottom: 0},
            xAxis:    {type: 'value'},
            yAxis:    {type: 'value'},
            series:   [{type: 'line', encode: {x: 0, y: 1}, showSymbol: false}],
        })

        const options = chart.getOption()

        const renderedSurface = element.querySelector(renderer === 'svg' ? 'svg' : 'canvas')

        expect(renderedSurface).not.toBeNull()
        if (renderer === 'svg') {
            expect(renderedSurface.querySelector('path')).not.toBeNull()
        }
        expect(options.dataZoom).toHaveLength(1)
        expect(options.graphic[0].elements[0].id).toBe('profile-overlay')
    })
})
