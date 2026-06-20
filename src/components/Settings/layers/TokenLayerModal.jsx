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

import { BASE_ENTITY, TERRAIN_ENTITY, VAULT_STORE } from '@Core/constants'
import { UIToast }                                      from '@Utils/UIToast'
import { WaBadge, WaButton, WaDialog, WaIcon, WaInput } from '@web.awesome.me/webawesome-pro/dist/react'
import parse                                            from 'html-react-parser'
import { useRef }                                   from 'react'
import { useSnapshot }                              from 'valtio'


export const TokenLayerModal = (props) => {

    const editor = lgs.editorSettingsProxy
    const snap = useSnapshot(editor)

    const layers = lgs.settings.layers

    const openTokenModal = () => editor.layer.tokenDialog = true
    const closeTokenModal = () => editor.layer.tokenDialog = false

    const apikey = useRef('')
    const validate = useRef(null)

    if (!snap.layer.tmpEntity) {
        return ('')
    }

    const accountUrl = sprintf('<a href="%s" target="_blank">%s</a>', snap.layer.tmpEntity.usage?.signin, 'here')
    const docUrl = sprintf('<a href="%s" target="_blank">%s</a>', snap.layer.tmpEntity.usage?.doc, 'See documentation')
    const provider = __.layersAndTerrainManager.getProviderProxy(__.layersAndTerrainManager.getProviderIdByLayerId(snap.layer.tmpEntity.id))
    const providerUrl = sprintf('<a href="%s" target="_blank">%s</a>', provider.url, 'Visit Provider')

    const handleChange = (event) => {
        editor.layer.tmpEntity.usage.token = apikey.current.value
        editor.canValidate = (apikey.current.value !== '')
    }

    const validateToken = async () => {
        if (apikey.current.value) {
            await lgs.db.vault.put(snap.layer.tmpEntity.id, apikey.current.value, VAULT_STORE)
            const tmp = __.layersAndTerrainManager.getEntityProxy(snap.layer.tmpEntity.id)

            tmp.usage.token = apikey.current.value
            tmp.usage.unlocked = true

            if (tmp.type === BASE_ENTITY) {
                lgs.stores.main.theLayer = tmp
            }
            else {
                lgs.stores.main.theLayerOverlay = tmp

                // Set by default
                lgs.settings.layers[snap.layer.tmpEntity.type] = snap.layer.tmpEntity.id

                // Terrain ? Replace the current one
                if (snap.layer.tmpEntity.type === TERRAIN_ENTITY) {
                    __.layersAndTerrainManager.changeTerrain(snap.layer.tmpEntity)
                }

                // Close Dialog
                editor.layer.tokenDialog = false
                editor.canValidate = false

                // Add a notification
                UIToast.success({
                                    caption: sprintf('Access for %s is allowed!', snap.layer.tmpEntity?.name),
                                    text:    'Enjoy!',
                                })
            }
        }


        //Read Token in vault DB if it exists and put it in the right place
        if (snap.layer.tmpEntity && apikey.current.value === undefined) {
            lgs.db.vault.get(snap.layer.tmpEntity.id, VAULT_STORE).then(value => {
                editor.layer.tmpEntity.usage.token = value ?? ''
                apikey.current.value = snap.layer.tmpEntity.usage.token
            })
        }
        editor.canValidate = (apikey.current.value !== '')
    }

    return (
        <>
            <WaDialog label={sprintf('Requesting access for %s', snap.layer.tmpEntity?.name)}
                      open={snap.layer.tokenDialog}
                      onWaAfterHide={closeTokenModal}
                      className={'lgs-theme'}>

                <div>
                    <p><WaBadge pill>1</WaBadge> {'Create an account on the provider site'} {parse(accountUrl)}.</p>
                    <p><WaBadge pill>2</WaBadge> {'Get Token/Api key and paste it below.'}</p>
                    <p><WaInput appearance="filled" placeholder={'Paste Token/API key'} type="password"
                                ref={apikey} password-toggle
                                clearable
                                onInput={handleChange}
                                passwordToggle
                                autocomplete
                                value={snap.layer.tmpEntity.usage.token ?? ''}>
                    </WaInput>
                    </p>
                    <p><WaBadge pill>3</WaBadge> {`Validate.`}</p>
                    <br/>
                    {snap.layer.tmpEntity.usage.doc &&
                        <>{parse(docUrl)} - </>
                    }
                    {parse(providerUrl)}
                </div>
                <div className="buttons-bar" slot="footer">
                    <WaButton onClick={closeTokenModal} appearance="outlined">
                        <WaIcon slot="start" name="xmark" variant="regular"/>
                        {'Cancel'}
                    </WaButton>
                    <WaButton variant="brand" onClick={validateToken} ref={validate} disabled={!snap.canValidate}>
                        <WaIcon slot="start" name="check" variant="regular"/>
                        {'Validate'}
                    </WaButton>
                </div>
            </WaDialog>
        </>
    )
}