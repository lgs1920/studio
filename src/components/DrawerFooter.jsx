/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DrawerFooter.jsx
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

import { faGithub }       from '@fortawesome/free-brands-svg-icons'
import { faGlobePointer } from '@fortawesome/pro-regular-svg-icons'
import { SlIconButton }   from '@shoelace-style/shoelace/dist/react'
import { FA2SL }          from '@Utils/FA2SL'
import React              from 'react'

// Memoized component for performance
const DrawerFooter = React.memo(() => (
    <div className="drawer-pane-footer credits-pane-footer" slot="footer">
        <div>
            <strong>{lgs?.servers?.studio?.shortname || 'Studio'}</strong>
            <span>{lgs?.versions?.studio || 'N/A'}</span>
        </div>
        <div>
            <strong>{lgs?.servers?.backend?.shortname || 'Backend'}</strong>
            <span>{lgs?.versions?.backend || 'N/A'}</span>
        </div>
        <div>
            <strong>{lgs?.configuration?.api?.name || 'API'}</strong>
            <span>{lgs?.versions?.api || 'N/A'}</span>
        </div>
        <div className="drawer-footer-url">
            <SlIconButton
                library="fa"
                name={FA2SL.set(faGlobePointer)}
                target="_blank"
                href={__.app.buildUrl(lgs?.configuration?.website || 'https://lgs1920.fr')}
                title="Our Site"
            />
            <SlIconButton
                library="fa"
                name={FA2SL.set(faGithub)}
                target="_blank"
                href={lgs?.configuration?.githubURL || 'https://github.com/lgs1920'}
                title="Our GitHub repos"
            />
        </div>
    </div>
))

export default DrawerFooter