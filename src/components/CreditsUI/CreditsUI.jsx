import { DrawerFooter }                          from '@Components/DrawerFooter'
import { faCircleInfo }                          from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDrawer, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                 from '@Utils/FA2SL'
import React, { useEffect, useRef }              from 'react'
import { Scrollbars }                            from 'react-custom-scrollbars'
import { default as ReactMarkdown }              from 'react-markdown'
import { useSnapshot }                           from 'valtio'
import engine                                    from '../../../public/assets/credits/credits-engine.md'
import providers                                 from '../../../public/assets/credits/credits-map-providers.md'
import code                                      from '../../../public/assets/credits/credits-open-source-code.md'

export const CreditsUI = function CreditsUI() {

    const mainSnap = useSnapshot(lgs.mainUIStore)
    const drawerRef = useRef(null)

    const setOpen = (open) => {
        lgs.mainUIStore.credits.show = open
    }

        useEffect(() => {
            //search the link and add external target (as it is not possible in markdown)
            if (drawerRef.current) {
                const slotBody = drawerRef.current.shadowRoot.querySelector('slot[part="body"]')
                const assignedElements = slotBody.assignedElements()
                assignedElements[0].querySelectorAll('a').forEach(link => {
                    link.target = '_blank'
                })
            }

        }, [])

    return (<>
        <SlDrawer className="ui-element- transparent" id="credits-pane"
                  open={mainSnap.credits.show}
                  onSlAfterHide={() => setOpen(false)}
                  ref={drawerRef}
                  >

            <Scrollbars>
                <ReactMarkdown children={engine}/>
                <ReactMarkdown children={providers}/>
                <ReactMarkdown children={code}/>
            </Scrollbars>

            <DrawerFooter/>

        </SlDrawer>
        <SlTooltip placement={'right'} content="Show Credits">
            <SlButton className={'square-icon'} size="small" id={'open-credits-pane'} onClick={() => setOpen(true)}>
                <SlIcon library="fa" name={FA2SL.set(faCircleInfo)}></SlIcon>
            </SlButton>
        </SlTooltip>

    </>)
    }
