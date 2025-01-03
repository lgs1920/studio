import { BASE_ENTITY } from '@Core/constants'


export const editorSettings = {
    layer:   {
        selectedType: BASE_ENTITY,
        selectedLayer: null,
        infoDialog:   false,
        tokenDialog:  false,
        tmpEntity:    null,
        refreshList:  true,
        canValidate:  false,
        settingsChanged: false,
    },
    account: {
        reset: {
            lgs1920:  false,
            settings: false,
            vault:    false,
        },
        test:  true,
    },

    welcome: {
        autoClose: null,
        showIntro: null,
    },

    camera: {
        showTargetPosition: null,
    },

    menu: {
        selected: false,
    },

}