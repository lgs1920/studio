/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ShadowElement.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { TextElevationElement } from './TextElevationElement'

export const ShadowElement = ({element, swatches, updateValue}) => {
    return <TextElevationElement element={element} swatches={swatches} updateValue={updateValue}/>
}
