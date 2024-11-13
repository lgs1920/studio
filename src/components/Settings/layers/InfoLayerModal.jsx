import { faCheck }                    from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDialog, SlIcon } from '@shoelace-style/shoelace/dist/react'
import React                          from 'react'
import { default as ReactMarkdown }   from 'react-markdown'
import { useSnapshot }                from 'valtio'
import { FA2SL }                      from '../../../Utils/FA2SL'
import infoText                       from './info-layer.md'

export const InfoLayerModal = () => {
    const editor = lgs.editorSettingsProxy
    const snap = useSnapshot(editor)

    const closeInfoModal = () => editor.layer.infoDialog = false

    return (
        <SlDialog label={'Important Notice'}
                  open={snap.layer.infoDialog}
                  onSlRequestClose={closeInfoModal}
                  className={'lgs-theme'}
                  id={'info-layer-modal'}>

            <ReactMarkdown children={infoText}/>

            <SlButton slot="footer" variant="primary" onClick={closeInfoModal}>
                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faCheck)}/>
                Close
            </SlButton>
        </SlDialog>
    )


}