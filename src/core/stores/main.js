export const main = {
    components: {
        camera: {
            show: false,
            position: {},
        },
        credits: {show: false},
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
        },

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
}