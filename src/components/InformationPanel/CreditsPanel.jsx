/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CreditsPanel.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-06-17
 * Last modified: 2026-10-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import { WaButton, WaCard } from '@awesome.me/webawesome/dist/react'
import React                        from 'react'
import { default as ReactMarkdown } from 'react-markdown'
import { markdown as engine }    from '../../../src/assets/credits/credits-engine.md'
import { markdown as geocoding } from '../../../src/assets/credits/credits-geocoding.md'
import { markdown as mediaAssets } from '../../../src/assets/credits/credits-media-assets.md'
import { markdown as providers } from '../../../src/assets/credits/credits-map-providers.md'
import { markdown as code }      from '../../../src/assets/credits/credits-open-source-code.md'
import { openCodeDependenciesDrawer } from './openCodeDependenciesDrawer'

/**
 * Renders the credits content for the information drawer.
 *
 * @returns {JSX.Element}
 */
export const CreditsPanel = () => {

    return (
        <LGSScrollbars>
            <WaCard className="lgs--credits-list">
                <h1>{'Credits'}</h1>
                <ReactMarkdown children={engine}/>
                <ReactMarkdown children={providers}/>
                <ReactMarkdown children={geocoding}/>
                <ReactMarkdown children={mediaAssets}/>
                <ReactMarkdown children={code}/>
                <WaButton className="lgs--credits-dependencies-button"
                          size="s"
                          appearance="plain"
                          variant="brand"
                          onClick={openCodeDependenciesDrawer}>
                    {'Other dependencies'}
                </WaButton>
            </WaCard>
        </LGSScrollbars>
    )

}
