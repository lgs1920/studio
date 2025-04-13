import { APP_EVENT, INFO_DRAWER, MILLIS, SECOND, SLOGAN } from '@Core/constants'
import { SlButton, SlCheckbox, SlDialog }                 from '@shoelace-style/shoelace/dist/react'
import { UIToast }                             from '@Utils/UIToast'
import { useEffect, useRef, useState }         from 'react'
import { StudioLogo }                          from './StudioLogo'


export const WelcomeModal = () => {
    const [open, setOpen] = useState(true)
    const [show, setShow] = useState(false)
    const welcomeModal = useRef(null)
    const infoPanel = lgs.mainProxy.components.informationPanel
    const main = lgs.mainProxy

    const [closure, setClosure] = useState(lgs.settings.ui.welcome.displayTime)

    const hideEvent = new CustomEvent(APP_EVENT.WELCOME.HIDE, {
        detail: {
            timestamp: Date.now(),
        },
    })

    const close = (event) => {
        document.activeElement?.blur() // Remove focus on children
        if (event.detail.source === 'overlay') {
            lgs.mainUIStore.show = true
        }
        lgs.settings.app.firstVisit = false
        main.components.welcome.hidden = true
    }

    const hide = () => {
        document.activeElement?.blur() // Remove focus on children
        setOpen(false)
        lgs.mainUIStore.show = true
        main.components.welcome.hidden = true


        window.dispatchEvent(hideEvent)
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
        hide()
        UIToast.notify({
                           caption: `The introduction will be hidden next time!`,
                           text:    `This can be changed later in the settings menu.`,
                       }, 5 * SECOND)
    }

    useEffect(() => {
        main.components.welcome.modal = false
        let timer


        // CountDown and Auto closure
        if (welcomeModal && lgs.settings.ui.welcome.showIntro && lgs.settings.ui.welcome.autoClose) {
            timer = setInterval(() => {
                setClosure(prevClosure => {
                    if (prevClosure > 0) {
                        return --prevClosure
                    }
                    else {
                        if (welcomeModal.current) {
                            welcomeModal.current.hide()
                            hide()
                        }
                        if (timer) {
                            clearInterval(timer)
                            hide()
                        }
                        return 0
                    }
                })
            }, MILLIS)
        }
        else {
            main.components.welcome.hidden = true
            window.dispatchEvent(hideEvent)

        }
        return () => {
            if (timer) {
                hide()
                clearInterval(timer)
            }
            setClosure(0)
        }
    }, [])

    const Links = () => {
        return (
            <div id="welcome-links">
                <div id="welcome-links-do-not-show">
                    <SlCheckbox size={'small'} onSlChange={setShowModal}
                    >{'Don\'t show this anymore'}</SlCheckbox>
                </div>
                {lgs.settings.getApp.changelogToRead &&
                    <SlButton onClick={showNews} variant="text">{'What\'s new ?'}</SlButton>
                }

            </div>
        )
    }

    return (
        <>
            {lgs.settings.ui.welcome.showIntro && closure > 0 &&
                <SlDialog open={open}
                          no-header
                          id={'welcome-modal'}
                          className={'lgs-theme'}
                          onSlRequestClose={close}
                          onSlAfterHide={hide}
                          ref={welcomeModal}
                          onClick={hide}>

                    <StudioLogo width={'100%'} version={true} timer={closure} slogan={SLOGAN}
                                addClassName={'welcome-logo'} buttons={<Links/>}/>

                </SlDialog>
            }
        </>
    )
}