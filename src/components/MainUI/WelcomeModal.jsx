import { faMountains, faRoute }                   from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlCheckbox, SlDialog, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { useState }                               from 'react'
import { default as ReactMarkdown }               from 'react-markdown'
import { useSnapshot }                            from 'valtio'
import { TrackUtils }                             from '../../Utils/cesium/TrackUtils.js'
import { FA2SL }                                  from '../../Utils/FA2SL.js'
import text                                       from '../pages/welcome.md'

export const WelcomeModal = () => {
    const [open, setOpen] = useState(true)

    const close = (event) => {
        if (event.detail.source === 'overlay') {
            lgs.mainUIStore.show = true
        }
    }

    const hide = () => {
        setOpen(false)
        lgs.mainUIStore.show = true
    }

    const enter = () => {
        hide()
    }

    const snapshot = useSnapshot(lgs.journeyEditorStore)
    return (
        <>
            <SlDialog open={open}
                      modal
                      no-header
                      id={'welcome-modal'}
                      onSlRequestClose={close}
                      onSlAfterHide={hide}>
                <ReactMarkdown children={text}/>
                <div slot="footer">
                    <div id={'footer'}>
                        <SlCheckbox size={'small'}>Don't show this intro anymore</SlCheckbox>
                        {snapshot.list !== undefined &&
                        <div className="buttons-bar">

                            <SlButton /*onClick={handleConfirm}*/ >{'What\'s new ?'}</SlButton>
                            {snapshot.list.length > 0 &&
                                <SlButton autofocus variant="primary" onClick={enter} >
                                    <SlIcon library="fa" name={FA2SL.set(faMountains)}></SlIcon>{'Enter'}
                                </SlButton>
                            }
                            {snapshot.list.length === 0 &&
                                <SlButton autofocus variant="primary" onClick={TrackUtils.uploadJourneyFile}>
                                    <SlIcon library="fa" name={FA2SL.set(faRoute)}></SlIcon>{'Load your first Journey'}
                                </SlButton>
                            }
                        </div>
                        }
                    </div>
                </div>
            </SlDialog>
        </>
    )
}