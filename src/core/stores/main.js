import { proxyMap } from 'valtio/vanilla/utils/proxyMap'

export const main = {
    components: {

        mainUI:{
            show:false,
            journeyLoader: {visible:  false},



            support: {visible:false}
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
            show: false,
            showTarget: false,
            position: {},
            event: false,
        },

        journeyEditor: {
            visible: false,
            show: false,
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
        },
        wanderer: {
            run: false,
            pause:false,
            forward: true,
            duration: undefined,
            loop:false
        },

        informationPanel:{
            visible:false,
            tab:null
        }


    },
    modals: {
        altitudeChoice: {
            show: false,
            model: 'terrain',
        },
    },
    theJourney: null,
    fullSize: false,
    canViewJourneyData: false,
    canViewProfile: false,
    layer: false,
}