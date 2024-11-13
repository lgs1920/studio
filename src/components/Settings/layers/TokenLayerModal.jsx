import { BASE_LAYERS, VAULT_STORE }                        from '@Core/constants'
import { faCheck, faEye, faEyeSlash, faTrashCan, faXmark } from '@fortawesome/pro-regular-svg-icons'
import { SlBadge, SlButton, SlDialog, SlIcon, SlInput }    from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                           from '@Utils/FA2SL'
import parse                                               from 'html-react-parser'
import { useRef }                                          from 'react'
import { useSnapshot }                                     from 'valtio'
import { UIToast }                                         from '../../../Utils/UIToast'


export const TokenLayerModal = (props) => {

    const editor = lgs.editorSettingsProxy
    const snap = useSnapshot(editor)

    const layers = lgs.settings.layers
    const layersSnap = useSnapshot(layers)

    const openTokenModal = () => editor.layer.tokenDialog = true
    const closeTokenModal = () => editor.layer.tokenDialog = false

    const apikey = useRef('')
    const validate = useRef(null)

    if (!snap.layer.tmpEntity) {
        return ('')
    }

    const accountUrl = sprintf('<a href="%s" target="_blank">%s</a>', snap.layer.tmpEntity.usage?.signin, snap.layer.tmpEntity.usage?.signin)
    const docUrl = sprintf('<a href="%s" target="_blank">%s</a>', snap.layer.tmpEntity.usage?.doc, 'See documentation')
    const provider = __.layerManager.getProviderProxy(__.layerManager.getProviderIdByLayerId(snap.layer.tmpEntity.id))
    const providerUrl = sprintf('<a href="%s" target="_blank">%s</a>', provider.url, 'Visit Provider')

    const handleChange = (event) => {
        editor.layer.tmpEntity.usage.token = apikey.current.value
        editor.canValidate = (apikey.current.value !== '')
    }

    const validateToken = async () => {
        if (apikey.current.value) {
            await lgs.db.vault.put(snap.layer.tmpEntity.id, apikey.current.value, VAULT_STORE)
            const tmp = __.layerManager.getLayerProxy(snap.layer.tmpEntity.id)

            tmp.usage.token = apikey.current.value
            tmp.usage.unlocked = true

            if (tmp.type === BASE_LAYERS) {
                lgs.mainProxy.theLayer = tmp
            }
            else {
                lgs.mainProxy.theLayerOverlay = tmp
            }

            // Set by default
            lgs.settings.layers[snap.layer.tmpEntity.type] = snap.layer.tmpEntity.id

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


    return (
        <>
            <SlDialog label={sprintf('Requesting access for %s', snap.layer.tmpEntity?.name)}
                      open={snap.layer.tokenDialog}
                      onSlRequestClose={closeTokenModal}
                      className={'lgs-theme'}>

                <div>
                    <ol className={'authent-tasks-list'}>
                        <li key={'1'}><span><SlBadge pill>1</SlBadge></span>
                            <div>{'Create an account on'}<br/>{parse(accountUrl)}</div>
                        </li>
                        <li key={'2'}><span><SlBadge pill>2</SlBadge></span>
                            <div>
                                {`Get Token/Api key and paste it here.`}
                                <SlInput placeholder={'Paste Token/API key'} type="password"
                                         ref={apikey} password-toggle clearable
                                         onSlInput={handleChange}
                                         autocomplete
                                         value={snap.layer.tmpEntity.usage.token ?? ''}>
                                    <SlIcon slot="show-password-icon" library="fa" name={FA2SL.set(faEye)}/>
                                    <SlIcon slot="hide-password-icon" library="fa" name={FA2SL.set(faEyeSlash)}/>
                                    <SlIcon slot="clear-icon" library="fa" name={FA2SL.set(faTrashCan)}/>
                                </SlInput>
                            </div>
                        </li>
                        <li key={'3'}><SlBadge pill>3</SlBadge> {`Validate.`}
                        </li>
                    </ol>
                    {snap.layer.tmpEntity.usage.doc &&
                        <>{parse(docUrl)} - </>
                    }
                    {parse(providerUrl)}
                </div>
                <div className="buttons-bar" slot="footer">
                    <SlButton onClick={closeTokenModal}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faXmark)}></SlIcon>
                        {'Cancel'}
                    </SlButton>
                    <SlButton variant="primary" onClick={validateToken} ref={validate} disabled={!snap.canValidate}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faCheck)}></SlIcon>
                        {'Validate'}
                    </SlButton>
                </div>
            </SlDialog>
        </>
    )
}

