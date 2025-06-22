/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOICategorySelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-22
 * Last modified: 2025-06-22
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { MapPOIContent }   from '@Components/MainUI/MapPOI/MapPOIContent'
import { POI_CATEGORY_ICONS, POI_STANDARD_TYPE } from '@Core/constants'
import { FontAwesomeIcon } from '@Components/FontAwesomeIcon'
import { SlOption, SlSelect }                    from '@shoelace-style/shoelace/dist/react'
import { useState }                              from 'react'
import { useSnapshot }                           from 'valtio'

export const MapPOICategorySelector = ({point: current, props}) => {
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)

    const handleCategory = async (event) => {
        current = __.ui.poiManager.updatePOI(pois.current, {
            category: event.target.value,
        })
    }


    return (
        <>
            {pois.current && current &&
                <SlSelect label={'Category'} value={current.category} size={props?.size ?? 'small'}
                          className="map-poi-category-selector"
                          onSlChange={handleCategory}>

                    <MapPOIContent slot="prefix" category={current.category}
                                   style={{
                                       '--fa-secondary-opacity':     1,
                                       '--fa-primary-opacity':       1,
                                       '--lgs-poi-background-color': current.bgColor ?? lgs.colors.poiDefaultBackground,
                                       '--lgs-poi-border-color':     current.color ?? lgs.colors.poiDefault,
                                       '--lgs-poi-color':            current.color ?? lgs.colors.poiDefault,
                                   }}/>

                    {Array.from(pois.categories).map(([slug, category]) =>
                                                         <SlOption key={slug} value={slug}>
                                                             <MapPOIContent category={slug}
                                                                            style={{
                                                                                '--fa-secondary-opacity':     1,
                                                                                '--fa-primary-opacity':       1,
                                                                                '--lgs-poi-background-color': current.bgColor ?? lgs.colors.poiDefaultBackground,
                                                                                '--lgs-poi-border-color':     current.color ?? lgs.colors.poiDefault,
                                                                                '--lgs-poi-color':            current.color ?? lgs.colors.poiDefault,
                                                                              }}/>
                                                             {category.title}
                                                         </SlOption>,
                    )}
                </SlSelect>
            }</>
    )
}