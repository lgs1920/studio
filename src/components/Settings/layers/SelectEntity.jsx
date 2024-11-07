import { useConfirm }                                                from '@Components/Modals/ConfirmUI'
import {
    ACCESS_ICONS, FREE_ACCOUNT_ACCESS, FREE_ANONYMOUS_ACCESS, FREEMIUM_ACCESS, LAYERS_THUMBS_DIR, LOCKED_ACCESS,
    OVERLAY_LAYERS, PREMIUM_ACCESS, UNLOCKED_ACCESS,
}                                                                    from '@Core/constants'
import { faTrashCan }                                                from '@fortawesome/pro-regular-svg-icons'
import {
    faArrowDownUpLock, faArrowUpRightFromSquare, faCircleCheck, faEllipsisVertical, faLock, faTriangleExclamation,
}                                                                    from '@fortawesome/pro-solid-svg-icons'
import { SlAlert, SlButton, SlDropdown, SlIcon, SlMenu, SlMenuItem } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                     from '@Utils/FA2SL'
import { Fragment }                                                  from 'react'

import { useSnapshot } from 'valtio'


export const SelectEntity = (props) => {

    const thumbnailBackground = image => `url("${LAYERS_THUMBS_DIR}/${image}")`

    let settings = useSnapshot(lgs.settings.layers)
    const editor = lgs.editorSettingsProxy

    const [ConfirmRemoveTokenDialog, confirmRemoveToken] = useConfirm(`Remove Token ?`, 'Are you sure you want to remove this access ?',
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
                 className={['thumbnail-toolbar', 'lgs-ui-toolbar', props.mode, props.icons ? 'just-icons' : ''].join(' ')}>
                <SlDropdown distance={20} hoist placement={'right-start'}>
                    <div slot="trigger">
                        <SlButton size={'small'} className={'thumbnail-toolbar-icon'}>
                            <SlIcon slot="prefix" library="fa" name={FA2SL.set(faEllipsisVertical)}></SlIcon>
                        </SlButton>
                    </div>
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

        return (

            <sl-tooltip className={`entity-${type}`}>
                <div slot="content">
                    <strong>{props.entity.name}</strong><br/>
                    {ACCESS_ICONS[type].text}
                </div>
                <div className={classes.join(' ')}>
                    <div className={'thumbnail-background'}
                         style={{backgroundImage: thumbnailBackground(props.entity.image)}}></div>
                    <a onClick={props.onClick} type={theEntity.type} name={theEntity.id}>

                        {/* green check box for the current entity */}
                        {selected &&
                            <div className={'entity-checkbox'}>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faCircleCheck)}/>
                            </div>
                        }

                        {/* show the entity access type */}
                        {(theEntity.usage.type === PREMIUM_ACCESS
                                || theEntity.usage.type === FREEMIUM_ACCESS
                                || theEntity.usage.type === FREE_ACCOUNT_ACCESS)
                            &&
                            <div className={['entity-access', type, theEntity.usage.type].join(' ')}>
                                <SlIcon slot="prefix" library="fa"
                                        name={FA2SL.set(ACCESS_ICONS[theEntity.usage.type].icon)}/>
                            </div>
                        }

                        {/* show the lock */}
                        {theEntity.usage.type !== FREE_ANONYMOUS_ACCESS && !accountUnlocked &&
                            <div className={['entity-lock-status', type].join(' ')}>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(ACCESS_ICONS[LOCKED_ACCESS].icon)}/>
                            </div>
                        }

                        {/* Show the name */}
                        <div className={'entity-name'}>
                            {theEntity.name}
                        </div>

                    </a>

                    {(theEntity.usage.type === PREMIUM_ACCESS
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

    return (
        <>
            {
                fill &&
                <div className={'layer-entities-wrapper lgs-card'}>
                    {list.map((entity, index) => {
                        let previousProviderName = index > 0 ? list[index - 1].providerName : null
                        return (
                            <Fragment key={index}>
                                {// If there is a new provider, let's show it's name
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
                    {'Nothing to display! Check your filter criteria.'}
                </SlAlert>
            }
            <ConfirmRemoveTokenDialog/>
        </>

    )

}