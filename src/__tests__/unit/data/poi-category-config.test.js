/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poi-category-config.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-24
 * Last modified: 2026-10-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {POI_CATEGORY_ICONS} from '@Core/constants'
import {LGS1920_ICON_KITS} from '@Utils/LGS1920IconLibrary'
import {readFileSync} from 'node:fs'
import {parse} from 'yaml'

const settings = parse(readFileSync(new URL('../../../../public/settings.yaml', import.meta.url), 'utf8'))

const addedCategories = [
    ['drinking-water', 'Water Point', 'faucet-drip'],
    ['source', 'Natural Spring', 'droplet'],
    ['restroom', 'Restroom', 'restroom'],
    ['cafe', 'Cafe', 'mug-hot'],
    ['restaurant', 'Restaurant', 'utensils'],
    ['trailhead', 'Trailhead', 'sign-post'],
    ['train-stop', 'Train Stop', 'train'],
    ['bus-stop', 'Bus Stop', 'bus-stop'],
    ['cable-car', 'Cable Car', 'cable-car'],
    ['winter-station', 'Winter Station', 'snowflake'],
    ['hazard', 'Hazard', 'triangle-exclamation'],
    ['first-aid', 'First Aid', 'kit-medical'],
    ['photo-spot', 'Photo Spot', 'camera'],
    ['waterfall', 'Waterfall', 'water'],
    ['bridge', 'Bridge', 'bridge'],
    ['shop', 'Shop / Supplies', 'basket-shopping'],
    ['bivouac', 'Bivouac', 'tent'],
]

const locallyRegisteredSolidIcons = new Set(
    LGS1920_ICON_KITS
        .filter(kit => kit.family === 'classic' && kit.variant === 'solid')
        .flatMap(kit => Object.values(kit.icons ?? {}).map(definition => definition.iconName)),
)

describe('POI category configuration', () => {
    it.each(addedCategories)('configures %s with a registered icon', (slug, title, iconName) => {
        expect(settings.poi.categories).toContainEqual(expect.objectContaining({slug, title}))
        expect(POI_CATEGORY_ICONS.get(slug)).toBe(iconName)
        expect(locallyRegisteredSolidIcons.has(iconName)).toBe(true)
    })

    it('keeps Refuge as the overnight shelter category without adding a duplicate lodging category', () => {
        expect(settings.poi.categories).toContainEqual(expect.objectContaining({slug: 'refuge'}))
        expect(settings.poi.categories).not.toContainEqual(expect.objectContaining({slug: 'lodging'}))
    })

    it('defines POI display defaults in YAML and leaves expanded width to the code default', () => {
        expect(settings.poi.displayDefaults).toEqual({
            category:          true,
            titleCategoryIcon: false,
            titleAltitude:     false,
            location:          false,
            altitude:          false,
            coordinates:       false,
            dateTime:          false,
        })
        expect(settings.poi.displayDefaults).not.toHaveProperty('maxWidth')
    })
})
