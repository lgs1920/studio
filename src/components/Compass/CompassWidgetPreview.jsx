/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassWidgetPreview.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-29
 * Last modified: 2026-04-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Compass }       from '@Components/MainUI/compass/Compass'

/**
 * Preview component for Journey Stats.
 * Simplified version focusing strictly on the widget display.
 */
export const CompassWidgetPreview = ({entity}) => {
    return (
        <div className="compass-widget-preview">
            <Compass fixed inWidget entity={entity} syncBounds={false}/>
        </div>
    )
}
