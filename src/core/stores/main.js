/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: main.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-26
 * Last modified: 2025-02-26
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { proxyMap } from 'valtio/utils'

export const main = {
    components:      {

        mainUI: {
            show:          false,
            journeyLoader: {visible: false},
            support:       {visible: false},

            journeyMenu:         {timeout: 0, active: false},
            removeJourneyDialog: {active: proxyMap()},
            rotate:        {
                clockwise: false,
                running:   false,
                target: false,
                rpm: 4,
            },
        },

        fileLoader: {
            accepted: 0,
            error:    '',
            dragging: {
                active: null,
                files:  [],
            },
            fileList: new proxyMap(),
            empty:    true,
        },

        camera: {
            position: {},
            target:   {},
            event:    false,
            targetIcon: {},
        },

        journeyEditor: {
            list: [],
            keys: {
                journey: {
                    list: 0,
                    settings: 0,
                },
                track:   {
                    list: 5000,
                    settings: 0,
                },
            },
        },

        pois:          {
            list:   new proxyMap(),
            categories: new proxyMap(),
            current: false,
            context: {
                visible: false,
                timer:   'context-timer',
            },
            editor: {
                visible: false,
                active: false,
            },
            bulkList:     new proxyMap(),
            filteredList: new proxyMap(),
            visibleList: new proxyMap(),
        },
        profile:       {
            visible: false,
            show:   false,
            key:    0,
            width:  '100%',
            height: '100%',
            zoom:   false,
        },

        settings: {
            key: 0,
        },

        layers: {
            base:    null,
            overlay: null,
        },

        wanderer: {
            run:     false,
            pause:   false,
            forward: true,
            duration: undefined,
            loop:    false,
        },

        informationPanel: {
            tab: null,
        },

        welcome: {
            modal: false,
            flag:  false,
        },

        geocoder: {
            list:   proxyMap(),
            dialog: {
                visible:     false,
                loading:     false,
                noResults:   false,
                moreResults: false,
                submitDisabled: true,
                showMore:    false,
            },
        },


    },
    drawers:         {
        open: null,
        over: false,
        action: null,
    },
    modals:          {
        altitudeChoice: {
            show: false,
            model: 'terrain',
        },
    },
    theJourney:      null,
    readyForTheShow: false,
    fullSize:        false,
    canViewJourneyData: false,
    canViewProfile:  false,
    theLayer:        null,
    theLayerOverlay: null,
}