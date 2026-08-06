/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SelectEntity.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import { useConfirm }    from '@Components/Modals/ConfirmUI'
import {
    ACCESS_ICONS, BASE_ENTITY, DEFAULT_LAYERS_COLOR_SETTINGS, FREE_ACCOUNT_ACCESS, FREE_ANONYMOUS_ACCESS, FREEMIUM_ACCESS,
    LAYERS_THUMBS_DIR, LOCKED_ACCESS, OVERLAY_ENTITY, PERSONAL_ACCESS, PREMIUM_ACCESS, TERRAIN_ENTITY, UNLOCKED_ACCESS, VAULT_STORE,
}                        from '@Core/constants'

import {
    WaButton, WaCallout, WaCard, WaDivider, WaDropdown, WaDropdownItem, WaIcon, WaTooltip,
}                                        from '@web.awesome.me/webawesome-pro/dist/react'
import parse               from 'html-react-parser'
import { Fragment, useRef, useLayoutEffect } from 'react'

import { useSnapshot }                   from 'valtio'
import { LayersUtils }                   from '@Utils/cesium/LayersUtils'
import { applyLayerSelection }           from './layerSelection'

/**
 * Component to display and select map entities.
 * Simplified version focusing on internal list rendering and scrollbar management.
 */
export const SelectEntity = (props) => {
    const _scrollRef = useRef(null)
    const _cardRef = useRef(null)

    const $layers = lgs.settings.layers
    const layers = useSnapshot($layers)
    const ion = useSnapshot(lgs.stores.ion)
    const $editor = lgs.editorSettingsProxy
    const editor = useSnapshot($editor)

    /**
     * Refresh scrollbar whenever the internal content changes (filtering, list updates)
     */
    useLayoutEffect(() => {
        const refresh = () => {
            if (_scrollRef.current && typeof _scrollRef.current.refresh === 'function') {
                _scrollRef.current.refresh()
            }
        }

        const observer = new ResizeObserver(refresh)
        if (_cardRef.current) {
            observer.observe(_cardRef.current)
        }

        // Trigger immediate refresh on mount/prop change
        refresh()

        return () => observer.disconnect()
    }, [props.list])

    const thumbnailBackground = image => `url("${LAYERS_THUMBS_DIR}/${image}")`

    const title = 'Remove Token ?'
    const message = () => {
        return <>{'Are you sure you want to remove this access by locking it?'}</>
    }
    const [ConfirmRemoveTokenDialog, confirmRemoveToken] = useConfirm(title, message,
                                                                      {icon: 'lock', text: 'lock'})

    const ThumbnailMenu = (props) => {
        const entity = props.entity

        const handleSelect = async (event) => {
            event.preventDefault()
            switch (event.detail.item.value) {
                case 'remove': {
                    const confirmation = await confirmRemoveToken()
                    if (confirmation) {
                        if (entity.usage.type === PERSONAL_ACCESS) {
                            await __.ui.ionTokenManager.clear()
                        }
                        else {
                            entity.usage.token = ''
                            entity.usage.unlocked = false
                            await lgs.db.vault.put(entity.id, entity.usage.token, VAULT_STORE)
                        }
                    }
                    break
                }
                case 'update':
                    $editor.layer.tmpEntity = entity
                    $editor.layer.tokenDialog = true
                    break
                case 'read':
                    if (entity.usage.doc) {
                        window.open(entity.usage.doc, '_blank')
                    }
                    break
            }
        }

        return (
            <>
                <WaTooltip for="lgs--layers-manage-authent">{'Manage Authentification'}</WaTooltip>
                <WaDropdown id="lgs--layers-manage-authent"
                            distance={lgs.gutter.xs}
                            placement="right-start"
                            onClick={(event) => event.stopPropagation()}
                            onWaSelect={handleSelect}>
                    <WaIcon name="square-ellipsis-vertical" slot="trigger" variant="solid"/>

                    {entity.usage.doc &&
                        <WaDropdownItem size="s" value="read" key="read-entity-doc">
                            <WaIcon slot="icon" name="arrow-up-right-from-square" variant="regular"/>{'Read Doc'}
                        </WaDropdownItem>
                    }

                    <WaDropdownItem value="update" key="update-entity">
                        <WaIcon slot="icon" name="arrow-down-up-lock" variant="regular"/> {'Update Token'}
                    </WaDropdownItem>
                    {entity.id !== layers[entity.type] &&
                        <>
                            <WaDivider/>
                            <WaDropdownItem value="remove" key="remove-entity" variant="danger">
                                <WaIcon slot="icon" name="lock" variant="regular"/> {'Remove Token'}
                            </WaDropdownItem>
                        </>
                    }
                </WaDropdown>
            </>
        )
    }

    const Thumbnail = (props) => {
        const $entity = __.layersAndTerrainManager.getEntityProxy(props.entity.id)
        if (!$entity) {
            return null
        }
        const accountType = $entity.usage.type
        const accountUnlocked = $entity.usage.type === FREE_ANONYMOUS_ACCESS
            || $entity.usage.type === PERSONAL_ACCESS && ion.source === 'user'
            || ($entity.usage.unlocked ?? false)
        const type = accountUnlocked ? UNLOCKED_ACCESS : accountType

        let selected = false
        if (accountUnlocked) {
            selected = $entity.id === layers[$entity.type]
        }

        const classes = ['layer-entity', type, 'lgs--card-hoverable']
        if (selected) {
            classes.push('lgs--card-selected')
        }

        const byProvider = $layers.filter.provider ? '' : ` by ${props.entity.providerName}`
        const $entityName = $layers.filter.thumbnail ? props.entity.name.replace('\\', '<br/>') : props.entity.name.replace('\\', ' ')

        return (
            <>
                <WaTooltip className={`entity-${type}`} for={$entity.id}
                           placement={layers.filter.thumbnail ? 'top' : 'left'}>
                    <div>
                        <strong>{parse($entityName)}</strong>{byProvider}<br/>
                        {ACCESS_ICONS[type]?.text ?? ''}
                    </div>
                </WaTooltip>
                <WaCard appearance="outlined" id={$entity.id} className={classes.join(' ')} onClick={props.onClick}
                        type={$entity.type}
                        name={$entity.id}>
                    <div className={`thumbnail-background${layers.filter.thumbnail ? '' : ' lgs-card'}`}
                         style={{backgroundImage: thumbnailBackground(props.entity.image)}}
                    >
                    </div>

                    <div className="entity-name">
                        {parse($entityName)}
                    </div>

                    <div className="entity-sub-menu">
                        {($entity.usage.type === PREMIUM_ACCESS
                                || $entity.usage.type === FREEMIUM_ACCESS
                                || $entity.usage.type === FREE_ACCOUNT_ACCESS
                                || $entity.usage.type === PERSONAL_ACCESS) && accountUnlocked &&
                            <ThumbnailMenu entity={$entity}/>
                        }
                        {($entity.usage.type === PREMIUM_ACCESS
                                || $entity.usage.type === FREEMIUM_ACCESS
                                || $entity.usage.type === FREE_ACCOUNT_ACCESS
                                || $entity.usage.type === PERSONAL_ACCESS) &&
                            <div className={['entity-access', type, $entity.usage.type].join(' ')}>
                                <WaIcon name={ACCESS_ICONS[$entity.usage.type].icon}/>
                            </div>
                        }
                        {$entity.usage.type !== FREE_ANONYMOUS_ACCESS && !accountUnlocked &&
                            <div className={['entity-lock-status', type].join(' ')}>
                                <WaIcon name={ACCESS_ICONS[LOCKED_ACCESS].icon}/>
                            </div>
                        }
                    </div>
                </WaCard>
            </>
        )
    }

    const list = props.list.map(entity => ({
        ...entity,
        providerName: __.layersAndTerrainManager.providers.get(entity.provider)?.name ?? '',
        providerFullname: __.layersAndTerrainManager.providers.get(entity.provider)?.fullname ?? '',
    }))

    const selectEntityHandler = (event) => {
        let type = event.currentTarget?.getAttribute('type') ?? event.target.getAttribute('type')
        let id = event.currentTarget?.getAttribute('name') ?? event.target.getAttribute('name')

        if ((type === null || id === null) && event.target.parentElement) {
            type = type ?? event.target.parentElement.getAttribute('type')
            id = id ?? event.target.parentElement.getAttribute('name')
        }

        if (type === null || id === null) {
            return
        }

        const $entity = __.layersAndTerrainManager.getALayer(id)
        if (!$entity) {
            return
        }

        const requiresPersonalToken = $entity.usage.type === PERSONAL_ACCESS
        const selectUnlockedEntity = () => {
            applyLayerSelection({
                                    entity:         $entity,
                                    id,
                                    requestedType:  type,
                                    layersSnapshot: layers,
                                    layersProxy:    $layers,
                                })
        }

        if ($entity.usage.type === FREE_ANONYMOUS_ACCESS || (requiresPersonalToken && ion.source === 'user')) {
            selectUnlockedEntity()
            if (requiresPersonalToken) {
                $editor.layer.tokenDialog = false
            }
        }
        else {
            const theProxy = __.layersAndTerrainManager.getEntityProxy(id)
            if (theProxy.usage.unlocked || (requiresPersonalToken && ion.source === 'user')) {
                selectUnlockedEntity()
                $editor.layer.tokenDialog = false
            }
            else {
                $editor.layer.tmpEntity = theProxy
                $editor.layer.tokenDialog = true
            }
        }

        $editor.layer.layersSnapChanged = false
        if ($layers.colorSettings[$entity.id] === undefined) {
            $layers.colorSettings[$entity.id] = {...DEFAULT_LAYERS_COLOR_SETTINGS}
        }

        if ([BASE_ENTITY, OVERLAY_ENTITY].includes($entity.type)) {
            LayersUtils.applySettings($layers.colorSettings[$entity.id] ?? DEFAULT_LAYERS_COLOR_SETTINGS, $entity.type, true)
        }

        if ($entity.type === TERRAIN_ENTITY && ($entity.usage.type === FREE_ANONYMOUS_ACCESS || $entity.usage.unlocked || ($entity.usage.type === PERSONAL_ACCESS && ion.source === 'user'))) {
            __.layersAndTerrainManager.changeTerrain($entity)
        }

    }

    const fill = list.length > 0
    let classes = ['layer-entities-wrapper']
    classes.push(layers.filter.provider ? 'by-provider' : 'by-layer')
    classes.push(layers.filter.thumbnail ? 'by-thumbnail' : 'by-list')

    return (
        <LGSScrollbars ref={_scrollRef}>
            {fill &&
                <WaCard appearance="plain" ref={_cardRef} className={classes.join(' ')}>
                    {list.map((entity, index) => {
                        let previousProviderName = index > 0 ? list[index - 1].providerName : null
                        return (
                            <Fragment key={index}>
                                {layers.filter.provider &&
                                    entity.providerName && entity.providerName !== previousProviderName &&
                                    <div className="layers-provider-header">
                                        <span className="provider-name"
                                              id={`provider-name-${entity.provider}`}>
                                            {entity.providerName}
                                        </span>
                                        <WaTooltip placement="top" for={`provider-name-${entity.provider}`}>
                                            {entity.providerFullname || entity.providerName}
                                        </WaTooltip>
                                    </div>
                                }
                                <Thumbnail entity={entity} key={entity.name} onClick={selectEntityHandler}/>
                            </Fragment>
                        )
                    })}
                </WaCard>
            }

            {!fill &&
                <WaCallout variant="warning" open>
                    <WaIcon slot="icon" name="triangle-exclamation"/>
                    <div id="filter-alert-content">
                        <strong>{'It looks empty over here!'}</strong>
                        <p>{`No ${props.type} entity found.`}</p>
                        <p>{'Please check your filter criteria.'}</p>
                        {!editor.openFilter &&
                            <WaButton size="s"
                                      onClick={() => $editor.openFilter = true}
                                      variant="brand">
                                <WaIcon slot="start" name="filter" variant="regular"/>
                                {'Open Filters'}
                            </WaButton>
                        }
                    </div>
                </WaCallout>
            }
            <ConfirmRemoveTokenDialog/>
        </LGSScrollbars>
    )
}
