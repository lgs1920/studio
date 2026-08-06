/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: editorSettings.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

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
            widgets: false,
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
        drawer: '',
        toolBar: '',
    },

}