/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TokenLayerModal.jsx
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

import { BASE3D_ENTITY, BASE_ENTITY, PERSONAL_ACCESS, TERRAIN_ENTITY, TILES3D_ENTITY, VAULT_STORE } from '@Core/constants'
import { UIToast }                                                                    from '@Utils/UIToast'
import { WaBadge, WaButton, WaDialog, WaIcon, WaInput }                               from '@web.awesome.me/webawesome-pro/dist/react'
import parse                                                                          from 'html-react-parser'
import { useEffect, useState }                                                         from 'react'
import { useSnapshot }                                                                 from 'valtio'
import { applyLayerSelection }                                                         from './layerSelection'

const closeTokenModal = () => {
    lgs.editorSettingsProxy.layer.tokenDialog = false
}

export const TokenLayerModal = () => {
    const snap = useSnapshot(lgs.editorSettingsProxy)
    const tmpEntity = snap.layer.tmpEntity
    const [tokenValue, setTokenValue] = useState('')
    const [canSave, setCanSave] = useState(false)

    useEffect(() => {
        if (!tmpEntity) {
            return
        }

        if (tmpEntity.usage.type === PERSONAL_ACCESS) {
            window.queueMicrotask(() => {
                setTokenValue('')
                setCanSave(false)
            })
            return
        }

        lgs.db.vault.get(tmpEntity.id, VAULT_STORE).then(value => {
            const nextValue = value ?? ''
            setTokenValue(nextValue)
            setCanSave(nextValue.trim() !== '')
        })
    }, [tmpEntity])

    if (!tmpEntity) {
        return null
    }

    const accountUrl = tmpEntity.usage?.signin
                       ? `<a href="${tmpEntity.usage.signin}" target="_blank">here</a>`
                       : null
    const docUrl = tmpEntity.usage?.doc
                   ? `<a href="${tmpEntity.usage.doc}" target="_blank">See documentation</a>`
                   : null
    const provider = __.layersAndTerrainManager.getProviderProxyByEntity(tmpEntity.id, tmpEntity.type)
    const providerUrl = provider?.url ? `<a href="${provider.url}" target="_blank">Visit Provider</a>` : null

    const validateToken = async () => {
        const token = tokenValue.trim()
        if (!token) {
            return
        }

        const proxy = __.layersAndTerrainManager.getEntityProxy(tmpEntity.id)
        if (!proxy) {
            return
        }

        try {
            if (proxy.usage.type === PERSONAL_ACCESS) {
                await __.ui.ionTokenManager.save(token)
            }
            else {
                await lgs.db.vault.put(proxy.id, token, VAULT_STORE)
                proxy.usage.token = token
                proxy.usage.unlocked = true
            }

            if (proxy.type === BASE_ENTITY) {
                lgs.stores.main.theLayer = proxy
            }
            else if (proxy.type === BASE3D_ENTITY) {
                lgs.stores.main.theBase3DLayer = proxy
            }
            else if (proxy.type === TILES3D_ENTITY) {
                lgs.stores.main.theTiles3DLayer = proxy
            }
            else {
                lgs.stores.main.theLayerOverlay = proxy
            }

            applyLayerSelection({
                                    entity:         proxy,
                                    layersSnapshot: lgs.settings.layers,
                                    layersProxy:    lgs.settings.layers,
                                    forceSelect:    true,
                                })

            if (proxy.type === TERRAIN_ENTITY) {
                __.layersAndTerrainManager.changeTerrain(proxy)
            }

            lgs.editorSettingsProxy.layer.tokenDialog = false
            setCanSave(false)

            UIToast.success({
                                caption: `Access for ${tmpEntity?.name} is allowed!`,
                                text:    'Enjoy!',
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
        <WaDialog
            label={`Requesting access for ${tmpEntity?.name}`}
            open={snap.layer.tokenDialog}
            onWaAfterHide={closeTokenModal}
            className={'lgs-theme'}
        >
            <div>
                {tmpEntity.usage.type !== PERSONAL_ACCESS && accountUrl &&
                    <p><WaBadge pill>1</WaBadge> {'Create an account on the provider site'} {parse(accountUrl)}.</p>
                }
                <p><WaBadge pill>{tmpEntity.usage.type === PERSONAL_ACCESS ? '1' : '2'}</WaBadge> {'Get Token/Api key and paste it below.'}</p>
                <p>
                    <WaInput
                        appearance="filled"
                        placeholder={'Paste Token/API key'}
                        type="password"
                        password-toggle
                        clearable
                        onInput={(event) => {
                            const nextValue = event?.target?.value ?? ''
                            setTokenValue(nextValue)
                            setCanSave(nextValue.trim() !== '')
                        }}
                        passwordToggle
                        autocomplete
                        value={tokenValue}
                    />
                </p>
                <p><WaBadge pill>3</WaBadge> {'Validate.'}</p>
                <br/>
                {docUrl && <>{parse(docUrl)} - </>}
                {providerUrl && parse(providerUrl)}
            </div>
            <div className="buttons-bar" slot="footer">
                <WaButton onClick={() => {
                    lgs.editorSettingsProxy.layer.tokenDialog = false
                }} appearance="outlined">
                    <WaIcon slot="start" name="xmark" variant="regular"/>
                    {'Cancel'}
                </WaButton>
                <WaButton variant="brand" onClick={validateToken} disabled={!canSave}>
                    <WaIcon slot="start" name="check" variant="regular"/>
                    {'Validate'}
                </WaButton>
            </div>
        </WaDialog>
    )
}
