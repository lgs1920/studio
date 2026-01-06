/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import React, { useEffect, useMemo, useState } from 'react'
import { useSnapshot }                         from 'valtio'
import { Widget }                              from '@Components/MainUI/widgets/Widget'
import {
    HOUR,
    JOURNEY_WIDGETS,
    LGS_VISUAL_WIDGET,
    SCENE_WIDGETS,
    SCENE_WIDGETS_BOARD,
} from '@Core/constants'
import { Export }                              from '@Core/ui/Export'
import { CHART_ELEVATION_VS_DISTANCE }         from '@Core/ui/Profiler'
import { UIToast }                             from '@Utils/UIToast'
import { ProfileChart }                        from './ProfileChart'
import './style.css'

/**
 * The Profile Widget component displays the elevation profile chart and handles widget configuration.
 * It is designed to support multiple instances with different contexts (e.g., different widget boards).
 *
 * @param {Object} props - Component properties.
 * @param {string} props.id - Unique ID of the widget instance.
 * @param {Object} props.context - Widget rendering context.
 * @param {boolean} props.context.widgetEditor - Indicates if the widget is in edit mode.
 * @param {string} props.context.widgetsBoard - The ID of the board where the widget is rendered.
 * @returns {JSX.Element | null} The Profile Widget or null if context is missing.
 */
export const ProfileWidget = ({id, context}) => {
    // Destructure context properties used as dependencies
    const {widgetEditor, widgetsBoard} = context

    /**
     * Proxy for the profile component state, used to update values.
     * Accessible only inside the component to prevent initial mounting errors.
     * @type {{show: boolean, key: string}}
     */
    const $profile = lgs.stores.main.components.profile
    /**
     * Proxy for the video UI state (example of deep store access).
     * @type {object}
     */
    const $video = lgs.stores.ui.video

    /**
     * Snapshot of the profile state, triggering re-renders on change (e.g., when profile.key changes).
     * @type {{key: string}}
     */
    const profile = useSnapshot($profile)

    /**
     * Snapshot of the video state (included for completeness).
     * @type {object}
     */
    const video = useSnapshot($video)

    /**
     * Snapshot of the unit system state to trigger recalculation on unit changes.
     */
    const $unitStore = lgs.settings.unitSystem
    const unitStore = useSnapshot($unitStore)

    /**
     * State for the container element where the widget should attach.
     * Initialized to the global canvas element (default attach point).
     * @type {[HTMLElement, React.Dispatch<React.SetStateAction<HTMLElement>>]}
     */
    const [container, setContainer] = useState(lgs.canvas)

    /**
     * Updates the container element reference when the widget board changes.
     * If the board is not the main scene board, it looks up the specific board element.
     */
    useEffect(() => {
        if (widgetsBoard && widgetsBoard !== SCENE_WIDGETS_BOARD) {
            // Find the board element using its ID and the 'defined' class for safety
            const element = document.querySelector(`#${widgetsBoard}.defined`)
            if (element) {
                setContainer(element)
            }
        }
    }, [widgetsBoard]) // Re-run only when the board ID changes

    /**
     * Exports the chart content as a PNG image by reading the DOM element.
     */
    const snapshotAsImage = () => {
        const file = `${CHART_ELEVATION_VS_DISTANCE}-${__.app.slugify(
            lgs.theJourney.title,
        )}`
        // Ensure the chart object exists before attempting to export
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
     * Recalculates if profile.key changes (signaling a journey change or reset) or if unit system changes.
     * @returns {object | undefined} The prepared data for the chart.
     */
    const data = useMemo(() => __.ui.profiler?.prepareData(), [profile.key, unitStore.current])

    /**
     * Memoizes the configuration object required for the generic Widget component.
     * This logic determines widget grouping, positioning, and persistence settings based on the context.
     */
    const config = useMemo(() => {
        return {
            container:       container,
            contextMenu:     {
                canReset:    true,
                canEdit:     true,
                canRemove:   true,
                canPosition: true,
            },
            top:             '100%',
            left:            '0px',
            type:            LGS_VISUAL_WIDGET,
            group:        widgetsBoard === SCENE_WIDGETS_BOARD ? SCENE_WIDGETS : JOURNEY_WIDGETS,
            margin:          5,
            attachTo:        'bottom',
            scalable:        true,
            id,
            min: {width: 150},
            max: {width: 900},

            persist:         true,
            transient:       true,
            ttl:             HOUR,
            mandatory:       false,
            stopPropagation: true,
            snap: false,
            widgetsBoard: widgetsBoard,
        }
    }, [widgetEditor, container, widgetsBoard, id]) // Include all dependencies to ensure accurate recalculation

    // Safety check: if the board is missing or the config generation failed, return null.
    // We check Object.keys(config).length for cases where config returned {} inside useMemo.
    if (!widgetsBoard || Object.keys(config).length === 0) {
        return null
    }

    // Render the generic Widget wrapper with the determined config
    return (
        <Widget isVisible={true} config={config}>
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