/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOICategorySelectorFilter.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaIcon, WaOption, WaSelect, WaSwitch } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useEffect, useMemo }               from 'react'
import { useSnapshot }                            from 'valtio'
import { ICONS_PATH, POI_CATEGORY_ICONS }         from '@Core/constants'
import { applyPOIDuotoneIconStyles }            from '@Components/MainUI/MapPOI/duotoneIconUtils'

/**
 * A memoized React component for selecting and filtering POI categories.
 */
export const MapPOICategorySelectorFilter = memo(({
                                                      onChange,
                                                      handleCategories,
                                                      handleExclusion,
                                                      exclude,
                                                      size = 'small',
                                                  }) => {
    const settings = useSnapshot(lgs.settings.poi)
    const $pois = lgs.stores.main.components.pois
    const pois = useSnapshot($pois)

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

    const duotoneVars = useMemo(() => ({
        '--primary-color':     'var(--poi-primary-default-color)',
        '--secondary-color':   'var(--poi-secondary-default-color)',
        '--primary-opacity':   'var(--poi-primary-default-opacity)',
        '--secondary-opacity': 'var(--poi-secondary-default-opacity)',
    }), [])

    const labelSlot = useMemo(() => (
        <div
            slot="label"
            className="map-poi-category-filter"
            style={{
                display:        'flex',
                justifyContent: 'space-between',
                alignItems:     'center',
                width:          '100%',
            }}
        >
            <span>{'By Categories'}</span>
            {settings.filter.byCategories.length > 0 && (
                <WaSwitch
                    size="xs"
                    checked={exclude}
                    label-at-start
                    onClick={(e) => e.stopPropagation()}
                    onChange={handleExclusion}
                > {'Exclude'}
                </WaSwitch>
            )}
        </div>
    ), [settings.filter.byCategories.length, exclude, handleExclusion])

    useEffect(() => {
        onChange()
    }, [settings.filter.byCategories, exclude, onChange])

    return (
        <WaSelect
            value={settings.filter.byCategories}
            size={size}
            className="map-poi-category-selector"
            style={duotoneVars}
            multiple
            onChange={handleCategories}
            placeholder="Select categories"
            with-clear
        >
            {labelSlot}
            {categoryOptions}
        </WaSelect>
    )
})
