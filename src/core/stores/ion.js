/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ion.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-23
 * Last modified on: 2026-06-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const ION_DEFAULT_PROMPT_DELAY_SECONDS = 480

export const ion = {
    token:                 null,
    source:                'default',
    loaded:                false,
    showPrompt:            false,
    promptMode:            null,
    timerActive:           false,
    accumulatedSeconds:    0,
    dismissedThisSession:   false,
    introSeen:             false,
    promptDelaySeconds:     ION_DEFAULT_PROMPT_DELAY_SECONDS,
    promptWarningPercent:   80,
}
