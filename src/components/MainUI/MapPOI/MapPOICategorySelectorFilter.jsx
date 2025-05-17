/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOICategorySelectorFilter.jsx
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

import { FontAwesomeIcon }                            from '@Components/FontAwesomeIcon'
import { POI_CATEGORY_ICONS }                         from '@Core/constants'
import { faTrashCan }                                 from '@fortawesome/pro-regular-svg-icons'
import { SlIconButton, SlOption, SlSelect, SlSwitch } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                      from '@Utils/FA2SL'
import { useEffect }                                  from 'react'
import { useSnapshot }                                from 'valtio'

export const MapPOICategorySelectorFilter = (props) => {

    const settings = useSnapshot(lgs.settings.poi)
    const $pois = lgs.mainProxy.components.pois
    const pois = useSnapshot($pois)

    useEffect(() => {
        if (!settings.filter.byCategories) {
            lgs.settings.poi.filter.byCategories = []
        }
        props.onChange()
    }, [lgs.settings.poi.filter.exclude, lgs.settings.poi.filter.byCategories])

    return (
        <SlSelect value={settings.filter.byCategories} size={props?.size ?? 'small'}
                  className="map-poi-categorie-selector-filter" multiple onSlChange={props.handleCategories}
                  placeholder="Select categories" clearable
        >
            <FontAwesomeIcon slot="clear-icon" icon={faTrashCan}/>
            {Array.from(pois.categories).map(([slug, category]) =>
                                                 <SlOption key={slug} value={slug}>
                                                     <FontAwesomeIcon slot="prefix"
                                                                      icon={Object.values(POI_CATEGORY_ICONS.get(slug))[0]}
                                                                      style={{
                                                                          '--fa-secondary-color': 'var(--lgs-light-color)',
                                                                          '--fa-secondary-opacity': 1,
                                                                          '--fa-primary-color':   'var(--lgs-dark-color)',

                                                                          '--fa-primary-opacity':   1,
                                                                      }}/>
                                                     {category.title}
                                                 </SlOption>,
            )}

            <div className="map-poi-category-filter" slot="label">
                <span>{'By Categories'}</span>
                {settings.filter.byCategories.length > 0 &&
                    <SlSwitch size="small" align-right checked={settings.filter.exclude}
                              onSlChange={props.handleExclusion}>
                        {'Exclude'}
                    </SlSwitch>
                }
            </div>
        </SlSelect>
    )
}