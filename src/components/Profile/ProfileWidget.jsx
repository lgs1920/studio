/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Widget }                                                                       from '@Components/MainUI/widgets/Widget'
import { HOUR, JOURNEY_WIDGETS, LGS_VISUAL_WIDGET, SCENE_WIDGETS, SCENE_WIDGETS_BOARD } from '@Core/constants'
import { useOptionalSnapshot } from '@Utils/ValtioUtils'
import { useEffect, useMemo }  from 'react'
import { useSnapshot }                                                                  from 'valtio'
import { ProfileChart }                                                                 from './ProfileChart'
import './style.css'

const PROFILE_WIDGET_CONTEXT_FALLBACK = {widgetEditor: false, widgetsBoard: ''}

/**
 * The Profile Widget component displays the elevation profile chart and handles widget configuration.
 *
 * @param {Object} props - Component properties.
 * @param {string} props.id - Unique ID of the widget instance.
 * @param {Object} props.context - Widget rendering context.
 * @returns {JSX.Element | null}
 */
export const ProfileWidget = ({id, context, zIndex, widgetsBoard: persistedWidgetsBoard}) => {
    const contextState = useOptionalSnapshot(context, PROFILE_WIDGET_CONTEXT_FALLBACK)
    const journey = lgs.theJourney
    const widgetsBoard = contextState.widgetsBoard || persistedWidgetsBoard || ''

    /**
     * Proxy and Snapshot for the profile component state.
     */
    const $profile = lgs.stores.main.components.profile
    const profile = useSnapshot($profile)

    /**
     * Proxy and Snapshot for the unit system.
     */
    const $unitStore = lgs.settings.unitSystem
    const unitStore = useSnapshot($unitStore)
    const widgetListSnapshot = useSnapshot(lgs.stores.ui.widget.list)

    /**
     * State for the container element where the widget should attach.
     */
    const container = useMemo(() => __.ui.widgetManager.resolveWidgetsBoardContainer(widgetsBoard) ?? lgs.canvas, [widgetsBoard])

    /**
     * Sets the visibility state within the global profiler utility once on mount.
     */
    useEffect(() => {
        __.ui.profiler?.setVisibility()
    }, [])

    /**
     * Prepares and memoizes the data required for the profile chart.
     */
    const data = useMemo(() => journey ? __.ui.profiler?.prepareData() : null, [journey, profile.key, unitStore.current])
    const hasAltitudeData = useMemo(() => {
        return data?.dataset?.some(dataset => Array.isArray(dataset.source) && dataset.source.length > 0) ?? false
    }, [data])
    const isLocked = Boolean(
        widgetListSnapshot.get(id)?.locked
        ?? __.ui.widgetManager.getWidgetConfig(id)?.locked,
    )

    /**
     * Memoizes the configuration object for the Widget component.
     */
    const config = useMemo(() => {
        return {
            container:   container,
            contextMenu: {
                canReset:    true,
                canEdit:     true,
                canRemove:   true,
                canPosition: true,
                canSnapshot: true,
            },
            top:         '100%',
            left:        '0px',
            type:        LGS_VISUAL_WIDGET,
            group:        widgetsBoard === SCENE_WIDGETS_BOARD ? SCENE_WIDGETS : JOURNEY_WIDGETS,
            attachTo:    'bottom',
            scalable:    true,
            id,
            min:         {width: 150},
            max:         {width: 900},
            persist:         true,
            transient:       true,
            ttl:             HOUR,
            mandatory:       false,
            stopPropagation: false,
            snap:        false,
            widgetsBoard: widgetsBoard,
            zIndex:      zIndex,
        }
    }, [container, id, widgetsBoard, zIndex])

    if (!journey || !widgetsBoard || Object.keys(config).length === 0 || !hasAltitudeData) {
        return null
    }

    return (
        <Widget isVisible={true} config={config} key={journey.slug}>
            {data &&
                <ProfileChart data={data}
                              id={id}
                              height={profile.height}
                              locked={isLocked}
                              width={profile.width}
                />
            }
        </Widget>
    )
}
