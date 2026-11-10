/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SelectLocation.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-01-21
 * Last modified: 2026-11-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    WaCallout, WaCard, WaIcon,
}                                  from '@awesome.me/webawesome/dist/react'
import { UI_ICONS }                from '@Core/ui/metadata/uiActionCatalog'
import { geocodingFeatureLabel }   from '@Core/ui/Geocoder'
import { useLayoutEffect, useRef } from 'react'
import { useSnapshot }             from 'valtio/index'
import { LGSScrollbars }           from '../LGSScrollbars'

export const SelectLocation = ({select}) => {
    const store = lgs.stores.main.components.geocoder
    const snap = useSnapshot(store)
    const scrollbars = useRef(null)

    useLayoutEffect(() => {
        scrollbars.current?.scrollToBottom?.()
    }, [snap.list])

    return (
        <>
            {snap.list.size > 0 &&
                <WaCard appearance="plain" className="select-location-panel">
                    <LGSScrollbars autoHide autoHeight ref={scrollbars}>
                        <div className="select-location-wrapper">
                            {Array.from(snap.list.entries()).map(([key, value]) => (
                                <WaCard
                                    key={key}
                                    appearance="outlined"
                                    className="lgs--card-hoverable select-location-item"
                                    onClick={() => select(key)}
                                >
                                        <span className="select-location-item-label">
                                            {geocodingFeatureLabel(value)}
                                        </span>
                                    <WaIcon name="chevron-right" variant="regular"/>
                                </WaCard>
                            ))}
                        </div>
                    </LGSScrollbars>
                </WaCard>
            }

            {snap.dialog.visible && snap.dialog.noResults &&
                <WaCallout variant="warning" appearance="filled-outlined" open>
                    <WaIcon slot="icon" {...UI_ICONS.warning}/>
                    {'There are no results matching your search!'}
                </WaCallout>
            }
            {snap.dialog.visible && snap.dialog.error &&
                <WaCallout variant="danger" appearance="filled-outlined" open>
                    <WaIcon slot="icon" name="bomb" variant="regular"/>
                    {snap.dialog.error.message}
                </WaCallout>
            }
        </>
    )
}
