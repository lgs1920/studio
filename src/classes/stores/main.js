export const main = {
    components: {
        camera: {
            show: false,
            position: {},
        },
        credits: {show: false},
        tracksEditor: {
            visible: false,
            show: false,
            list: [],
            trackListKey: 0,
            trackSettingsKey: 0,
        },
        floatingMenu: {
            coordinates: {x: 0, y: -9999},
            delay: 3000,
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
    currentTrack: null,
    fullSize: false,
}