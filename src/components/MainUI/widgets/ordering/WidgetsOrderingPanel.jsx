/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetsOrderingPanel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-13
 * Last modified: 2026-02-13
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetsOrderingPanel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-12
 * Last modified: 2026-02-13
 *
 ******************************************************************************/

import {
    WidgetsOrderingPanelContent,
}                                                   from '@Components/MainUI/widgets/ordering/WidgetsOrderingPanelContent'
import { Widget }                                   from '@Components/MainUI/widgets/Widget'
import { HOUR, LGS_VISUAL_WIDGET, VIDEO_CROP_ZONE } from '@Core/constants'
import React, { useEffect, useMemo }                from 'react'
import { useSnapshot }                              from 'valtio'

/**
 * Panel for ordering widgets.
 * Restricted drag handle to prevent conflicts between panel movement and item sorting.
 */
export const WidgetsOrderingPanel = ({id, context, groups}) => {
    const {widgetEditor} = useSnapshot(context)

    useEffect(() => {
        if (!Array.isArray(groups)) {
            groups = [groups]
        }
    }, [groups])

    const config = useMemo(() => {
        return {
            container:   lgs.canvas,
            contextMenu: {
                canReset:    true,
                canPosition: true,
                canRemove:   false,
                canResize:   false,
            },
            top:         '10%',
            left:        '90%',
            type:        LGS_VISUAL_WIDGET,
            attachTo:    'top-right',
            scalable:    false,
            id,
            persist:     true,
            transient:   true,
            dynamic:     true,
            ttl:         HOUR,
            margin:      0,
            handle:      '.widget-deck-title',
        }
    }, [id])

    const handleInteraction = (e) => {
        // Stop events from bubbling up to the map or other global draggables
        e.stopPropagation()
    }

    if (!widgetEditor) {
        return null
    }

    return (
        <div
            onMouseDown={handleInteraction}
            onTouchStart={handleInteraction}
            className="lgs-widget-ordering-wrapper"
        >
            <Widget isVisible={true} config={config}>
                <WidgetsOrderingPanelContent groups={groups} widgetsBoard={VIDEO_CROP_ZONE}/>
            </Widget>
        </div>
    )
}