/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: IonTokenSettings.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaCallout, WaDetails, WaDivider, WaIcon, WaInput } from '@web.awesome.me/webawesome-pro/dist/react'
import { UIToast } from '@Utils/UIToast'
import { useRef, useState } from 'react'
import { useSnapshot } from 'valtio'
import './style.css'

/**
 * Renders provider-level Cesium Ion credential settings.
 * @returns {JSX.Element} The credential settings panel.
 */
export const IonTokenSettings = () => {
    const ion = useSnapshot(lgs.stores.ion)
    const tokenRef = useRef(null)
    const [canSave, setCanSave] = useState(false)
    const hasToken = ion.source === 'user'

    /**
     * Saves the token entered in the password field.
     * @returns {Promise<void>} A promise that resolves after the save attempt.
     */
    const handleSave = async () => {
        try {
            await __.ui.ionTokenManager.save(tokenRef.current?.value ?? '')
            if (tokenRef.current) {
                tokenRef.current.value = ''
            }
            setCanSave(false)
            UIToast.success({
                                caption: 'Cesium Ion token',
                                text:    'The provider token was saved.',
                            })
        }
        catch (error) {
            UIToast.error({
                              caption: 'Cesium Ion token',
                              text:    error?.message ?? String(error),
                          })
        }
    }

    /**
     * Removes the provider token and falls back to non-Ion defaults.
     * @returns {Promise<void>} A promise that resolves after the clear attempt.
     */
    const handleClear = async () => {
        try {
            await __.ui.ionTokenManager.clear()
            if (tokenRef.current) {
                tokenRef.current.value = ''
            }
            setCanSave(false)
            UIToast.success({
                                caption: 'Cesium Ion token',
                                text:    'The provider token was removed.',
                            })
        }
        catch (error) {
            UIToast.error({
                              caption: 'Cesium Ion token',
                              text:    error?.message ?? String(error),
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
                <WaCallout open variant={hasToken ? 'success' : 'neutral'} appearance="filled-outlined">
                    <WaIcon slot="icon" name={hasToken ? 'circle-check' : 'circle-info'} variant="regular"/>
                    {hasToken
                     ? 'A provider-level Cesium Ion token is available for Ion layers.'
                     : 'Cesium Ion is optional. Add a personal token when you select an Ion layer.'}
                </WaCallout>

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

                    <WaButton variant="neutral" appearance="outlined" onClick={handleClear} disabled={!hasToken}>
                        <WaIcon slot="start" name="trash" variant="regular"/>
                        {'Remove token'}
                    </WaButton>
                </div>
            </div>
        </WaDetails>
    )
}
