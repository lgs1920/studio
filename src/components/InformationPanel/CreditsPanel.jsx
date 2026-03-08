/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CreditsPanel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-08
 * Last modified: 2026-03-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import { WaCard } from '@web.awesome.me/webawesome-pro/dist/react'
import React                        from 'react'
import { default as ReactMarkdown } from 'react-markdown'
import { markdown as engine }    from '../../../src/assets/credits/credits-engine.md'
import { markdown as geocoding } from '../../../src/assets/credits/credits-geocoding.md'
import { markdown as providers } from '../../../src/assets/credits/credits-map-providers.md'
import { markdown as code }      from '../../../src/assets/credits/credits-open-source-code.md'

export const CreditsPanel = () => {

    return (
        <LGSScrollbars>
            <WaCard>
            <h1>{'Credits'}</h1>
            <ReactMarkdown children={engine}/>
            <ReactMarkdown children={providers}/>
            <ReactMarkdown children={geocoding}/>
            <ReactMarkdown children={code}/>
            </WaCard>
        </LGSScrollbars>
    )

}
