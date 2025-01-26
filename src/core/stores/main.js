import { proxyMap } from 'valtio/utils'

export const main = {
    components: {

        mainUI:{
            show:false,
            journeyLoader: {visible:  false},
            support: {visible: false},

            journeyMenu:         {timeout: 0, active: false},
            removeJourneyDialog: {active: proxyMap()},
        },

        fileLoader:{
            accepted: 0,
            error:'',
            dragging:     {
                active: null,
                files:  [],
            },
            fileList:new proxyMap(),
            empty:true,
        },

        camera: {
            position: {},
            target: {},
            event: false,
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
        floatingMenu: {
            coordinates: {x: 0, y: -9999},
            delay: 3,
            type: undefined,
            target: undefined,
            show: true,
            latitude: 0,
            longitude: 0,
            altitude: 0,
        },
        profile: {
            visible: false,
            show: false,
            key: 0,
            width:'100%',
            height:'100%',
            zoom:false,
        },

        settings: {
            key:     0,
        },

        layers: {
            base:    null,
            overlay: null,
        },

        wanderer: {
            run: false,
            pause:false,
            forward: true,
            duration: undefined,
            loop:false
        },

        informationPanel:{
            tab:null
        },

        welcome: {
            modal: false,
            flag:  false,
        },

        poi: {
            list: new proxyMap(),
        },

        geocoder: {
            list:   proxyMap(),
            dialog: {
                visible: false,
                loading:       false,
                noResults:     false,
                moreResults:   false,
                submitDisabled: true,
                showMore:      false,
            },
        }


    },
    drawers:    {
        open: null,
        over: false,
    },
    modals: {
        altitudeChoice: {
            show: false,
            model: 'terrain',
        },
    },
    theJourney: null,
    readyForTheShow: false,
    fullSize: false,
    canViewJourneyData: false,
    canViewProfile: false,
    theLayer: null,
    theLayerOverlay: null,
}