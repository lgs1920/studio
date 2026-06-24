/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: IonTokenSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-23
 * Last modified: 2026-06-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaCallout, WaDetails, WaDivider, WaIcon, WaInput } from '@web.awesome.me/webawesome-pro/dist/react'
import { UIToast }                                                   from '@Utils/UIToast'
import { useRef, useState }                                          from 'react'
import { useSnapshot }                                               from 'valtio'
import './style.css'

const formatUsage = (seconds) => {
    const total = Number(seconds)
    if (!Number.isFinite(total) || total < 0) {
        return '00:00'
    }

    const minutes = Math.floor(total / 60)
    const rest = Math.floor(total % 60)
    return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export const IonTokenSettings = () => {
    const ion = useSnapshot(lgs.stores.ion)
    const tokenRef = useRef(null)
    const [canSave, setCanSave] = useState(false)
    const promptDelaySeconds = Number.isFinite(Number(lgs.configuration?.ion?.promptDelaySeconds))
                                ? Number(lgs.configuration.ion.promptDelaySeconds)
                                : 480
    const activeMode = ion.source === 'user' ? 'personal' : 'standard'

    const handleSave = async () => {
        try {
            await __.ui.ionTokenManager.save(tokenRef.current?.value ?? '')
            if (tokenRef.current) {
                tokenRef.current.value = ''
            }
            setCanSave(false)
            UIToast.success({
                                caption: 'Cesium Ion token',
                                text:    'The personal token was saved.',
                            })
        }
        catch (error) {
            UIToast.error({
                              caption: 'Cesium Ion token',
                              text:    error.message,
                          })
        }
    }

    const handleClear = async () => {
        try {
            await __.ui.ionTokenManager.clear()
            if (tokenRef.current) {
                tokenRef.current.value = ''
            }
            setCanSave(false)
            UIToast.success({
                                caption: 'Cesium Ion token',
                                text:    'The personal token was removed.',
                            })
        }
        catch (error) {
            UIToast.error({
                              caption: 'Cesium Ion token',
                              text:    error.message,
                          })
        }
    }

    return (
        <WaDetails small className={'lgs--details-hoverable'} name="profile-tools">
            <span slot="summary">
                <WaIcon name="cloud" variant="regular"/> {'Cesium Ion'}
            </span>
            <div className="manage-profile-ui ion-token-settings">
                <WaDivider/>
                <WaCallout open variant={activeMode === 'personal' ? 'success' : 'neutral'} appearance="filled-outlined">
                    <WaIcon slot="icon" name={activeMode === 'personal' ? 'circle-check' : 'circle-info'} variant="regular"/>
                    {activeMode === 'personal'
                     ? 'Your personal Cesium Ion token is active.'
                     : `The shared Cesium Ion token is active. Cumulative allowance: ${formatUsage(ion.accumulatedSeconds)} / ${formatUsage(promptDelaySeconds)}.`}
                </WaCallout>

                {activeMode !== 'personal' && (
                    <WaButton
                        appearance="filled"
                        variant="brand"
                        href="https://ion.cesium.com/"
                        target="_blank"
                        rel="noreferrer"
                    >
                        <WaIcon slot="start" name="arrow-up-right-from-square" variant="regular"/>
                        {'Open Cesium Ion'}
                    </WaButton>
                )}

                <WaInput
                    ref={tokenRef}
                    appearance="filled"
                    type="password"
                    password-toggle
                    autocomplete="off"
                    placeholder={'Paste a Cesium Ion token'}
                    onInput={() => {
                        setCanSave((tokenRef.current?.value ?? '').trim() !== '')
                    }}
                />

                <div className="ion-token-settings-actions">
                    <WaButton variant="brand" appearance="outlined" onClick={handleSave} disabled={!canSave}>
                        <WaIcon slot="start" name="check" variant="regular"/>
                        {'Save token'}
                    </WaButton>

                    <WaButton variant="neutral" appearance="outlined" onClick={handleClear} disabled={ion.source !== 'user'}>
                        <WaIcon slot="start" name="trash" variant="regular"/>
                        {'Use default'}
                    </WaButton>
                </div>
            </div>
        </WaDetails>
    )
}
