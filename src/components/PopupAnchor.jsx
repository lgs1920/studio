/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PopupAnchor.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-03-21
 * Last modified: 2026-03-21
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { memo } from 'react'

export const PopupAnchor = memo(({id = null, slot = null}) => {
    return (<hr {...(id && {id})} {...(slot && {slot})} className="lgs--popup-anchor"/>)
})

export default PopupAnchor
