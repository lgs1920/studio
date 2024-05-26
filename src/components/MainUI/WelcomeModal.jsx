import { faMountains, faRoute }                   from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlCheckbox, SlDialog, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { useEffect, useState }                    from 'react'
import { default as ReactMarkdown }               from 'react-markdown'
import { useSnapshot }                            from 'valtio'
import { TrackUtils }                             from '../../Utils/cesium/TrackUtils.js'
import { FA2SL } from '../../Utils/FA2SL.js'
import welcome      from '../../assets/pages/welcome.md'
import welcomeBack      from '../../assets/pages/welcome-back.md'

export const WelcomeModal = () => {
    const [open, setOpen] = useState(true)

    const close = (event) => {
        if (event.detail.source === 'overlay') {
            lgs.mainUIStore.show = true
        }
        console.log('hide')
        lgs.settings.app.firstVisit= false

    }

    const hide = () => {
        setOpen(false)
        lgs.mainUIStore.show = true
    }

    const enter = () => {
        hide()
    }

    const setShowModal=(event)=> {
        console.log(event)
        lgs.settings.app.showIntro= !lgs.settings.app.showIntro
    }

    const TheText = ()=> {
        if (lgs.settings.app.firstVisit) {
            lgs.settings.app.firstVisit=false
            return (<ReactMarkdown children={welcome}/>)
        }
        return (<ReactMarkdown children={welcomeBack}/>)
    }

    useEffect(() => {
        const checkbox = document.getElementById('do-not-show');
        if (checkbox) {
            checkbox.addEventListener('sl-change', setShowModal);
        }
    }, [])

        const snapshot = useSnapshot(lgs.journeyEditorStore)
    return (
        <>
            {lgs.settings.snapApp.showIntro &&
            <SlDialog open={open}
                      modal
                      no-header
                      id={'welcome-modal'}
                      onSlRequestClose={close}
                      onSlAfterHide={hide}>

                <TheText/>

                <div slot="footer">
                    <div id={'footer'}>

                        <SlCheckbox id={'do-not-show'} size={'small'} >Don't show this intro anymore</SlCheckbox>

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
            }
        </>
    )
}