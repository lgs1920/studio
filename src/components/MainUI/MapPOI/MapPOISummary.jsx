/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOISummary.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-25
 * Last modified: 2026-03-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOIContent.jsx
 ******************************************************************************/

import { ICONS_PATH }                from '@Core/constants'
import { applyPOIDuotoneIconStyles } from '@Components/MainUI/MapPOI/duotoneIconUtils'
import { WaIcon }                    from '@web.awesome.me/webawesome-pro/dist/react'
import { useMemo }                   from 'react'
import { useSnapshot }               from 'valtio'
import './style.css'

export const MapPOISummary = ({poi, useInMenu = false, category = null, style, slot}) => {
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)
    const point = useMemo(() => pois.list.get(poi), [pois.list, poi])

    const iconName = point.categoryIcon(point.category)
    const isSvg = iconName?.endsWith('.svg')

    return (
        <div className="map-poi-edit-summary">
            <span>
                <WaIcon name={point?.visible ? (!isSvg ? iconName : '') : 'mask'}
                        src={isSvg ? `${ICONS_PATH}/${iconName}` : ''}
                        className="poi-duotone-icon"
                        variant="regular" family="duotone"
                        onWaLoad={applyPOIDuotoneIconStyles}
                />
                <span>{point.title}</span>
            </span>
            {point?.visible &&
                <span>
                        <WaIcon name="square" style={{color: point.bgColor}} variant="solid"/>
                        <WaIcon name="square" style={{color: point.color}} variant="solid"/>
                    </span>
            }

        </div>
    )
}
