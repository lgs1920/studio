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
import { WaTooltip }                                   from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useEffect, useId }                      from 'react'
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

const CreditLink = memo(({id, provider}) => {
    const title = provider.fullname ?? provider.name
    return (
        <a id={id} href={provider.url} target="_blank" rel="noreferrer" aria-label={title}>
            {provider.logo
             ? <img src={provider.logo} alt={title}/>
             : <span className={'credits'}>{provider.name}</span>
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
    const providerTooltip = (type, provider) => `${CREDIT_TYPE_LABELS[type]}: ${provider.name ?? provider.fullname}`

    /**
     * Retrieves and updates provider data dynamically.
     * Avoids duplicates and ensures valid entries.
     *
     * @param {string} type The entity type.
     * @param {Object} layer The specific layer entity (optional).
     */
    const getProviders = (type, layer = undefined) => {
        const manager = new LayersAndTerrainManager()
        const tmp = {
            [BASE_ENTITY]: manager.getProviderProxyByEntity(lgs.settings.layers.base, BASE_ENTITY),
            [OVERLAY_ENTITY]: manager.getProviderProxyByEntity(lgs.settings.layers.overlay, OVERLAY_ENTITY),
            [TERRAIN_ENTITY]: manager.getProviderProxyByEntity(lgs.settings.layers.terrain, TERRAIN_ENTITY),
        }

        if (layer) {
            tmp[type] = manager.getProviderProxyByEntity(layer, type)
        }

        // Remove duplicate providers
        const used = new Set()
        Object.keys(tmp).forEach((key) => {
            if (tmp[key] && tmp[key].id !== 'cesium' && !used.has(tmp[key].name)) {
                used.add(tmp[key].name)
                $providers[key] = tmp[key]
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
                    <CreditLink
                        key={type}
                        id={`${tooltipIdPrefix}-${type}`}
                        provider={provider}
                    />
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
