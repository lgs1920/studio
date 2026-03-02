/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CreditsPanel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import React                        from 'react'
import { default as ReactMarkdown } from 'react-markdown'
import { markdown as engine }    from '../../../src/assets/credits/credits-engine.md'
import { markdown as geocoding } from '../../../src/assets/credits/credits-geocoding.md'
import { markdown as providers } from '../../../src/assets/credits/credits-map-providers.md'
import { markdown as code }      from '../../../src/assets/credits/credits-open-source-code.md'

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
