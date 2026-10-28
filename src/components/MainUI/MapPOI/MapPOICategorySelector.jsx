/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOICategorySelector.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-03-10
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ICONS_PATH, POI_CATEGORY_ICONS } from '@Core/constants'
import { applyPOIDuotoneIconStyles }      from '@Components/MainUI/MapPOI/duotoneIconUtils'
import { WaIcon, WaOption, WaSelect } from '@awesome.me/webawesome/dist/react'
import { useMemo }                        from 'react'
import { useSnapshot }                    from 'valtio'

/**
 * Render a POI category selector using the current POI's colors and category.
 *
 * @param {Object} props - Component properties.
 * @param {Object} props.point - The POI displayed by the editor.
 * @param {boolean} [props.disabled=false] - Whether the category can be changed.
 * @returns {JSX.Element|null} The category selector when a current POI exists.
 */
export const MapPOICategorySelector = ({point: current, props, disabled = false}) => {
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)

    /**
     * Persist the selected category on the current POI.
     *
     * @param {Event} event - Web Awesome select change event.
     * @returns {void}
     */
    const handleCategory = (event) => {
        __.ui.poiManager.updatePOI(pois.current, {
            category: event.target.value,
        }, {markAsEdited: true})
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
                          disabled={disabled}
                          onChange={handleCategory}>
                    {categoryOptions}
                </WaSelect>
            }</>
    )
}
