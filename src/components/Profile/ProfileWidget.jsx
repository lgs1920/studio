/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-13
 * Last modified: 2025-12-13
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { Widget }                       from '@Components/MainUI/widgets/Widget'
import {
    HOUR,
    JOURNEY_WIDGETS,
    LGS_VISUAL_WIDGET,
    MULTI_PURPOSE_WIDGETS, SCENE_WIDGETS,
}                                       from '@Core/constants'
import { Export }                       from '@Core/ui/Export'
import { CHART_ELEVATION_VS_DISTANCE }  from '@Core/ui/Profiler'
import './style.css'
import { UIToast }                      from '@Utils/UIToast'
import { useEffect, useMemo, useState } from 'react'
import { useSnapshot }                  from 'valtio'
import { ProfileChart }                 from './ProfileChart'

export const ProfileWidget = ({id, context}) => {
    // Context is a plain object, not a Valtio proxy - use it directly
    const widgetEditor = context?.widgetEditor ?? false
    const cropZone = context?.cropZone ?? ''

    const $profile = lgs.stores.main.components.profile
    const profile = useSnapshot($profile)
    const [_container, setContainer] = useState(null)

    // Set container when cropZone changes
    useEffect(() => {
        if (cropZone) {
            const element = document.querySelector(`#${cropZone}.defined`)
            setContainer(element)
        }
    }, [cropZone])

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
        if (widgetEditor) {
            return {
                container:       _container,
                contextMenu:     {
                    canReset:  true,
                    canEdit:   true,
                    canRemove: true,
                },
                top:             '100%',
                left:            '0px',
                type:            LGS_VISUAL_WIDGET,
                group:           _container ? JOURNEY_WIDGETS : SCENE_WIDGETS,
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
    }, [widgetEditor, _container])

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
