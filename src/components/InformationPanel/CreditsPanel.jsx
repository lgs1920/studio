/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CreditsPanel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-01
 * Last modified: 2025-07-01
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import React                        from 'react'
import { default as ReactMarkdown } from 'react-markdown'
import engine                       from '../../../src/assets/credits/credits-engine.md'
import geocoding                    from '../../../src/assets/credits/credits-geocoding.md'
import providers                    from '../../../src/assets/credits/credits-map-providers.md'
import code                         from '../../../src/assets/credits/credits-open-source-code.md'

export const CreditsPanel = () => {

    return (
        <LGSScrollbars>
            <h1>{'Credits'}</h1>
            <ReactMarkdown children={engine}/>
            <ReactMarkdown children={providers}/>
            <ReactMarkdown children={geocoding}/>
            <ReactMarkdown children={code}/>
        </LGSScrollbars>
    )

}
