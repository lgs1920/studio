import {
    ACCESS_ICONS, FREE_ANONYMOUS_ACCESS, FREEMIUM_ACCESS, LAYERS_THUMBS_DIR, OVERLAY_LAYERS, PREMIUM_ACCESS,
    UNLOCKED_ACCESS,
}                        from '@Core/constants'
import { faCircleCheck } from '@fortawesome/pro-solid-svg-icons'
import { SlIcon }        from '@shoelace-style/shoelace/dist/react'
import { FA2SL }         from '@Utils/FA2SL'
import { Fragment }      from 'react'

import { useSnapshot }   from 'valtio'
import { LOCKED_ACCESS } from '../../../core/constants'

export const SelectEntity = (props) => {

    const thumbnailBackground = image => `url("${LAYERS_THUMBS_DIR}/${image}")`

    let settings = useSnapshot(lgs.settings.layers)

    const editorProxy = lgs.settingsEditorProxy
    const snap = useSnapshot(editorProxy)

    const Thumbnail = (props) => {
        const theEntity = __.layerManager.getLayerProxy(props.entity.id)
        const theEntitySnap = useSnapshot(theEntity)

        const accountType = theEntity.usage.type

        const accountUnlocked = theEntity.usage.type === FREE_ANONYMOUS_ACCESS || (theEntity.usage.unlocked ?? false)
        const type = accountUnlocked ? UNLOCKED_ACCESS : accountType

        let selected = false
        lgs.settings.layerTokenDialog = true
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
                        {theEntity.usage.type === PREMIUM_ACCESS || theEntity.usage.type === FREEMIUM_ACCESS &&
                            <div className={['entity-access', type, theEntity.usage.type].join(' ')}>
                                <SlIcon slot="prefix" library="fa"
                                        name={FA2SL.set(ACCESS_ICONS[theEntity.usage.type].icon)}/>
                            </div>
                        }

                        {/* show the lock */}
                        {accountType !== FREE_ANONYMOUS_ACCESS && !accountUnlocked &&
                            <div className={['entity-lock-status', type].join(' ')}>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(ACCESS_ICONS[LOCKED_ACCESS].icon)}/>
                            </div>
                        }
                    </a>
                </div>
            </sl-tooltip>
        )
    }


    let tmp = ''
    const list = props.list
    list.map((entity, index) => {
        if (entity.provider !== tmp) {
            tmp = entity.provider
            entity.providerName = __.layerManager.providers.get(entity.provider).name
            list[index] = entity
        }
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
                editorProxy.layerTokenDialog = false
            }
            else {
                editorProxy.tmpEntity = theProxy
                editorProxy.layerTokenDialog = true
            }
        }

    }

    return (

        <div className={'layer-entities-wrapper lgs-card'}>

            {list.map((entity, index) => {
                return (
                    // If there is a new provider, let's show it's name

                    <Fragment key={index}>
                        {
                            entity.providerName &&
                            <div className="layers-provider-header">
                                <span className={'provider-name'}>{entity.providerName}</span>
                            </div>
                        }
                        <Thumbnail entity={entity} key={entity.name} onClick={selectEntityHandler}/>
                    </Fragment>
                )
            })}
        </div>


    )

}