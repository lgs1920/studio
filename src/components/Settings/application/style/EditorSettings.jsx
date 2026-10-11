/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: EditorSettings.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-03-31
 * Last modified: 2026-10-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { formatSliderPercent } from '@Components/MainUI/widgets/editor/elements/sliderUtils'
import { WaButton, WaDivider, WaIcon, WaSlider, WaSwitch, WaTooltip } from '@awesome.me/webawesome/dist/react'
import { useSnapshot }                             from 'valtio'

export const EditorSettings = () => {

    const $toolbars = lgs.settings.ui.toolbars
    const toolbars = useSnapshot($toolbars)
    const $journeyToolbar = lgs.settings.ui.journeyToolbar
    const journeyToolbar = useSnapshot($journeyToolbar)

    const switchValue = (event) => {
        if (window.isOK(event)) {
            return event.target.checked
        }
    }

    const setToolbarOpacity = (event) => $toolbars.opacity = event.target.value
    const resetToolbarOpacity = () => {
        $toolbars.opacity = toolbars.defaultOpacity
    }

    return (
        <>
            <span slot="summary">{'Editors Settings'}</span>
            <WaDivider/>
            <div className="journey-editor-settings">
                <WaSwitch size="xs" label-at-start
                          checked={journeyToolbar.usage}
                          onChange={(event) => {
                              $journeyToolbar.usage = switchValue(event)
                              event.preventDefault()
                          }}>
                    {'Add Journey Toolbar'}
                </WaSwitch>
                <div id="toolbars-opacity">
                    {'Floating Toolbars Opacity'}
                    <WaTooltip for="toolbars-opacity-reset">{'Reset to default'}</WaTooltip>
                    <WaButton onClick={resetToolbarOpacity}
                              size="s"
                              appearance="plain" variant="brand">
                        <WaIcon slot="start" name="arrows-rotate" variant="regular" id={'toolbars-opacity-reset'}>
                        </WaIcon>
                    </WaButton>
                    <WaSlider value={toolbars.opacity * 1.0}
                              size="s"
                              label-at-right
                              onInput={setToolbarOpacity}
                              min={0.3} max={1} step={0.05} withTooltip
                              valueFormatter={formatSliderPercent}
                    />
                    </div>
            </div>
        </>
    )
}
