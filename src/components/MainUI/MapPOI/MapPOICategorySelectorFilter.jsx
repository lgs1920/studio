/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOICategorySelectorFilter.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-22
 * Last modified: 2026-03-21
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaCombobox, WaIcon, WaOption, WaSwitch } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useEffect, useMemo }               from 'react'
import { useSnapshot }                            from 'valtio'
import { ICONS_PATH, POI_CATEGORY_ICONS }         from '@Core/constants'

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
                        variant="regular"
                        family="duotone"
                    />
                    {category.title}
                </WaOption>
            )
        })
    }, [pois.categories])

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
                    size="xsmall"
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
        <WaCombobox
            value={settings.filter.byCategories}
            size={size}
            className="map-poi-category-selector-filter"
            multiple
            onChange={handleCategories}
            placeholder="Select categories"
            with-clear
        >
            {labelSlot}
            {categoryOptions}
        </WaCombobox>
    )
})