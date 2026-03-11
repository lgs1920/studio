/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WelcomeModal.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-11
 * Last modified: 2026-03-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaDivider, WaInput, WaNumberInput, WaSwitch } from '@web.awesome.me/webawesome-pro/dist/react'
import React                                           from 'react'
import { useSnapshot }                  from 'valtio'

/**
 * WelcomeModal component manages UI preferences via valtio proxy.
 * Ensure lgs.stores.editorSettings is initialized as a proxy.
 */
export const WelcomeModal = (props) => {
    const $welcome = lgs.settings.ui.welcome
    const welcome = useSnapshot($welcome)

    return (
        <>
            <span slot="summary">{'Welcome Modal'}</span>
            <WaDivider/>
            <WaSwitch
                size="xsmall"
                label-at-start
                checked={welcome.showIntro}
                onChange={(event) => {
                    $welcome.showIntro = event.target.checked
                }}>
                {'Show Introduction'}
            </WaSwitch>

            {welcome.showIntro &&
                <>
                    <WaSwitch
                        size="xsmall"
                        label-at-start
                        checked={welcome.autoClose}
                        onChange={(event) => {
                            $welcome.autoClose = event.target.checked
                        }}>
                        {'Auto Close'}
                    </WaSwitch>

                    {welcome.autoClose &&
                        <WaNumberInput
                            className="lgs--short-input lgs--no-margin"
                            label-at-start no-start
                            min="5" max="30"
                            size="small"
                            value={welcome.displayTime}
                            appearance="filled"
                            onInput={(event) => {
                                $welcome.displayTime = event.target.value
                            }}>
                            <div slot="label">{'Display Time (seconds)'}</div>
                            <div slot="suffix">{'s'}</div>
                        </WaNumberInput>
                    }
                </>
            }
        </>
    )
}