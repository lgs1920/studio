/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyGroupsButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-06
 * Last modified: 2026-05-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JOURNEY_GROUPS_DRAWER }          from '@Core/constants'
import { WaButton, WaIcon, WaTooltip }    from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useCallback, useMemo }     from 'react'
import { useSnapshot }                    from 'valtio'

export const JourneyGroupsButton = memo(({
                                             id = 'open-journey-groups',
                                             tooltip = 'bottom',
                                             className = '',
                                             size = 'small',
                                             appearance = 'plain',
                                             filled = false,
                                             stacked = false,
                                         }) => {
    const {list} = useSnapshot(lgs.stores.main.components.journeyEditor)
    const editorStore = useSnapshot(lgs.theJourneyEditorProxy)
    const hasJourneys = list.length > 0
    const currentJourneySlug = editorStore.journey?.slug ?? lgs.theJourney?.slug ?? null

    const buttonClassName = useMemo(() => className || undefined, [className])

    const openGroupsDrawer = useCallback((event) => {
        event?.stopPropagation?.()
        __.ui.drawerManager.open(JOURNEY_GROUPS_DRAWER, {
            entity: currentJourneySlug,
            stacked,
        })
    }, [currentJourneySlug, stacked])

    if (!hasJourneys) {
        return null
    }

    return (
        <>
            <WaTooltip for={id} placement={tooltip}>{'Journey groups'}</WaTooltip>
            <WaButton
                id={id}
                className={buttonClassName}
                size={size}
                variant="brand"
                appearance={filled ? 'Filled' : appearance}
                onClick={openGroupsDrawer}
                aria-label="Journey groups"
            >
                <WaIcon name="folders" variant="regular"/>
            </WaButton>
        </>
    )
})
