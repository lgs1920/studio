/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileWidgetEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-21
 * Last modified: 2025-12-21
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { Compass }                                                                from '@Components/cesium/CompassUI/Compass'
import {
    Widget,
}                                                                                 from '@Components/MainUI/widgets/Widget'
import { DEFAULT_WIDGET_CONTEXT, HOUR, LGS_VISUAL_WIDGET, MULTI_PURPOSE_WIDGETS } from '@Core/constants'
import React, { useEffect, useMemo, useState }                                    from 'react'
import { proxy, useSnapshot }                                                     from 'valtio'

export const ProfileWidgetEditor = () => {

    return (
        <span>Profile Editor</span>
    )
}