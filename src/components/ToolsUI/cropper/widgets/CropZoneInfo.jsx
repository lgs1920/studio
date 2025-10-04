/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropZoneInfo.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-04
 * Last modified: 2025-10-04
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

export const CropZoneInfo = ({info}) => {
    if (!info) {
        return null
    }
    return (
        <>
            <span>{Math.floor(info.left)}×{Math.floor(info.top)}</span><span>{Math.floor(info.width)}×{Math.floor(info.height)}</span>
        </>
    )
}