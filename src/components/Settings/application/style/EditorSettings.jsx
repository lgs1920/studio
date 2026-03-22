/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: EditorSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-22
 * Last modified: 2026-03-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { FAButton }                                from '@Components/FAButton'
import { faArrowsRotate }                          from '@fortawesome/pro-regular-svg-icons'
import { SlDivider, SlRange, SlSwitch, SlTooltip }                    from '@shoelace-style/shoelace/dist/react'
import { WaButton, WaDivider, WaIcon, WaSlider, WaSwitch, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import React, { useEffect }                                           from 'react'
import { useSnapshot }                             from 'valtio'

export const EditorSettings = (props) => {

    const $toolbars = lgs.settings.ui.toolbars
    const toolbars = useSnapshot($toolbars)
    const $journeyToolbar = lgs.settings.ui.journeyToolbar
    const journeyToolbar = useSnapshot($journeyToolbar)

    const switchValue = (event) => {
        if (window.isOK(event)) {
            return event.target.checked
        }
    }

    const toggleUsage = (event) => {

    }
    const setToolbarOpacity = (event) => $toolbars.opacity = event.target.value
    const resetToolbarOpacity = (event) => {
        $toolbars.opacity = toolbars.defaultOpacity
    }

    return (
        <>
            <span slot="summary">{'Editors Settings'}</span>
            <WaDivider/>
            <div className="journey-editor-settings">
                <WaSwitch size="xsmall" label-at-start
                          checked={journeyToolbar.usage}
                          onChange={(event) => {
                              $journeyToolbar.usage = switchValue(event)
                              event.preventDefault()
                          }}>
                    {'Add Journey Toolbar'}
                </WaSwitch>
                <div id="toolbars-opacity">
                    {'Floating Toolbar Opacity'}
                    <WaTooltip for="toolbars-opacity-reset">{'Reset to default'}</WaTooltip>
                    <WaButton onClick={resetToolbarOpacity}
                              size="small"
                              appearance="plain" variant="brand">
                        <WaIcon slot="start" name="arrows-rotate" variant="regular" id={'toolbars-opacity-reset'}>
                        </WaIcon>
                    </WaButton>
                    <WaSlider value={toolbars.opacity * 1.0}
                              size="small"
                              label-at-right
                              onInput={setToolbarOpacity}
                              min={0.3} max={1} step={0.05} withTooltip
                              valueFormatter={(value) => `${Math.round(value * 100)}%`}
                    />
                    </div>
            </div>
        </>
    )
}