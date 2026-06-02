/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyToolbarWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-28
 * Last modified: 2026-02-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/


import { Widget } from '@Components/MainUI/widgets/Widget'
import { JOURNEY_TOOLBAR_WIDGET, LGS_TOOLBAR } from '@Core/constants'
import {
    FLYTHROUGH_JOURNEY_TOOLBAR_VISIBILITY_EVENT,
} from '@Core/ui/flythrough/FlythroughMode'
import { JourneyToolbar }    from '@Editor/JourneyToolbar'
import { useEffect, useMemo, useState } from 'react'
import { useSnapshot }       from 'valtio'

/**
 * Component for selecting video quality with draggable toolbar
 * @component
 * @returns {JSX.Element} Draggable video quality selector UI
 */
export const JourneyToolbarWidget = ({id}) => {

    const $journeyEditor = lgs.stores.main.components.journeyEditor
    const journeyEditor = useSnapshot($journeyEditor)

    const $journeyToolbar = lgs.settings.ui.journeyToolbar
    const journeyToolbar = useSnapshot($journeyToolbar)
    const [journeyToolbarTemporarilyHidden, setJourneyToolbarTemporarilyHidden] = useState(
        __.ui.flythrough?.isJourneyToolbarTemporarilyHidden?.() === true,
    )

    // Stabilize config with useMemo
    const config = useMemo(() => {
        return {
            top:         '70%',
            opacity:     lgs.settings.ui.toolbars.opacity,
            left:        '50%',
            attachTo:    'bottom',
            contextMenu: {
                canRemove: true,
            },
            icon:        'route',
            type:        LGS_TOOLBAR,
            id:          id ?? JOURNEY_TOOLBAR_WIDGET,
        }
    }, [id])

    useEffect(() => {
        const syncVisibility = () => {
            setJourneyToolbarTemporarilyHidden(__.ui.flythrough?.isJourneyToolbarTemporarilyHidden?.() === true)
        }

        syncVisibility()
        globalThis.window?.addEventListener?.(FLYTHROUGH_JOURNEY_TOOLBAR_VISIBILITY_EVENT, syncVisibility)
        return () => {
            globalThis.window?.removeEventListener?.(FLYTHROUGH_JOURNEY_TOOLBAR_VISIBILITY_EVENT, syncVisibility)
        }
    }, [])

    return (
        <Widget isVisible={journeyEditor.list.length > 0 && journeyToolbar.show && !journeyToolbarTemporarilyHidden}
                config={config}>
            <JourneyToolbar/>
        </Widget>
    )
}
