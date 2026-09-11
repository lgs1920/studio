/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: InfoLayerModal.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-11-07
 * Last modified: 2026-09-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import { WaButton, WaDialog, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import React, { useEffect, useState }            from 'react'
import { default as ReactMarkdown }   from 'react-markdown'
import { useSnapshot }                from 'valtio'
import infoText from './info-layer.md?raw'

export const InfoLayerModal = () => {
    const editor = lgs.editorSettingsProxy
    const snap = useSnapshot(editor)
    const [showScrollHint, setShowScrollHint] = useState(true)

    const closeInfoModal = () => editor.layer.infoDialog = false

    useEffect(() => {
        if (snap.layer.infoDialog) {
            setShowScrollHint(true)
        }
    }, [snap.layer.infoDialog])

    return (
        <WaDialog open={snap.layer.infoDialog}
                  onAfterHide={closeInfoModal}
                  className={'lgs-theme'}
                  id={'info-layer-modal'}>
            <div slot="label">
                <WaIcon name="bell-exclamation" variant={'regular'}/>{'Disclaimer'}
            </div>

            <LGSScrollbars onScrollStateChange={scrolled => setShowScrollHint(!scrolled)}>
                <div>
                    <ReactMarkdown>{infoText}</ReactMarkdown>
                </div>
            </LGSScrollbars>

            <div slot="footer" className="lgs--info-layer-footer">
                <div className={`lgs--info-layer-scroll-hint${showScrollHint ? '' : ' is-hidden'}`}>
                    <WaIcon name="arrow-down" variant="regular"/>
                    <span>{'Scroll down'}</span>
                </div>
                <WaButton variant="brand" onClick={closeInfoModal}>
                    <WaIcon slot="start" name="check" variant={'regular'}/>{'Close'}
                </WaButton>
            </div>
        </WaDialog>
    )


}
