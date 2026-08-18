/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CreditsBar.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-08
 * Last modified: 2026-07-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { BASE_ENTITY, OVERLAY_ENTITY, TERRAIN_ENTITY } from '@Core/constants'
import { LogoSvg }                                     from '@Components/MainUI/LogoSvg'
import { LayersAndTerrainManager }                     from '@Core/ui/LayerAndTerrainManager'
import {
    layerCreditKey,
    layerCreditText,
    resolveLayerCredit,
}                                                       from '@Core/ui/layerCredits'
import { WaTooltip }                                   from '@web.awesome.me/webawesome-pro/dist/react'
import { Fragment, memo, useEffect, useId }            from 'react'
import { proxy, useSnapshot }                          from 'valtio'
import { subscribeKey }                                from 'valtio/utils'
import './style.css'

/**
 * Proxy state to manage layer providers.
 */
const $providers = proxy({
                             [BASE_ENTITY]:    null,
                             [OVERLAY_ENTITY]: null,
                             [TERRAIN_ENTITY]: null,
                         })

/** List of available layer types */
const LAYERS_TYPE = [BASE_ENTITY, OVERLAY_ENTITY, TERRAIN_ENTITY]
const CREDIT_TYPE_LABELS = {
    [BASE_ENTITY]:    'Base',
    [OVERLAY_ENTITY]: 'Overlay',
    [TERRAIN_ENTITY]: 'Terrain',
}

/**
 * Renders a link for one resolved layer or provider attribution.
 *
 * @param {Object} properties - Component properties.
 * @param {string} properties.id - DOM id used by the tooltip.
 * @param {Object} properties.credit - Resolved attribution data.
 * @returns {JSX.Element} Attribution link.
 */
const CreditLink = memo(({id, credit}) => {
    const title = layerCreditText(credit) || credit.fullname || credit.name
    return (
        <a id={id} href={credit.url} target="_blank" rel="noreferrer" aria-label={title}>
            {credit.logo
             ? credit.logoText
                 ? <span className="credit-logo-composite" aria-label={credit.logoText}>
                     <span className="credit-logo-icon" aria-hidden="true">
                         <img src={credit.logo} alt=""/>
                     </span>
                     <span className="credit-logo-text">{credit.logoText}</span>
                 </span>
                 : <img src={credit.logo} alt={title}/>
             : <span className={'credits'}>{title}</span>
            }
        </a>
    )
})

/**
 * Component displaying credits for different map providers.
 * Uses Valtio state management to track and update providers dynamically.
 *
 * @returns {JSX.Element} The CreditsBar component.
 */
export const CreditsBar = ({contentRef = null, widgetMode = false, showMainLogo = true}) => {

    const providers = useSnapshot($providers)
    const siteUrl = __.app.buildUrl(lgs?.configuration?.website || 'https://lgs1920.fr')
    const tooltipIdPrefix = `credits-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
    const cesiumLinkId = `${tooltipIdPrefix}-cesium`
    const mainLogoLinkId = `${tooltipIdPrefix}-lgs1920`
    const providerCredits = LAYERS_TYPE
        .map((type) => ({type, provider: providers[type]}))
        .filter(({provider}) => provider)
    const providerTooltip = (type, credit) => `${CREDIT_TYPE_LABELS[type]}: ${layerCreditText(credit)}`

    /**
     * Retrieves and updates provider data dynamically.
     * Avoids duplicates and ensures valid entries.
     *
     * @param {string} type The entity type.
     * @param {Object} layer The specific layer entity (optional).
     */
    const getProviders = (type, layer) => {
        const manager = new LayersAndTerrainManager()
        const getCredit = entityType => {
            const entityId = lgs.settings.layers[entityType]
            const entity = manager.getEntityProxyByType(entityId, entityType)
            const provider = manager.getProviderProxyByEntity(entityId, entityType)
            return resolveLayerCredit(entity, provider)
        }
        const tmp = LAYERS_TYPE.reduce((credits, entityType) => {
            credits[entityType] = getCredit(entityType)
            return credits
        }, {})

        if (layer) {
            const entity = manager.getEntityProxyByType(layer, type)
            const provider = manager.getProviderProxyByEntity(layer, type)
            tmp[type] = resolveLayerCredit(entity, provider)
        }

        // Remove duplicate attributions and hide the generic Cesium provider attribution.
        const used = new Set()
        Object.keys(tmp).forEach((key) => {
            const credit = tmp[key]
            const keyValue = layerCreditKey(credit)
            if (credit
                && (credit.providerId !== 'cesium' || credit.isLayerSpecific)
                && !used.has(keyValue)) {
                used.add(keyValue)
                $providers[key] = credit
            }
            else {
                $providers[key] = undefined
            }
        })
    }

    // Initialize providers and subscribe to changes at once
    useEffect(() => {
        getProviders(null)
        const unsubscribers = LAYERS_TYPE.map((type) =>
                                                  subscribeKey(lgs.settings.layers, type, (layer) => {
                                                      getProviders(type, layer)
                                                  }),
        )

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe())
        }
    }, [])

    return (
        <div
            id="lgs-credits-bar"
            ref={contentRef}
            className={`credits-bar${widgetMode ? ' credits-bar-widget-mode' : ''}${showMainLogo ? '' : ' credits-bar-no-main-logo'}`}
        >
            {showMainLogo && (
                <div className="main-logo">
                    <a
                        id={mainLogoLinkId}
                        className="main-logo-link"
                        href={siteUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="LGS1920 website"
                    >
                        <LogoSvg
                            src="/assets/logo/logo-vertical.svg"
                            primaryColor="#ffffff"
                            secondaryColor="#ffffff"
                            secondaryOpacity={0}
                            textPrimaryColor="#ffffff"
                            textSecondaryColor="#ffffff"
                            className="credits-logo"
                            style={{height: '100%'}}
                            title="LGS1920 logo"
                        />
                    </a>
                </div>
            )}
            <div className="provider-credits lgs-credits">
                {providerCredits.map(({type, provider}) => (
                    <Fragment key={type}>
                        <span className="provider-credit-separator" aria-hidden="true"/>
                        <CreditLink
                            id={`${tooltipIdPrefix}-${type}`}
                            credit={provider}
                        />
                    </Fragment>
                ))}
            </div>
            <div className="cesium-credits lgs-credits  ">
                <a id={cesiumLinkId} href="https://www.cesium.com/" target="_blank" rel="noreferrer" aria-label="Cesium">
                    <img src="/assets/images/Cesium_light_color.svg" alt="Cesium"/>
                </a>
            </div>
            <div className="credits-tooltips" data-widget-capture="exclude">
                {showMainLogo && <WaTooltip for={mainLogoLinkId} placement="top">{'LGS1920 website'}</WaTooltip>}
                {providerCredits.map(({type, provider}) => (
                    <WaTooltip key={type} for={`${tooltipIdPrefix}-${type}`} placement="top">
                        {providerTooltip(type, provider)}
                    </WaTooltip>
                ))}
                <WaTooltip for={cesiumLinkId} placement="top">{'Cesium'}</WaTooltip>
            </div>
        </div>
    )
}
