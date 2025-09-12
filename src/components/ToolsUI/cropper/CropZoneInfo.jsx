/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropZoneInfo.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-12
 * Last modified: 2025-09-12
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

export const CropZoneInfo = ({info}) => {
    return (
        <>
            <span>{info.x}×{info.y}</span><span>{info.width}×{info.height}</span>
        </>
    )
}