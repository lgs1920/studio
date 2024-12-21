import { faRegularRouteCirclePlus }               from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import { INFO_DRAWER, SLOGAN }                    from '@Core/constants'
import { faArrowsRotate, faMountains }            from '@fortawesome/pro-regular-svg-icons'
import { FontAwesomeIcon }                        from '@fortawesome/react-fontawesome'
import { SlButton, SlCheckbox, SlDialog, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                  from '@Utils/FA2SL.js'
import { useEffect, useRef, useState }            from 'react'
import { default as ReactMarkdown }               from 'react-markdown'
import { useSnapshot }                            from 'valtio'
import welcomeBack                                from '../../../src/assets/modals/welcome-back.md'
import welcome                                    from '../../../src/assets/modals/welcome.md'
import { MILLIS }                                 from '../../core/constants'
import { StudioLogo }                             from './StudioLogo'


export const WelcomeModal = () => {
    const [open, setOpen] = useState(true)
    const [show, setShow] = useState(false)
    const welcomeModal = useRef(null)
    const infoPanel = lgs.mainProxy.components.informationPanel
    const main = useSnapshot(lgs.mainProxy)
    const [closure, setClosure] = useState(lgs.settings.ui.welcome.displayTime)

    const close = (event) => {
        document.activeElement?.blur() // Remove focus on children
        if (event.detail.source === 'overlay') {
            lgs.mainUIStore.show = true
        }
        lgs.settings.app.firstVisit = false
    }

    const hide = () => {
        document.activeElement?.blur() // Remove focus on children
        setOpen(false)
        lgs.mainUIStore.show = true
    }

    function showNews() {
        hide()
        __.ui.drawerManager.toggle(INFO_DRAWER)
    }

    const enter = () => {
        hide()
    }

    const loadJourney = () => {
        enter()
        lgs.mainUIStore.journeyLoader.visible = true
    }

    const setShowModal = () => {
        lgs.settings.ui.welcome.showIntro = false
    }

    const TheText = () => {
        if (lgs.settings.app.firstVisit) {
            lgs.settings.app.firstVisit = false
            return (<ReactMarkdown children={welcome}/>)
        }
        return (<ReactMarkdown children={welcomeBack}/>)
    }

    useEffect(() => {
        // CountDown and Auto closure
        if (welcomeModal && lgs.settings.ui.welcome.showIntro && lgs.settings.ui.welcome.autoClose) {
            const timer = setInterval(() => {
                setClosure(prevClosure => {
                    if (prevClosure > 0) {
                        return --prevClosure
                    }
                    else {
                        if (welcomeModal.current) {
                            welcomeModal.current.hide()
                        }
                        if (timer) {
                            clearInterval(timer)
                        }
                        return 0
                    }
                })
            }, MILLIS)
        }
        return () => {
            clearInterval(timer)
            closure = 0
        }
    }, [])


    return (
        <>
            {lgs.settings.ui.welcome.showIntro && closure > 0 &&
                <SlDialog open={open}
                          no-header
                          id={'welcome-modal'}
                          className={'lgs-theme'}
                          onSlRequestClose={close}
                          onSlAfterHide={hide}
                          ref={welcomeModal}>

                    <StudioLogo width={'100%'} version={true} timer={closure} slogan={SLOGAN}
                                addClassName={'welcome-logo'}/>

                    <TheText/>

                    <div slot="footer">
                        <div id={'footer'}>

                            <SlCheckbox id={'faArrowsRotate'} size={'small'}
                                        onSlChange={setShowModal}>Don't show this intro anymore</SlCheckbox>

                            <div className="buttons-bar">
                                {lgs.settings.getApp.changelogToRead &&
                                    <SlButton onClick={showNews} variant="text">{'What\'s new ?'}</SlButton>
                                }
                                {main.readyForTheShow &&
                                    <>
                                        {main.theJourney &&
                                            <SlButton variant="primary" onClick={enter}>
                                                <SlIcon slot="prefix" library="fa"
                                                        name={FA2SL.set(faMountains)}>
                                                </SlIcon>
                                                {'Enter'}
                                            </SlButton>
                                        }
                                        {!main.theJourney &&
                                            <SlButton variant="primary" onClick={loadJourney}>
                                                <SlIcon slot="prefix" library="fa"
                                                        name={FA2SL.set(faRegularRouteCirclePlus)}></SlIcon>{'Load your first Journey'}
                                            </SlButton>
                                        }
                                    </>
                                }
                                {!main.readyForTheShow &&
                                    <div id="waiting-loading">
                                        <FontAwesomeIcon icon={faArrowsRotate} className={'fa-spin'}/>{'Loading...'}
                                    </div>
                                }

                            </div>
                        </div>
                    </div>
                </SlDialog>
            }
        </>
    )
}