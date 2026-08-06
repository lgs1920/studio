/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LicensePanel.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-16
 * Last modified: 2026-07-16
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars }              from '@Components/MainUI/LGSScrollbars'
import { WaCard, WaIcon }             from '@web.awesome.me/webawesome-pro/dist/react'
import { default as ReactMarkdown }   from 'react-markdown'
import { markdown as license }        from '../../../LICENSE.md'
import { markdown as contributorCLA } from '../../../CONTRIBUTOR_LICENSE_AGREEMENT.md'

export const LicensePanel = () => (
    <LGSScrollbars>
        <div className="lgs--license-panel">
            <WaCard appearance="filled-outlined">
                <section className="lgs--license-summary">
                    <h2>{'Licensing and Contributions'}</h2>
                    <p>
                        {'LGS1920 Studio is distributed as free software under the GNU Affero General Public License v3.0 or later.'}
                    </p>
                    <div className="lgs--license-summary-items">
                        <div>
                            <h3>
                                <WaIcon name="scale-balanced" variant="regular"/>
                                {'License'}
                            </h3>
                            <p>
                                {'The AGPL defines the rights and obligations for using, modifying, distributing, or running modified versions of the application over a network.'}
                            </p>
                        </div>
                        <div>
                            <h3>
                                <WaIcon name="file-signature" variant="regular"/>
                                {'Contributor terms'}
                            </h3>
                            <p>
                                {'The contributor terms confirm that submitted contributions remain owned by their authors and are licensed under the same AGPL terms.'}
                            </p>
                        </div>
                    </div>
                    <p className="lgs--license-note">
                        {'The documents below are the reference text for the project license and contributor agreement.'}
                    </p>
                </section>
            </WaCard>

            <WaCard className="lgs--license-document">
                <section className="lgs--license-markdown">
                    <ReactMarkdown>{license}</ReactMarkdown>
                </section>
            </WaCard>

            <WaCard className="lgs--license-document">
                <section className="lgs--license-markdown">
                    <ReactMarkdown>{contributorCLA}</ReactMarkdown>
                </section>
            </WaCard>
        </div>
    </LGSScrollbars>
)
