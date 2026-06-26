/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: main.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-25
 * Last modified: 2026-04-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: main.js
 ******************************************************************************/

import { proxyMap } from 'valtio/utils'

export const main = {
    components: {
        fileLoader: {
            fileList: new proxyMap(),
            loadSample: false,
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

            /**
             * Valorize filtered maps based on current POI states
             * Must be called after data load or visibility changes
             */
            updateFiltered() {
                this.filtered.global.clear()
                this.filtered.journey.clear()

                this.list.forEach(($poi, id) => {
                    // Global list: usually based on visibility
                    if ($poi.visible !== false) {
                        this.filtered.global.set(id, true)
                    }

                    // Journey list: based on inJourney flag
                    if ($poi.inJourney) {
                        this.filtered.journey.set(id, true)
                    }
                })
            },
        },

        profile: {
            key:           0,
            elevationData: 0,
            width:  '500px',
            height: '200px',
            show:          false,
            zoom:  false,
        },

        journeyStats: {
            show: false,
        },

        settings: {
            key: 0,
        },

        layers: {
            base: null,
            base3d: null,
            overlay: null,
            tiles3d: null,
        },

        flythroughRunner: {
            run:   false,
            pause: false,
            forward: true,
            duration: undefined,
            loop:  false,
        },

        geocoder: {
            list:   proxyMap(),
            dialog: {
                mounted: false,
                visible:   false,
                loading:   false,
                noResults: false,
                moreResults: false,
                error:   false,
                submitDisabled: true,
                showMore:  false,
            },
        },
    },

    theJourney:     null,
    readyForTheShow: false,
    fullSize:       false,
    canViewJourneyData: false,
    canViewProfile: false,
    theLayer:       null,
    theBase3DLayer: null,
    theLayerOverlay: null,
    theTiles3DLayer: null,
}
