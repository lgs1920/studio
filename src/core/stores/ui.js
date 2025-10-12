/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ui.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-12
 * Last modified: 2025-10-12
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { proxyMap } from 'valtio/utils'

/**
 * UI Store - Manages all user interface state
 * Separated from main store to avoid conflicts and improve performance
 */
export const ui = {
    device: {
        portrait:  false,
        landscape: false,
        tablet:    false,
        mobile:    false,
        desktop:   false,
    },
    drawers: {
        open:   null,
        over:   false,
        action: null,
    },

    modals: {
        altitudeChoice: {
            show:  false,
            model: 'terrain',
        },
    },

    mainUI: {
        show:                false,
        journeyLoader:       {visible: false},
        support:             {visible: false},
        journeyMenu:         {timeout: 0, active: false},
        removeJourneyDialog: {active: proxyMap()},
        rotate:              {
            clockwise: false,
            running:   false,
            target:    false,
            rpm:       4,
        },
    },

    welcome: {
        modal: false,
        flag:  false,
    },

    informationPanel: {
        tab: null,
    },

    video: {
        quality: null,
        ratio:   null,
        fps:     null,
        url: null,
        editing:         false,
        recording:       false,
        paused:          false,
        finalizing: false,
        size:       0,
        step:    0,
        toolbarPosition: {},
        cropper: {
            ratioEditor: true,
            draggable:   true,
            resizable:   true,
            qualityEditor: true,
            fpsEditor: true,
            widgetEditor: false,
            cropZone:  null,
            forceEven: true,
            id:        'video-crop-zone',
        },
        conversion: {
            videoUrl:          null,
            convertedVideoUrl: null,
            isDialogOpen:      false,
            metadata:          null,
            finalFilename:     '',
            duration:          0,
            convertedTime:     0,
            doConversion:      false,
            isConverting:      false,
            isConverted:       false,
            inputFormat:       null,
            progress:          {
                percentage: 0,
                time:       0,
            },
            errorMessage:      null,
        },
    },

    appUpdate: {
        isInstallPromptAvailable: false,
        isUpdateAvailable:        false,
        version:                  null,
        build:                    null,
        installOutcome:           null,
        promptInstall:            null,
        applyUpdate:              null,
    },
}