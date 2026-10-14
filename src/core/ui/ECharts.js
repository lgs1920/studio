/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ECharts.js
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

import {echarts as echartsCore} from './EChartsCore'
import {LineChart} from 'echarts/charts'
import {
    DataZoomInsideComponent,
    DatasetComponent,
    GraphicComponent,
    GridComponent,
    TitleComponent,
    TooltipComponent,
} from 'echarts/components'
import {CanvasRenderer, SVGRenderer} from 'echarts/renderers'

echartsCore.use([
    LineChart,
    DataZoomInsideComponent,
    DatasetComponent,
    GraphicComponent,
    GridComponent,
    TitleComponent,
    TooltipComponent,
    CanvasRenderer,
    SVGRenderer,
])

/**
 * Shared ECharts core API with the chart modules used by profile rendering.
 */
export const echarts = echartsCore
