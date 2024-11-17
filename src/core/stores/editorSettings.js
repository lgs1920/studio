import { BASE_LAYERS } from '@Core/constants'


export const editorSettings = {
    layer:   {
        selectedType: BASE_LAYERS,
        infoDialog:   false,
        tokenDialog:  false,
        tmpEntity:    null,
        refreshList:  true,
        canValidate:  false,
    },
    account: {
        reset: {
            lgs1920:  false,
            settings: false,
            vault:    false,
        },
        test:  true,
    },

}