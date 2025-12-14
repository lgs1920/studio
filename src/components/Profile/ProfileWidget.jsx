/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-14
 * Last modified: 2025-12-14
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { Widget }                       from '@Components/MainUI/widgets/Widget'
import {
    HOUR,
    JOURNEY_WIDGETS,
    LGS_VISUAL_WIDGET,
    MULTI_PURPOSE_WIDGETS, SCENE_WIDGETS, SCENE_WIDGETS_BOARD,
} from '@Core/constants'
import { Export }                       from '@Core/ui/Export'
import { CHART_ELEVATION_VS_DISTANCE }  from '@Core/ui/Profiler'
import './style.css'
import { UIToast }                      from '@Utils/UIToast'
import { useEffect, useMemo, useState } from 'react'
import { useSnapshot }                  from 'valtio'
import { ProfileChart }                 from './ProfileChart'

export const ProfileWidget = ({id, context}) => {
    const {widgetEditor, widgetsBoard} = context
    const $profile = lgs.stores.main.components.profile
    const profile = useSnapshot($profile)
    const [container, setContainer] = useState(lgs.canvas)

    // Set container when widgetsBoard changes
    useEffect(() => {
        if (widgetsBoard && widgetsBoard !== SCENE_WIDGETS_BOARD) {
            const element = document.querySelector(`#${widgetsBoard}.defined`)
            setContainer(element)
        }
    }, [widgetsBoard])

    const snapshotAsImage = () => {
        const file = `${CHART_ELEVATION_VS_DISTANCE}-${__.app.slugify(
            lgs.theJourney.title,
        )}`
        const chart = __.ui.profiler.charts.get(CHART_ELEVATION_VS_DISTANCE)
        Export.toPNG(chart.getDom(), file).then(() => {
            UIToast.success({
                                caption: `Your chart has been exported successfully !`,
                                text:    `into ${file}.png`,
                            })
        })
    }

    // Set visibility once on mount
    useEffect(() => {
        __.ui.profiler?.setVisibility()
    }, [])

    // Prepare data from track to profile - memoize to avoid recalculation
    const data = useMemo(() => __.ui.profiler?.prepareData(), [profile.key])

    // Memoize widget configuration
    const config = useMemo(() => {
        if (widgetEditor || widgetsBoard === SCENE_WIDGETS_BOARD) {
            return {
                container:       container,
                contextMenu:     {
                    canReset:  true,
                    canEdit:   true,
                    canRemove: true,
                    canPosition: true,
                },
                top:             '100%',
                left:            '0px',
                type:            LGS_VISUAL_WIDGET,
                group:           context?.widgetsBoard === SCENE_WIDGETS_BOARD ? SCENE_WIDGETS : JOURNEY_WIDGETS,
                margin:          5,
                attachTo:        'bottom',
                scalable:        true,
                id,
                persist:         true,
                transient:       true,
                ttl:             HOUR,
                mandatory:       false,
                stopPropagation: true,
                snap:            'svg',

            }
        }
        return {}
    }, [widgetEditor, container])

    return (
        <Widget isVisible={true} config={config}>
            <div key={profile.key}>
                {data &&
                    <div id={`profile-${CHART_ELEVATION_VS_DISTANCE}`} style={{width: '500px', height: '200px'}}>
                        <ProfileChart data={data}
                                      height={__.ui.css.getCSSVariable('--lgs-profile-chart-height')}
                                      width={500}
                        />
                    </div>
                }
            </div>
        </Widget>
    )
}
