/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CompassFull }                                                from '@Components/MainUI/compass/CompassFull'
import { CompassLight }                                    from '@Components/MainUI/compass/CompassLight'
import { CompassWindRose }                                            from '@Components/MainUI/compass/CompassWindRose'
import {
    COMPASS_FULL,
    COMPASS_LIGHT,
    COMPASS_WIDGET,
    COMPASS_WIND_ROSE,
    EDIT_WIDGET_ICON,
    MULTI_PURPOSE_WIDGETS,
    NO_COMPASS,
    SCENE_WIDGETS_BOARD,
    WIDGET_EDITOR_POST_RENDER_EVENT,
    WIDGET_EDITOR_PRE_RENDER_EVENT,
    WIDGETS_EDITOR_DRAWER,
}                                                          from '@Core/constants'
import { WaButton, WaDivider, WaIcon, WaOption, WaSelect } from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback }                                     from 'react'
import { useSnapshot }                                     from 'valtio'

const GLOBAL_COMPASS_EDITOR_ENTITY = `${COMPASS_WIDGET}#global-settings`
const OPEN_COMPASS_SETTINGS_ACTION = 'open-compass-settings'

export const CompassSettings = () => {

    const settings = useSnapshot(lgs.settings.ui.compass)

    const setCompassMode = (event) => {
        const mode = Number(event.target.value)
        lgs.settings.ui.compass.mode = Number.isFinite(mode) ? mode : event.target.value
    }

    const openCompassWidgetEditor = useCallback(async () => {
        const entity = GLOBAL_COMPASS_EDITOR_ENTITY
        __.ui.drawerManager.tab = 'tab-ui'
        lgs.stores.ui.drawers.action = OPEN_COMPASS_SETTINGS_ACTION
        lgs.stores.ui.widget.currentSnapshot = null

        __.ui.widgetCache.set(entity, {
            group:        MULTI_PURPOSE_WIDGETS,
            widgetsBoard: SCENE_WIDGETS_BOARD,
        })

        window.dispatchEvent(new CustomEvent(WIDGET_EDITOR_PRE_RENDER_EVENT, {
            detail: {entity},
        }))
        __.ui.drawerManager.open(WIDGETS_EDITOR_DRAWER, {
            action:  'edit-global-compass',
            entity,
            stacked: true,
        })
        window.dispatchEvent(new CustomEvent(WIDGET_EDITOR_POST_RENDER_EVENT, {
            detail: {entity},
        }))
    }, [])

    return (
        <>
            <span slot="summary">{'Compass Settings'}</span>
            <WaDivider/>
            <div className="compass-settings">
                <div className="compass-settings-row">
                    <WaSelect id="compass-selector-settings"
                              size="small"
                              name="compassSelector"
                              label="Type"
                              label-at-start
                              value={settings.mode.toString()}
                              onChange={setCompassMode}>
                        <WaIcon slot="start" size="small" variant="regular" name="compass"/>
                        <WaOption value={NO_COMPASS.toString()} label="None">{'None'}</WaOption>
                        <WaOption value={COMPASS_FULL.toString()} label="Full">
                            <span slot="start" className="compass-select-thumbnail">
                                <CompassFull width="24" height="24"/>
                            </span>
                            {'Full'}
                        </WaOption>
                        <WaOption value={COMPASS_LIGHT.toString()} label="Light">
                            <span slot="start" className="compass-select-thumbnail">
                                <CompassLight width="24" height="24"/>
                            </span>
                            {'Light'}
                        </WaOption>
                        <WaOption value={COMPASS_WIND_ROSE.toString()} label="Rose">
                            <span slot="start" className="compass-select-thumbnail">
                                <CompassWindRose width="24" height="24"/>
                            </span>
                            {'Rose'}
                        </WaOption>
                    </WaSelect>
                    <WaButton id="edit-compass-widget-in-settings" appearance="plain" variant="brand"
                              onClick={openCompassWidgetEditor}>
                        <WaIcon slot="start" variant="regular" name={EDIT_WIDGET_ICON}/>
                        {'Edit'}
                    </WaButton>
                </div>
            </div>
        </>
    )
}
