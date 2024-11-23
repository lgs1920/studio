import { useConfirm }                 from '@Components/Modals/ConfirmUI'
import {
    ACCESS_ICONS, FREE_ACCOUNT_ACCESS, FREE_ANONYMOUS_ACCESS, FREEMIUM_ACCESS, LAYERS_THUMBS_DIR, LOCKED_ACCESS,
    OVERLAY_LAYERS, PREMIUM_ACCESS, UNLOCKED_ACCESS,
}                                     from '@Core/constants'
import {
    faFilter, faTrashCan,
}                                     from '@fortawesome/pro-regular-svg-icons'
import {
    faArrowDownUpLock, faArrowUpRightFromSquare, faCircleCheck, faEllipsisVertical, faLock, faTriangleExclamation,
}                                     from '@fortawesome/pro-solid-svg-icons'
import {
    SlAlert, SlButton, SlDropdown, SlIcon, SlIconButton, SlMenu, SlMenuItem,
}                                     from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                      from '@Utils/FA2SL'
import React, { Fragment, useEffect } from 'react'

import { useSnapshot } from 'valtio'


export const SelectEntity = (props) => {

    const thumbnailBackground = image => `url("${LAYERS_THUMBS_DIR}/${image}")`

    let settings = useSnapshot(lgs.settings.layers)
    const editor = lgs.editorSettingsProxy
    const snap = useSnapshot(editor)

    const Message = () => {
        return (<>{`Are you sure you want to remove this access ?`}</>)
    }
    const [ConfirmRemoveTokenDialog, confirmRemoveToken] = useConfirm(`Remove Token ?`, Message,
                                                                      {icon: faTrashCan, text: 'Remove'})
    const ThumbnailMenu = (props) => {
        const theEntity = props.entity
        const snapEntity = useSnapshot(theEntity)

        const handleSelect = async (event) => {
            switch (event.detail.item.value) {
                case 'remove':
                    const confirmation = await confirmRemoveToken()
                    if (confirmation) {
                        theEntity.usage.token = ''
                        theEntity.usage.unlocked = false
                    }
                    break
                case
                'update':
                    lgs.editorSettingsProxy.layer.tmpEntity = theEntity
                    lgs.editorSettingsProxy.layer.tokenDialog = true
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
                <SlDropdown hoist placement={'left'}>
                    <SlIconButton small className={'dropdown-trigger-icon selected-entity-menu'} slot="trigger"
                                  library="fa" name={FA2SL.set(faEllipsisVertical)}/>

                    <SlMenu onSlSelect={handleSelect}>
                        {props.entity.id !== settings[props.entity.type] &&
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
        const theEntity = __.layerManager.getLayerProxy(props.entity.id)
        const theEntitySnap = useSnapshot(theEntity)

        const accountType = theEntity.usage.type

        const accountUnlocked = theEntity.usage.type === FREE_ANONYMOUS_ACCESS || (theEntity.usage.unlocked ?? false)
        const type = accountUnlocked ? UNLOCKED_ACCESS : accountType

        let selected = false
        if (accountUnlocked) {
            selected = theEntity.id === settings[theEntity.type]
        }

        const classes = ['layer-entity', 'lgs-card', type]
        if (selected) {
            classes.push('entity-selected')
        }

        const byProvider = settings.filter.provider ? '' : sprintf(' %s %s', 'by', props.entity.providerName)

        return (

            <sl-tooltip className={`entity-${type}`}>
                <div slot="content">
                    <strong>{props.entity.name}</strong>{byProvider}<br/>
                    {ACCESS_ICONS[type].text}
                </div>
                <div className={classes.join(' ')} onClick={props.onClick} type={theEntity.type} name={theEntity.id}>
                    <div className={`thumbnail-background${settings.filter.thumbnail ? '' : ' lgs-card'}`}
                         style={{backgroundImage: thumbnailBackground(props.entity.image)}}>
                    </div>


                    {// Show the name
                        <div className={'entity-name'}>
                            {theEntity.name}
                        </div>
                    }


                    { // green check box for the current entity
                        selected &&
                        <div className={'entity-checkbox'}>
                            <SlIcon slot="prefix" library="fa" name={FA2SL.set(faCircleCheck)}/>
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
            </sl-tooltip>
        )
    }


    const list = props.list
    list.map((entity, index) => {
        entity.providerName = __.layerManager.providers.get(entity.provider).name
        list[index] = entity
    })

    const selectEntityHandler = (event) => {
        const type = event.target.getAttribute('type')
        const id = event.target.getAttribute('name')
        const theEntity = __.layerManager.getALayer(id)
        if (theEntity.usage.type === FREE_ANONYMOUS_ACCESS) {
            // We're on a free access, so we can select it.
            lgs.settings.layers[type] =
                // Clicking on the same overlay will deselect it
                (type === OVERLAY_LAYERS && lgs.settings.layers[type] === id) ? '' : id
        }
        else {
            // We need to know if  the account has been unlocked
            const theProxy = __.layerManager.getLayerProxy(id)
            // If not unlocked, we launch the dialog else select it
            if (theProxy.usage.unlocked) {
                lgs.settings.layers[type] =
                    // Clicking on the same overlay will deselect it
                    (type === OVERLAY_LAYERS && lgs.settings.layers[type] === id) ? '' : id
                editor.layer.tokenDialog = false
            }
            else {
                editor.layer.tmpEntity = theProxy
                editor.layer.tokenDialog = true
            }
        }

    }
    editor.layer.refreshList = true
    const fill = list.length > 0
    let classes = ['layer-entities-wrapper', 'lgs-card']
    classes.push(settings.filter.provider ? 'by-provider' : 'by-layer')
    classes.push(settings.filter.thumbnail ? 'by-thumbnail' : 'by-list')

    useEffect(() => {
        //editor.layer.refreshList = false
    }, [settings.filter.alphabetic])
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
                                    settings.filter.provider &&
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