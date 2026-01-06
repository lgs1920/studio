/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassWidgetEditor.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Compass }                                                                from '@Components/cesium/CompassUI/Compass'
import {
    Widget,
}                                                                                 from '@Components/MainUI/widgets/Widget'
import { DEFAULT_WIDGET_CONTEXT, HOUR, LGS_VISUAL_WIDGET, MULTI_PURPOSE_WIDGETS } from '@Core/constants'
import React, { useEffect, useMemo, useState }                                    from 'react'
import { proxy, useSnapshot }                                                     from 'valtio'

/**
 * CompassWidget component to display a compass in the widget editor
 * @param {Object} props - Component props
 * @param {string} props.id - Unique identifier for the widget
 * @param {Object} props.context - Valtio proxy context containing widgetsBoard and widgetEditor
 * @returns {JSX.Element|null} The compass widget or null if not in editor mode or container is not ready
 */
export const CompassWidgetEditor = () => {

    return (
        <span>Profil Editor</span>
    )
}