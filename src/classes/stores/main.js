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
            journeyListKey: 0,
            journeySettingsKey: 0,
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

    },
    modals: {
        altitudeChoice: {
            show: false,
            model: 'terrain',
        },
    },
    theJourney: null,
    fullSize: false,
}