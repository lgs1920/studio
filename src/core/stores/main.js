/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: main.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-14
 * Last modified: 2025-07-14
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { proxyMap } from 'valtio/utils'

export const main = {
    components: {
        // mainUI, welcome, informationPanel moved to lgs.stores.ui.informationPanel

        fileLoader: {
            accepted: 0,
            error:    '',
            dragging: {
                active: null,
                files: [],
            },
            fileList: new proxyMap(),
            empty:    true,
        },

        camera: {
            position: {},
            target: {},
            event:  false,
            targetIcon: {},
        },

        journeyEditor: {
            list: [],
            keys: {
                journey: {
                    list: 0,
                    settings: 0,
                },
                track: {
                    list: 5000,
                    settings: 0,
                },
            },
        },

        pois: {
            list:     new proxyMap(),
            categories: new proxyMap(),
            current: false,
            context: {
                visible: false,
                timer: 'context-timer',
            },
            editor: {
                visible: false,
                active: false,
            },
            bulkList: new proxyMap(),
            filtered: {
                global: new proxyMap(),
                journey: new proxyMap(),
            },
            visibleList: new proxyMap(),
        },

        profile: {
            visible: false,
            show:  false,
            key:   0,
            width: '100%',
            height: '100%',
            zoom:  false,
        },

        settings: {
            key: 0,
        },

        layers: {
            base: null,
            overlay: null,
        },

        wanderer: {
            run:   false,
            pause: false,
            forward: true,
            duration: undefined,
            loop:  false,
        },

        geocoder: {
            list:   proxyMap(),
            dialog: {
                visible:   false,
                loading:   false,
                noResults: false,
                moreResults: false,
                submitDisabled: true,
                showMore:  false,
            },
        },
        video: {
            filename: 0,
        },

        cropper: {
            x:           null,
            y:           null,
            width:       512,
            height:      360,
            draggable:   true,
            resizable:   true,
            lockRatio:   true,
            handleSize:  12,
            orientation: 'portrait',
            mode:        'ratio',
            presetValue: '16:9',
            borderColor: '#0077ff',
            handleColor: '#0077ff',
            _rafId:      null,
        },
    },

    // drawers moved to lgs.stores.ui.informationPanel
    // modals moved to lgs.stores.ui.informationPanel (except altitudeChoice which is kept here for now)

    theJourney:     null,
    readyForTheShow: false,
    fullSize:       false,
    canViewJourneyData: false,
    canViewProfile: false,
    theLayer:       null,
    theLayerOverlay: null,
}