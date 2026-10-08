/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetContexts.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-08
 * Last modified: 2026-10-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { createContext } from 'react'

/** Marks widgets rendered in a video preview portal. */
export const WidgetPreviewContext = createContext(false)

/** Marks widget content rendered without its interactive host shell. */
export const WidgetContentOnlyContext = createContext(false)
