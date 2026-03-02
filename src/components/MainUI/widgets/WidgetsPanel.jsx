/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetsPanel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-20
 * Last modified: 2026-02-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Compass } from '@Components/MainUI/compass/Compass'
import { Widget }  from '@Components/MainUI/widgets/Widget'
import { WidgetsPanelContent }                            from '@Components/MainUI/widgets/WidgetsPanelContent'
import { HOUR, LGS_VISUAL_WIDGET, MULTI_PURPOSE_WIDGETS } from '@Core/constants'
import React, { useEffect, useMemo, useState }            from 'react'
import { useSnapshot }                                    from 'valtio'

export const WidgetsPanel = ({id, context, groups}) => {
    // Get snapshot of context
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
            left:        '10%',
            type:        LGS_VISUAL_WIDGET,
            attachTo:    'top-left',
            scalable:    false,
            id,
            persist:     true,
            transient:   true,
            dynamic:     true,
            ttl:         HOUR,
            margin:      0,
        }
    }, [])

    // Render only when widgetEditor is true and container is defined
    if (!widgetEditor) {
        return null
    }

    return (
        <Widget isVisible={true} config={config}>
            <WidgetsPanelContent groups={groups}/>
        </Widget>
    )
}