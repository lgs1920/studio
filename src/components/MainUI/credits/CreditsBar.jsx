import { SlTooltip }                                   from '@shoelace-style/shoelace/dist/react'
import { proxy, useSnapshot }                          from 'valtio'
import { subscribeKey }                                from 'valtio/utils'
import { BASE_LAYERS, OVERLAY_LAYERS, TERRAIN_LAYERS } from '../../../core/constants'
import { LayerManager }                                from '../../../core/layers/LayerManager'
import './style.css'
/*

 TODO :
 Si credit utilisé plusieurs fois on ne le met qu'une fois

 cesium-logo est toujours affiché, ce qui fait que si credits layers=cesium
 on n'affiche rien d'autre

 */

const providers = proxy({
                            [BASE_LAYERS]:    null,
                            [OVERLAY_LAYERS]: null,
                            [TERRAIN_LAYERS]: null,
                        })

export const CreditsBar = () => {

    const providersToCredit = useSnapshot(providers)
    const LAYERS_TYPE = [BASE_LAYERS, OVERLAY_LAYERS, TERRAIN_LAYERS]

    const Credit = (props) => {
        console.log(props.provider)
        return (

            <a href={props.provider.url} target="_blank">
                <SlTooltip hoist placement="top" content={props.provider.credits ?? `Credits ${props.provider.name}`}>
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
        const manager = new LayerManager()
        const tmp = {
            [BASE_LAYERS]:    manager.getProviderProxyByLayerId(lgs.settings.layers.base),
            [OVERLAY_LAYERS]: manager.getProviderProxyByLayerId(lgs.settings.layers.overlay),
            [TERRAIN_LAYERS]: manager.getProviderProxyByLayerId(lgs.settings.layers.terrain),
        }
        // If we have a specific lyer, let's use it
        if (layer) {
            tmp[type] = manager.getProviderProxyByLayerId(layer)
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
                <div className={'lgs-card on-map provider-credits'}>
                    {providersToCredit.terrain &&
                        <>
                            <Credit id={'terrain-credits'} provider={providersToCredit.terrain}></Credit>|
                        </>}
                    {providersToCredit.overlay &&
                        <>
                            <Credit id={'overlay-credits'} provider={providersToCredit.overlay}></Credit>|
                        </>}
                    {providersToCredit.base &&
                        <>
                            <Credit id={'layer-credits'} provider={providersToCredit.base}></Credit>
                        </>
                    }
                </div>
                <div id={'cesium-logo'} className={'lgs-card on-map'}>
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