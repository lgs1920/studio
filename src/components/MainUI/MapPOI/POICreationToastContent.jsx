/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: POICreationToastContent.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-28
 * Last modified: 2026-11-04
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {WaButton, WaIcon} from '@awesome.me/webawesome/dist/react'
import { UI_ACTIONS } from '@Core/ui/metadata/uiActionCatalog'
import {useSnapshot, proxy} from 'valtio'

const EMPTY_POI_PROXY = proxy({})

/** Render a POI title, optional message, and shared edit action inside a toast.
 * @param {{poi: {id: string, title?: string}, canEdit: boolean, onEdit: () => void, message?: string, action?: {label: string, icon: Object}}} props - Toast content props.
 * @returns {JSX.Element} POI message, title, and optional edit action.
 */
export const POICreationToastContent = ({poi, canEdit, onEdit, message, action = UI_ACTIONS.edit}) => {
    const $poi = lgs.stores.main.components.pois.list.get(poi?.id)
    const currentPOI = useSnapshot($poi ?? EMPTY_POI_PROXY)
    const title = currentPOI.title || poi?.title || ''

    return (
        <div className="toast-action-stack">
            {message && <div>{message}</div>}
            <div>{title}</div>
            {canEdit && (
                <WaButton
                    className="toast-action-button"
                    appearance="filled"
                    size="s"
                    variant="brand"
                    onClick={onEdit}
                >
                    <WaIcon slot="start" size="s" {...action.icon}/>{action.label}
                </WaButton>
            )}
        </div>
    )
}
