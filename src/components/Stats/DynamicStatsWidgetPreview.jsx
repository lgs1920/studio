/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DynamicStatsWidgetPreview.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-02
 * Last modified on: 2026-07-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JourneyStatsWidgetPreview } from '@Components/Stats/JourneyStatsWidgetPreview'

export const DynamicStatsWidgetPreview = props => (
    <JourneyStatsWidgetPreview
        {...props}
        widgetKey="dynamic-stats-widget"
        mode="dynamic"
    />
)
