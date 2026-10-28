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
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {WaButton, WaIcon} from '@awesome.me/webawesome/dist/react'
import {useSnapshot, proxy} from 'valtio'

const EMPTY_POI_PROXY = proxy({})

/** Render the POI title and the shared edit action inside a creation toast.
 * @param {{poi: {id: string, title?: string}, canEdit: boolean, onEdit: () => void}} props - Toast content props.
 * @returns {JSX.Element} POI title and edit action.
 */
export const POICreationToastContent = ({poi, canEdit, onEdit}) => {
    const $poi = lgs.stores.main.components.pois.list.get(poi?.id)
    const currentPOI = useSnapshot($poi ?? EMPTY_POI_PROXY)
    const title = currentPOI.title || poi?.title || ''

    return (
        <div className="toast-action-stack">
            <div>{title}</div>
            {canEdit && (
                <WaButton
                    className="toast-action-button"
                    appearance="filled"
                    size="s"
                    variant="brand"
                    onClick={onEdit}
                >
                    <WaIcon slot="start" size="s" name="pen-to-square" variant="regular"/>{'Edit'}
                </WaButton>
            )}
        </div>
    )
}
