/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOICategorySelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-17
 * Last modified: 2025-05-17
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { POI_CATEGORY_ICONS, POI_STANDARD_TYPE } from '@Core/constants'
import { FontAwesomeIcon } from '@Components/FontAwesomeIcon'
import { SlOption, SlSelect }                    from '@shoelace-style/shoelace/dist/react'
import { useState }                              from 'react'
import { useSnapshot }                           from 'valtio'

export const MapPOICategorySelector = (point, props) => {

    const $pois = lgs.mainProxy.components.pois
    const pois = useSnapshot($pois)

    const [category, setCategory] = useState($pois.categories.get(point.category ?? POI_STANDARD_TYPE))
    const [icon, setIcon] = useState(Object.values(POI_CATEGORY_ICONS.get(category.slug))[0])

    const current = pois.list.get(pois.current)

    const handleCategory = async (event) => {
        Object.assign(__.ui.poiManager.list.get(pois.current), {
            category: event.target.value,
        })
        await __.ui.poiManager.persistToDatabase(__.ui.poiManager.list.get(pois.current))

        setIcon(Object.values(POI_CATEGORY_ICONS.get(event.target.value))[0])
        setCategory($pois.categories.get(event.target.value))
    }


    return (
        <>
            {pois.current && current &&
                <SlSelect label={'Category'} value={current.category} size={props?.size ?? 'small'}
                          className="map-poi-categorie-selector"
                          onSlChange={handleCategory}>

                    <FontAwesomeIcon slot="prefix" icon={current.icon} style={{
                        '--fa-secondary-color': current.bgColor,
                        '--fa-secondary-opacity': 1,
                        '--fa-primary-color':   current.color,
                        '--fa-primary-opacity':   1,
                    }} className={'square-button'}/>

                    {Array.from(pois.categories).map(([slug, category]) =>
                                                         <SlOption key={slug} value={slug}>
                                                             <FontAwesomeIcon slot="prefix"
                                                                              icon={Object.values(POI_CATEGORY_ICONS.get(slug))[0]}
                                                                              style={{
                                                                                  '--fa-secondary-color': current.bgColor,
                                                                                  '--fa-secondary-opacity': 1,
                                                                                  '--fa-primary-color':   current.color,

                                                                                  '--fa-primary-opacity': 1,
                                                                                  // 'color':current.color
                                                                              }}/>
                                                             {category.title}
                                                         </SlOption>,
                    )}
                </SlSelect>
            }</>
    )
}