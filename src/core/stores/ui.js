/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ui.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-01
 * Last modified: 2026-05-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DEFAULT_PANORAMA_HEIGHT_OFFSET, DEFAULT_PANORAMA_PITCH } from '@Core/OrbitSettings'
import { defaultFlythroughSettings } from '@Core/ui/flythrough/FlythroughProgressionStyle'
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
        open:                null,
        over:                false,
        action:              null,
        entity:              null,
        suppressFocusOnOpen: false,
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
        callForActions: {
            active:      false,
            initialized: false,
        },
        journeyMenu:         {timeout: 0, active: false},
        removeJourneyDialog: {active: proxyMap()},
        rotate:              {
            running:   false,
            target:    false,
            rpm:       1,
            direction: 1,
        },
        cameraFlight:        {
            running: false,
        },
        panorama:            {
            active:       false,
            target:       false,
            heightOffset: DEFAULT_PANORAMA_HEIGHT_OFFSET,
            pitch:        DEFAULT_PANORAMA_PITCH,
            heading:      0,
            rpm:          1,
            direction:    1,
        },
        flythrough:              {
            ...defaultFlythroughSettings(),
            active:        false,
            playing:       false,
            paused:        false,
            journeySlug:    null,
            trackSlug:      null,
            progress:       0,
            sample:         null,
            markerRadius:   35,
            totalDistance:  0,
            recordingSync:  false,
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
        url:     null,
        editing:         false,
        recording:       false,
        preRecording: false,
        snapshot: false,
        paused:          false,
        finalizing: false,
        size:       0,
        toolbarPosition: {},
        step:    null,
        cropper: {
            ratioEditor: true,
            presetEditor: true,
            draggable:   true,
            resizable:   true,
            qualityEditor: true,
            fpsEditor: true,
            widgetEditor: false,
            widgetsBoard: null,
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

    widget: {
        current: {
            id:                    null,
        },
        list:    new proxyMap(),
        cache: new proxyMap(),
        restrictions: new proxyMap(),
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

    contextMenu: {
        visible:  false,
        type:     null,        // 'widget' | 'poi' | ...
        targetId: null,
        position: null,
    },
}
