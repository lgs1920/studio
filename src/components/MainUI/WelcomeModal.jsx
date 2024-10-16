import { faRegularRouteCirclePlus }               from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import { faMountains }                            from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlCheckbox, SlDialog, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { useEffect, useState }                    from 'react'
import { default as ReactMarkdown }               from 'react-markdown'
import { useSnapshot }                            from 'valtio'
import welcomeBack                                from '../../../src/assets/modals/welcome-back.md'
import welcome                                    from '../../../src/assets/modals/welcome.md'
import { FA2SL }                                  from '../../Utils/FA2SL.js'
import { StudioLogo }                             from './StudioLogo'


export const WelcomeModal = () => {
    const [open, setOpen] = useState(true)

    const infoPanel=lgs.mainProxy.components.informationPanel
    const editorPanel = useSnapshot(lgs.journeyEditorStore)

    const close = (event) => {
        if (event.detail.source === 'overlay') {
            lgs.mainUIStore.show = true
        }
        lgs.settings.app.firstVisit= false
    }

    const hide = () => {
        setOpen(false)
        lgs.mainUIStore.show = true
    }

    function showNews() {
        hide()
        infoPanel.visible = true
    }

    const enter = () => {
        hide()
    }

    const loadJourney = () => {
        enter()
        lgs.mainUIStore.journeyLoader.visible = true
    }

    const setShowModal=(event)=> {
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

    return (
        <>
            {lgs.settings.snapApp.showIntro &&
            <SlDialog open={open}
                      modal
                      no-header
                      id={'welcome-modal'}
                      className={'lgs-theme'}
                      onSlRequestClose={close}
                      onSlAfterHide={hide}>

                <StudioLogo width={'100%'} version={true}/>
                <TheText/>

                <div slot="footer">
                    <div id={'footer'}>

                        <SlCheckbox id={'do-not-show'} size={'small'} >Don't show this intro anymore</SlCheckbox>

                        {editorPanel.list !== undefined &&
                        <div className="buttons-bar">
                            {lgs.settings.snapApp.changelogToRead &&
                            <SlButton  onClick={showNews} variant="text">{'What\'s new ?'}</SlButton>
                            }
                            {editorPanel.list.length > 0 &&
                                <SlButton autofocus variant="primary" onClick={enter} >
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faMountains)}></SlIcon>{'Enter'}
                                </SlButton>
                            }
                            {editorPanel.list.length === 0 &&
                                <SlButton autofocus variant="primary" onClick={loadJourney}>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faRegularRouteCirclePlus)}></SlIcon>{'Load your first Journey'}
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