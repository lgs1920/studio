import { useConfirm } from '@Components/Modals/ConfirmUI'
import {
    ACCESS_ICONS, FREE_ACCOUNT_ACCESS, FREE_ANONYMOUS_ACCESS, FREEMIUM_ACCESS, LAYERS_THUMBS_DIR, LOCKED_ACCESS,
    OVERLAY_ENTITY, PREMIUM_ACCESS, TERRAIN_ENTITY, UNLOCKED_ACCESS, VAULT_STORE,
}                     from '@Core/constants'

import {
    faArrowDownUpLock, faArrowUpRightFromSquare, faCircleCheck, faEllipsisVertical, faFilter, faLock, faTrashCan,
    faTriangleExclamation,
}                          from '@fortawesome/pro-duotone-svg-icons'
import {
    FontAwesomeIcon,
}                          from '@fortawesome/react-fontawesome'
import {
    SlAlert, SlButton, SlDropdown, SlIcon, SlIconButton, SlMenu, SlMenuItem, SlTooltip,
}                          from '@shoelace-style/shoelace/dist/react'
import { FA2SL }           from '@Utils/FA2SL'
import parse               from 'html-react-parser'
import React, { Fragment } from 'react'

import { useSnapshot }                   from 'valtio'
import { DEFAULT_LAYERS_COLOR_SETTINGS } from '../../../core/constants'
import { LayersUtils }                   from '../../../Utils/cesium/LayersUtils'


