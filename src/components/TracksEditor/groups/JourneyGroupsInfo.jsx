/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyGroupsInfo.jsx
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

import { JOURNEY_GROUPS_DRAWER }       from '@Core/constants'
import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo, useCallback, useMemo }  from 'react'
import { useSnapshot }                 from 'valtio'

export const JourneyGroupColorIcon = ({color}) => (
    <WaIcon
        name="square"
        variant="solid"
        className="journey-group-color-icon"
        style={{color}}
    />
)

export const JourneyGroupChip = ({group}) => (
    <span className="journey-group-chip" title={group.description || group.name}>
        <JourneyGroupColorIcon color={group.color}/>
        <WaIcon name="folder" variant="regular"/>
        <span>{group.name}</span>
    </span>
)

export const JourneyGroupsInfo = memo(({journey}) => {
    const groupStore = useSnapshot(lgs.stores.ui.journeyGroups)
    const journeySlug = journey?.slug ?? null
    const buttonId = useMemo(() => `open-journey-groups-from-editor-${journeySlug?.replace(/[^\w-]/g, '-') ?? 'none'}`, [journeySlug])

    const groups = useMemo(() => {
        void groupStore.version
        return __.ui.journeyGroupManager?.groupsForJourney?.(journeySlug) ?? []
    }, [groupStore.version, journeySlug])

    const openGroupsDrawer = useCallback(() => {
        if (!journeySlug) {
            return
        }

        __.ui.drawerManager.open(JOURNEY_GROUPS_DRAWER, {
            entity:  journeySlug,
            stacked: true,
        })
    }, [journeySlug])

    if (!journey) {
        return null
    }

    return (
        <div className="lgs--journey-groups-info">
            <div className="lgs--journey-groups-info-label">
                <WaIcon name="folders" variant="regular"/>
                <span>{'Groups'}</span>
            </div>
            <div className="lgs--journey-groups-info-content">
                {groups.length > 0
                 ? groups.map(group => <JourneyGroupChip key={group.id} group={group}/>)
                 : <span className="lgs--journey-groups-empty">{'No group'}</span>}
            </div>
            <WaTooltip placement="bottom" for={buttonId}>{'Manage journey groups'}</WaTooltip>
            <WaButton
                id={buttonId}
                size="small"
                variant="brand"
                appearance="plain"
                onClick={openGroupsDrawer}
                aria-label="Manage journey groups"
            >
                <WaIcon name="folders" variant="regular"/>
            </WaButton>
        </div>
    )
})
