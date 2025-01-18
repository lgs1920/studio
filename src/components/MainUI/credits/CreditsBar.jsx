import { BASE_ENTITY, OVERLAY_ENTITY, TERRAIN_ENTITY } from '@Core/constants'
import { LayersAndTerrainManager }                     from '@Core/ui/LayerAndTerrainManager'
import { SlTooltip }                                   from '@shoelace-style/shoelace/dist/react'
import { proxy, useSnapshot }                          from 'valtio'
import { subscribeKey }                                from 'valtio/utils'
import './style.css'
/*

 TODO :
 Si credit utilisé plusieurs fois on ne le met qu'une fois

 cesium-logo est toujours affiché, ce qui fait que si credits layers=cesium
 on n'affiche rien d'autre

 */

const providers = proxy({
                            [BASE_ENTITY]:    null,
                            [OVERLAY_ENTITY]: null,
                            [TERRAIN_ENTITY]: null,
                        })

export const CreditsBar = () => {

    const providersToCredit = useSnapshot(providers)
    const LAYERS_TYPE = [BASE_ENTITY, OVERLAY_ENTITY, TERRAIN_ENTITY]


    const Credit = (props) => {
        const credits = () => {
            const layer = __.layersAndTerrainManager.getEntityProxy(lgs.settings.layers[props.type])
            return `${props.type} : ${layer?.credits ?? props.provider.credits ?? `credits ${props.provider.name}`}`
        }
        return (

            <a href={props.provider.url} target="_blank">
                <SlTooltip hoist placement="top" content={credits()}>
                    {props.provider.logo &&
                        <img src={props.provider.logo} alt={props.provider.name}/>
                    }
                    {!props.provider.logo &&
                        <span className={'credits'}>{props.provider.name}</span>
                    }
                </SlTooltip>
            </a>

        )
    }

    const getProviders = (type, layer = undefined) => {
        const manager = new LayersAndTerrainManager()
        const tmp = {
            [BASE_ENTITY]:    manager.getProviderProxyByEntity(lgs.settings.layers.base),
            [OVERLAY_ENTITY]: manager.getProviderProxyByEntity(lgs.settings.layers.overlay),
            [TERRAIN_ENTITY]: manager.getProviderProxyByEntity(lgs.settings.layers.terrain),
        }
        // If we have a specific lyer, let's use it
        if (layer) {
            tmp[type] = manager.getProviderProxyByEntity(layer)
        }

        // Check doublon and remove value
        const used = new Set()
        for (const key in tmp) {
            if (tmp[key] && !used.has(tmp[key].name)) {
                used.add(tmp[key].name)
                providers[key] = tmp[key]
            }
            else {
                providers[key] = undefined
            }
        }
    }

    // Init credits
    getProviders(null)


    // Apply changes for each layer type settings
    LAYERS_TYPE.forEach((type) => {
        subscribeKey(lgs.settings.layers, type, (layer) => {
            getProviders(type, layer)
        })
    })

    return (
        <>
            <div className={'credits-bar'}>
                <div className={'main-logo'}>
                    <img src={'/assets/images/logo-lgs1920.png'}/>
                </div>
                <div className={'provider-credits lgs-credits lgs-one-line-card on-map'}>
                    {providersToCredit.terrain &&
                        <>
                            <Credit id={'terrain-credits'} type={TERRAIN_ENTITY}
                                    provider={providersToCredit.terrain}></Credit>|
                        </>}
                    {providersToCredit.overlay &&
                        <>
                            <Credit id={'overlay-credits'} type={OVERLAY_ENTITY}
                                    provider={providersToCredit.overlay}></Credit>|
                        </>}
                    {providersToCredit.base &&
                        <>
                            <Credit id={'layer-credits'} type={BASE_ENTITY} provider={providersToCredit.base}></Credit>
                        </>
                    }
                </div>
                <div className={'cesium-credits lgs-credits lgs-one-line-card on-map'}>
                    <a href="https://www.cesium.com/" target="_blank">
                        <SlTooltip hoist placement="top"
                                   content={'Built with CesiumJS, an Open Source JavaScript library for creating 3D globes'}>
                            <img src={'/assets/images/Cesium_light_color.svg'} alt={'Cesium'}/>
                        </SlTooltip>
                    </a>
                </div>
            </div>
        </>
    )
}