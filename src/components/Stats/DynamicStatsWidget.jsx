/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DynamicStatsWidget.jsx
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

import { JourneyStatsWidget } from '@Components/Stats/JourneyStatsWidget'

export const DynamicStatsWidget = props => (
    <JourneyStatsWidget
        {...props}
        widgetKey="dynamic-stats-widget"
        mode="dynamic"
    />
)
