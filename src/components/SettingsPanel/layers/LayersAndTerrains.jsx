import { BASE_LAYERS, OVERLAY_LAYERS, TERRAIN_LAYERS, VAULT_STORE }      from '@Core/constants'
import { faCheck, faCircleInfo, faEye, faEyeSlash, faTrashCan, faXmark } from '@fortawesome/pro-regular-svg-icons'
import { SlBadge, SlButton, SlDialog, SlIcon, SlInput }                  from '@shoelace-style/shoelace/dist/react'
import parse                                                             from 'html-react-parser'
import { useRef }                                                        from 'react'
import { default as ReactMarkdown }                                      from 'react-markdown'
import { useSnapshot }                                                   from 'valtio'
import { FA2SL }                                                         from '../../../Utils/FA2SL'
import infoText                                                          from './info-layer.md'
import { SelectEntity }                                                  from './SelectEntity'
import { SelectLayerType }                                               from './SelectLayerType'


export const LayersAndTerrains = () => {

    const settings = lgs.settingsEditorProxy
    const snap = useSnapshot(settings)

    const bases = []
    const overlays = []
    const terrains = []

    const sortByProvider = (a, b) => {
        return a.provider.localeCompare(b.provider)
    }

    // Build base and overlays list
    __.layerManager.layers.forEach(layer => {
        if (layer.type === 'base') {
            bases.push(layer)
        }
        else {
            overlays.push(layer)
        }
    })

    const openInfoModal = () => lgs.settingsEditorProxy.layerInfoDialog = true
    const closeInfoModal = () => lgs.settingsEditorProxy.layerInfoDialog = false
    const InfoLayerModal = () => {
        return (
            <SlDialog label={'Important Notice'}
                      open={snap.layerInfoDialog}
                      onSlRequestClose={closeInfoModal}
                      className={'lgs-theme'}>
                <ReactMarkdown children={infoText}/>

                <SlButton slot="footer" variant="primary" onClick={closeInfoModal}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faCheck)}/>
                    Close
                </SlButton>
            </SlDialog>
        )
    }

    const openTokenModal = () => lgs.settingsEditorProxy.layerTokenDialog = true
    const closeTokenModal = () => lgs.settingsEditorProxy.layerTokenDialog = false
    const TokenLayerModal = (props) => {

        const apikey = useRef('')
        const validate = useRef(null)

        if (!snap.tmpEntity) {
            return ('')
        }
        const accountUrl = sprintf('<a href="%s" target="_blank">%s</a>', snap.tmpEntity.usage?.signin, snap.tmpEntity.usage?.signin)
        const docUrl = sprintf('<a href="%s" target="_blank">%s</a>', snap.tmpEntity.usage?.doc, 'See documentation')
        const provider = __.layerManager.getProviderProxy(__.layerManager.getProviderIdByLayerId(snap.tmpEntity.id))
        const providerUrl = sprintf('<a href="%s" target="_blank">%s</a>', provider.url, 'Visit Provider')

        const setAPIKey = (event) => {
            // TODO :creer l'element, recuperer le timestamp, l'utiliser  créer la clé de cryptage, sauver apikey
            // cryptée TODO  lire timestamp creation, crerr la clé de cryptage, lire et decrypter apikey

            //TODO filtre sur entity free
            // Filtre surnom entity
        }

        //Read Token if it exists and put it in the right place
        lgs.db.vault.get(snap.tmpEntity.id, VAULT_STORE).then(value => {
            settings.tmpEntity.usage.token = value ?? ''
            apikey.current.value = settings.tmpEntity.usage.token
        })
        const validateToken = async () => {
            await lgs.db.vault.put(snap.tmpEntity.id, apikey.current.value, VAULT_STORE)
            const tmp = __.layerManager.getLayerProxy(snap.tmpEntity.id)
            const valued = apikey.current.value.length > 0

            tmp.usage.token = apikey.current.value
            tmp.usage.unlocked = valued

            if (tmp.type === BASE_LAYERS) {
                lgs.mainProxy.theLayer = tmp
            }
            else {
                lgs.mainProxy.theLayerOverlay = tmp
            }

            if (valued) {
                // Set by default
                lgs.settings.layers[snap.tmpEntity.type] = snap.tmpEntity.id
            }
        }

        return (
            <>
                <SlDialog label={sprintf('Requesting access for %s', snap.tmpEntity?.name)}
                          open={snap.layerTokenDialog}
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
                                             onSlInput={setAPIKey} autocomplete
                                             value={settings.tmpEntity.usage.token ?? ''}>
                                        <SlIcon slot="show-password-icon" library="fa" name={FA2SL.set(faEye)}/>
                                        <SlIcon slot="hide-password-icon" library="fa" name={FA2SL.set(faEyeSlash)}/>
                                        <SlIcon slot="clear-icon" library="fa" name={FA2SL.set(faTrashCan)}/>
                                    </SlInput>
                                </div>
                            </li>
                            <li key={'3'}><SlBadge pill>3</SlBadge> {`Validate.`}
                            </li>
                        </ol>
                        {snap.tmpEntity.usage.doc &&
                            <>{parse(docUrl)} - </>
                        }
                        {parse(providerUrl)}
                    </div>
                    <div className="buttons-bar" slot="footer">
                        <SlButton onClick={closeTokenModal}>
                            <SlIcon slot="prefix" library="fa" name={FA2SL.set(faXmark)}></SlIcon>
                            {'Cancel'}
                        </SlButton>
                        <SlButton variant="primary"
                                  onClick={validateToken} ref={validate}
                        >
                            <SlIcon slot="prefix" library="fa" name={FA2SL.set(faCheck)}></SlIcon>
                            {'Validate'}
                        </SlButton>
                    </div>
                </SlDialog>
            </>
        )
    }

    return (
        <>
            <div id="layers-and-terrains-settings">
                <div id="layers-and-terrains-settings-header">
                    <SelectLayerType/>
                    <SlButton onClick={openInfoModal}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faCircleInfo)}/>
                        {'Info'}
                    </SlButton>
                    <InfoLayerModal/>
                    <TokenLayerModal/>
                </div>

                <div>
                    {snap.layers.selectedType === BASE_LAYERS &&
                    <SelectEntity list={bases.sort(sortByProvider)}/>
                    }
                    {snap.layers.selectedType === OVERLAY_LAYERS &&
                        <SelectEntity list={overlays.sort(sortByProvider)}/>
                    }
                    {snap.layers.selectedType === TERRAIN_LAYERS &&
                        <SelectEntity list={terrains.sort(sortByProvider)}/>
                    }
            </div>

            </div>
        </>
    )
}