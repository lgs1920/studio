/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOICategorySelector.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-24
 * Last modified: 2026-04-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ICONS_PATH, POI_CATEGORY_ICONS } from '@Core/constants'
import { applyPOIDuotoneIconStyles }      from '@Components/MainUI/MapPOI/duotoneIconUtils'
import { WaIcon, WaOption, WaSelect } from '@web.awesome.me/webawesome-pro/dist/react'
import { useMemo }                        from 'react'
import { useSnapshot }                    from 'valtio'

export const MapPOICategorySelector = ({point: current, props}) => {
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)

    const handleCategory = (event) => {
        __.ui.poiManager.updatePOI(pois.current, {
            category: event.target.value,
        })
    }

    const categoryOptions = useMemo(() => {
        return Array.from(pois.categories).map(([slug, category]) => {
            const iconName = POI_CATEGORY_ICONS.get(slug)
            const isSvg = iconName?.endsWith('.svg')

            return (
                <WaOption key={slug} value={slug}>
                    <WaIcon
                        slot="start"
                        src={isSvg ? `${ICONS_PATH}/${iconName}` : ''}
                        name={!isSvg ? iconName : ''}
                        className="poi-duotone-icon"
                        variant="regular"
                        family="duotone"
                        onWaLoad={applyPOIDuotoneIconStyles}
                    />
                    {category.title}
                </WaOption>
            )
        })
    }, [pois.categories])

    const duotoneVars = {
        '--poi-primary-default-color':   current?.color ?? 'var(--wa-color-yellow-60)',
        '--poi-secondary-default-color': current?.bgColor ?? 'var(--wa-color-gray-10)',
        '--primary-color':               'var(--poi-primary-default-color)',
        '--secondary-color':             'var(--poi-secondary-default-color)',
        '--primary-opacity':             'var(--poi-primary-default-opacity)',
        '--secondary-opacity':           'var(--poi-secondary-default-opacity)',
    }

    return (
        <>
            {pois.current && current &&
                <WaSelect appearance="filled" label={'Category'} value={current.category} size={props?.size ?? 'small'}
                          className="map-poi-category-selector"
                          style={duotoneVars}
                          onChange={handleCategory}>
                    {categoryOptions}
                </WaSelect>
            }</>
    )
}
