/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropZone.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-29
 * Last modified: 2026-04-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { useCallback, useRef } from 'react'

/**
 * CropZone component for rendering the crop zone content with imperative API.
 */
export const CropZone = ({onDoubleClick, children}) => {
    const _cropZone = useRef(null)
    const handleContextMenu = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
    }, [])

    return (
        <>
            <div
                ref={_cropZone}
                className="crop-zone"
                onDoubleClick={onDoubleClick}
                onContextMenu={handleContextMenu}
            >
                {children}
            </div>
        </>

    )
}