export const SelectEntity = (props) => {

    const thumbnailBackground = image => `url("${LAYERS_THUMBS_DIR}/${image}")`

    const layers = lgs.settings.layers
    const layersSnap = useSnapshot(layers)
    const editor = lgs.editorSettingsProxy
    const snap = useSnapshot(editor)

    const title = sprintf(`Remove Token ?`)
    const message = () => {
        return (<>{`Are you sure you want to remove this access ?`}</>)
    }
    const [ConfirmRemoveTokenDialog, confirmRemoveToken] = useConfirm(title, message,
                                                                      {icon: faTrashCan, text: 'Remove'})
    const ThumbnailMenu = (props) => {
        const theEntity = props.entity
        const snapEntity = useSnapshot(theEntity)

        const handleSelect = async (event) => {
            switch (event.detail.item.value) {
                case 'remove':
                    const confirmation = await confirmRemoveToken()
                    if (confirmation) {
                        // Update layersSnap and vault DBs
                        theEntity.usage.token = ''
                        theEntity.usage.unlocked = false
                        await lgs.db.vault.put(theEntity.id, theEntity.usage.token, VAULT_STORE)
                    }
                    break
                case
                'update':
                    lgs.editorlayersSnapProxy.layer.tmpEntity = theEntity
                    lgs.editorlayersSnapProxy.layer.tokenDialog = true
                    break
                case
                'read':
                    if (theEntity.usage.doc) {
                        window.open(theEntity.usage.doc, '_blank')
                    }
                    break
            }
        }

        return (
            <div key={props.selected}
                 className={['thumbnail-toolbar', 'lgs-ui-toolbar', 'lgs-ui-dropdown-toolbar', props.mode, props.icons ? 'just-icons' : ''].join(' ')}>
                <SlDropdown hoist placement={'left-start'}>
                    <SlIconButton small className={'dropdown-trigger-icon selected-entity-menu'} slot="trigger"
                                  onShow={(event) => event.preventDefault()}
                                  library="fa" name={FA2SL.set(faEllipsisVertical)}/>

                    <SlMenu onSlSelect={handleSelect}>
                        {props.entity.id !== layersSnap[props.entity.type] &&
                            <SlMenuItem value={'remove'} key={'remove-entity'}>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faLock)}></SlIcon>
                                Remove Token
                            </SlMenuItem>
                        }
                        <SlMenuItem value={'update'} key={'update-entity'}>
                            <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowDownUpLock)}></SlIcon>
                            Update Token
                        </SlMenuItem>
                        {snapEntity.usage.doc &&
                            <SlMenuItem value={'read'} key={'read-entity-doc'}>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowUpRightFromSquare)}></SlIcon>
                                Read Doc
                            </SlMenuItem>
                        }
                    </SlMenu>
                </SlDropdown>
            </div>

        )
    }

    const Thumbnail = (props) => {
        const theEntity = __.layersAndTerrainManager.getEntityProxy(props.entity.id)

        const accountType = theEntity.usage.type

        const accountUnlocked = theEntity.usage.type === FREE_ANONYMOUS_ACCESS || (theEntity.usage.unlocked ?? false)
        const type = accountUnlocked ? UNLOCKED_ACCESS : accountType

        let selected = false
        if (accountUnlocked) {
            selected = theEntity.id === layersSnap[theEntity.type]
        }

        const classes = ['layer-entity', 'lgs-card', type]
        if (selected) {
            classes.push('entity-selected')
        }

        const byProvider = layers.filter.provider ? '' : sprintf(' %s %s', 'by', props.entity.providerName)
        //On thumbnail mode, we use \ as line separator
        const theEntityName = layers.filter.thumbnail ? props.entity.name.replace('\\', '<br/>') : props.entity.name.replace('\\', ' ')

        return (

            <SlTooltip className={`entity-${type}`} placement={layersSnap.filter.thumbnail ? 'top' : 'left'} hoist>
                <div slot="content">
                    <strong>{parse(theEntityName)}</strong>{byProvider}<br/>
                    {ACCESS_ICONS[type].text}
                </div>
                <div className={classes.join(' ')} onClick={props.onClick} type={theEntity.type} name={theEntity.id}>
                    <div className={`thumbnail-background${layersSnap.filter.thumbnail ? '' : ' lgs-card'}`}
                         style={{backgroundImage: thumbnailBackground(props.entity.image)}}>
                    </div>


                    {// Show the name
                        <div className={'entity-name'}>
                            {parse(theEntityName)}
                        </div>
                    }


                    { // green check box for the current entity
                        selected &&
                        <div className={'entity-checkbox'}>
                            <FontAwesomeIcon icon={faCircleCheck}/>
                        </div>
                    }


                    { // show the entity access type
                        (theEntity.usage.type === PREMIUM_ACCESS
                            || theEntity.usage.type === FREEMIUM_ACCESS
                            || theEntity.usage.type === FREE_ACCOUNT_ACCESS)
                        &&
                        <div className={['entity-access', type, theEntity.usage.type].join(' ')}>
                            <SlIcon slot="prefix" library="fa"
                                    name={FA2SL.set(ACCESS_ICONS[theEntity.usage.type].icon)}/>
                        </div>
                    }

                    { // show the lock
                        theEntity.usage.type !== FREE_ANONYMOUS_ACCESS && !accountUnlocked &&
                        <div className={['entity-lock-status', type].join(' ')}>
                            <SlIcon slot="prefix" library="fa"
                                    name={FA2SL.set(ACCESS_ICONS[LOCKED_ACCESS].icon)}/>
                        </div>
                    }

                    { // Show the thumbnail
                        (theEntity.usage.type === PREMIUM_ACCESS
                            || theEntity.usage.type === FREEMIUM_ACCESS
                            || theEntity.usage.type === FREE_ACCOUNT_ACCESS) && accountUnlocked &&
                        <ThumbnailMenu entity={theEntity}/>
                    }

                </div>
            </SlTooltip>
        )
    }


    const list = props.list
    list.map((entity, index) => {
        entity.providerName = __.layersAndTerrainManager.providers.get(entity.provider).name
        list[index] = entity
    })

    const selectEntityHandler = (event) => {
        const type = event.target.getAttribute('type')
        const id = event.target.getAttribute('name')

        if (type === null || id === null) {
            return
        }
        const theEntity = __.layersAndTerrainManager.getALayer(id)
        if (theEntity.usage.type === FREE_ANONYMOUS_ACCESS) {
            // We're on a free access, so we can select it.
            lgs.settings.layers[type] =
                // Clicking on the same overlay will deselect it
                (type === OVERLAY_ENTITY && lgs.settings.layers[type] === id) ? '' : id
        }
        else {
            // We need to know if  the account has been unlocked
            const theProxy = __.layersAndTerrainManager.getEntityProxy(id)
            // If not unlocked, we launch the dialog else select it
            if (theProxy.usage.unlocked) {
                lgs.settings.layers[type] =
                    // Clicking on the same overlay will deselect it
                    (type === OVERLAY_ENTITY && lgs.settings.layers[type] === id) ? '' : id
                editor.layer.tokenDialog = false
            }
            else {
                editor.layer.tmpEntity = theProxy
                editor.layer.tokenDialog = true
            }
        }

        // We need to apply color layersSnap
        editor.layer.layersSnapChanged = false
        if (layers.colorSettings[theEntity.id] === undefined) {
            layers.colorSettings[theEntity.id] = {...DEFAULT_LAYERS_COLOR_SETTINGS}
        }

        LayersUtils.applySettings(layers.colorSettings[theEntity.id] ?? DEFAULT_LAYERS_COLOR_SETTINGS, type, true)

        // If it is a free or unlocked terrain , replace the current one
        if (theEntity.type === TERRAIN_ENTITY && (theEntity.usage.type === FREE_ANONYMOUS_ACCESS || theEntity.usage.unlocked)) {
            __.layersAndTerrainManager.changeTerrain(theEntity)
        }

    }
    editor.layer.refreshList = true
    const fill = list.length > 0
    let classes = ['layer-entities-wrapper', 'lgs-card']
    classes.push(layersSnap.filter.provider ? 'by-provider' : 'by-layer')
    classes.push(layersSnap.filter.thumbnail ? 'by-thumbnail' : 'by-list')

    return (
        <>
            {
                fill &&
                <div className={classes.join(' ')}>
                    {list.map((entity, index) => {
                        let previousProviderName = index > 0 ? list[index - 1].providerName : null
                        return (
                            <Fragment key={index}>
                                {   // If the user want to see providers and
                                    layersSnap.filter.provider &&
                                    // if there is a new provider, let's show it's name
                                    entity.providerName && entity.providerName !== previousProviderName &&
                                    <div className="layers-provider-header">
                                        <span className={'provider-name'}>{entity.providerName}</span>
                                    </div>
                                }
                                <Thumbnail entity={entity} key={entity.name} onClick={selectEntityHandler}/>
                            </Fragment>
                        )
                    })}
                </div>
            }

            {!fill &&
                <SlAlert variant="warning" open>
                    <SlIcon slot="icon" library="fa" name={FA2SL.set(faTriangleExclamation)}/>
                    <div id="filter-alert-content">
                        {'It looks empty over here!'}<br/>{'Check your filter criteria.'}
                        {!snap.openFilter &&
                            <SlButton small onClick={() => editor.openFilter = true}>
                                <SlIcon library="fa" slot="prefix" name={FA2SL.set(faFilter)}/>
                                {'Open'}
                            </SlButton>
                        }
                    </div>
                </SlAlert>
            }
            <ConfirmRemoveTokenDialog/>
        </>

    )

}