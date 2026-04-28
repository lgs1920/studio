/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-20
 * Last modified: 2026-04-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Widget }                                                                       from '@Components/MainUI/widgets/Widget'
import { HOUR, JOURNEY_WIDGETS, LGS_VISUAL_WIDGET, SCENE_WIDGETS, SCENE_WIDGETS_BOARD } from '@Core/constants'
import { Export }                                                                       from '@Core/ui/Export'
import { CHART_ELEVATION_VS_DISTANCE }                                                  from '@Core/ui/Profiler'
import { UIToast }                                                                      from '@Utils/UIToast'
import React, { useEffect, useMemo, useState }                                          from 'react'
import { useSnapshot }                                                                  from 'valtio'
import { ProfileChart }                                                                 from './ProfileChart'
import './style.css'

/**
 * The Profile Widget component displays the elevation profile chart and handles widget configuration.
 *
 * @param {Object} props - Component properties.
 * @param {string} props.id - Unique ID of the widget instance.
 * @param {Object} props.context - Widget rendering context.
 * @returns {JSX.Element | null}
 */
export const ProfileWidget = ({id, context, zIndex, widgetsBoard: persistedWidgetsBoard}) => {
    /**
     * Early return if the journey is not defined to avoid unnecessary computations
     */
    if (!lgs.theJourney) {
        return null
    }

    const contextState = useSnapshot(context ?? {widgetEditor: false, widgetsBoard: ''})
    const widgetEditor = contextState.widgetEditor
    const widgetsBoard = contextState.widgetsBoard || persistedWidgetsBoard || ''

    /**
     * Proxy and Snapshot for the profile component state.
     */
    const $profile = lgs.stores.main.components.profile
    const profile = useSnapshot($profile)

    /**
     * Proxy and Snapshot for the video UI state.
     */
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    /**
     * Proxy and Snapshot for the unit system.
     */
    const $unitStore = lgs.settings.unitSystem
    const unitStore = useSnapshot($unitStore)

    /**
     * State for the container element where the widget should attach.
     */
    const [container, setContainer] = useState(lgs.canvas)

    /**
     * Updates the container element reference when the widget board changes.
     */
    useEffect(() => {
        const element = __.ui.widgetManager.resolveWidgetsBoardContainer(widgetsBoard)
        if (element) {
            setContainer(element)
        }
    }, [widgetsBoard])

    /**
     * Exports the chart content as a PNG image.
     */
    const snapshotAsImage = () => {
        const file = `${CHART_ELEVATION_VS_DISTANCE}-${__.app.slugify(
            lgs.theJourney.title,
        )}`

        const chart = __.ui.profiler?.charts.get(CHART_ELEVATION_VS_DISTANCE)
        if (chart) {
            Export.toPNG(chart.getDom(), file).then(() => {
                UIToast.success({
                                    caption: `Your chart has been exported successfully !`,
                                    text:    `into ${file}.png`,
                                })
            })
        }
    }

    /**
     * Sets the visibility state within the global profiler utility once on mount.
     */
    useEffect(() => {
        __.ui.profiler?.setVisibility()
    }, [])

    /**
     * Prepares and memoizes the data required for the profile chart.
     */
    const data = useMemo(() => __.ui.profiler?.prepareData(), [profile.key, unitStore.current])

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
            stopPropagation: true,
            snap:        false,
            widgetsBoard: widgetsBoard,
            zIndex:      zIndex,
        }
    }, [widgetEditor, container, widgetsBoard, id, zIndex])

    if (!widgetsBoard || Object.keys(config).length === 0) {
        return null
    }

    return (
        <Widget isVisible={true} config={config} key={lgs.theJourney.slug}>
            {data &&
                <ProfileChart data={data}
                              id={id}
                              height={__.ui.css.getCSSVariable('--lgs-profile-chart-height')}
                              width={profile.width}
                />
            }
        </Widget>
    )
}
