/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CreditsBar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-14
 * Last modified: 2025-06-14
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { BASE_ENTITY, OVERLAY_ENTITY, TERRAIN_ENTITY } from '@Core/constants'
import { LayersAndTerrainManager }                     from '@Core/ui/LayerAndTerrainManager'
import { SlTooltip }                                   from '@shoelace-style/shoelace/dist/react'
import { memo, useEffect }                             from 'react'
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
                         });

/** List of available layer types */
const LAYERS_TYPE = [BASE_ENTITY, OVERLAY_ENTITY, TERRAIN_ENTITY]

/**
 * Component displaying credits for different map providers.
 * Uses Valtio state management to track and update providers dynamically.
 *
 * @returns {JSX.Element} The CreditsBar component.
 */
export const CreditsBar = () => {

    const providers = useSnapshot($providers)

    /**
     * Component displaying provider credits.
     * Wrapped in `memo` to prevent unnecessary re-renders.
     *
     * @param {Object} props Component props.
     * @param {string} props.type Entity type (BASE_ENTITY, OVERLAY_ENTITY, TERRAIN_ENTITY).
     * @param {Object} props.provider Provider information.
     * @returns {JSX.Element} The Credit component.
     */
    const Credit = memo(({type, provider}) => {
        const credits = () => {
            const layer = __.layersAndTerrainManager.getEntityProxy(lgs.settings.layers[type])
            return `${type} : ${layer?.credits ?? provider.credits ?? `credits ${provider.name}`}`
        };

        return (
            <a href={provider.url} target="_blank">
                <SlTooltip hoist placement="top" content={credits()}>
                    {provider.logo ? (
                        <img src={provider.logo} alt={provider.name}/>
                    ) : (
                         <span className={'credits'}>{provider.name}</span>
                     )}
                </SlTooltip>
            </a>
        );
    });

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
            [BASE_ENTITY]: manager.getProviderProxyByEntity(lgs.settings.layers.base),
            [OVERLAY_ENTITY]: manager.getProviderProxyByEntity(lgs.settings.layers.overlay),
            [TERRAIN_ENTITY]: manager.getProviderProxyByEntity(lgs.settings.layers.terrain),
        };

        if (layer) {
            tmp[type] = manager.getProviderProxyByEntity(layer)
        }

        // Remove duplicate providers
        const used = new Set()
        Object.keys(tmp).forEach((key) => {
            if (tmp[key] && !used.has(tmp[key].name)) {
                used.add(tmp[key].name)
                $providers[key] = tmp[key]
            }
            else {
                $providers[key] = undefined
            }
        });
    };

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
        <div className="credits-bar">
            <div className="main-logo">
                <img src="/assets/images/logo-lgs1920.png" alt="LGS1920 Logo"/>
            </div>
            <div className="provider-credits lgs-credits lgs-one-line-card on-map">
                {providers.terrain && <><Credit id="terrain-credits" type={TERRAIN_ENTITY}
                                                provider={providers.terrain}/>!</>}
                {providers.overlay && <><Credit id="overlay-credits" type={OVERLAY_ENTITY}
                                                provider={providers.overlay}/></>}
                {providers.base && <><Credit id="layer-credits" type={BASE_ENTITY} provider={providers.base}/></>}
            </div>
            <div className="cesium-credits lgs-credits lgs-one-line-card on-map">
                <a href="https://www.cesium.com/" target="_blank">
                    <SlTooltip
                        hoist
                        placement="top"
                        content="Built with CesiumJS, an Open Source JavaScript library for creating 3D globes"
                    >
                        <img src="/assets/images/Cesium_light_color.svg" alt="Cesium"/>
                    </SlTooltip>
                </a>
            </div>
        </div>
    );
};