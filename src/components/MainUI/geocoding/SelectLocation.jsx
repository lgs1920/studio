import { faChevronRight, faTriangleExclamation, faXmark } from '@fortawesome/pro-regular-svg-icons'
import { faSearch }                                       from '@fortawesome/pro-solid-svg-icons'
import { SlAlert, SlButton, SlDivider, SlIcon }           from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                          from '@Utils/FA2SL'
import { useLayoutEffect, useRef }                        from 'react'
import { useSnapshot }                                    from 'valtio/index'
import { LGSScrollbars }                                  from '../LGSScrollbars'

export const SelectLocation = ({select, address, submit}) => {
    const store = lgs.mainProxy.components.geocoder
    const snap = useSnapshot(store)
    const scrollbars = useRef(null)

    const submitAndScroll = (event) => {
        submit(event)
        if (scrollbars.current) {
            scrollbars.current.scrollToBottom()
        }
    }

    useLayoutEffect(() => {
        if (scrollbars.current) {
            scrollbars.current.scrollToBottom()
        }
    }, [snap.list])
    return (
        <>
            {snap.list.size > 0 &&
                <div className="select-location-wrapper lgs-card on-map">
                    <LGSScrollbars autoHide autoHeight ref={scrollbars}
                    >
                        <div className="select-location-wrapper">
                            {Array.from(snap.list.entries()).map(([key, value]) => (
                                <div className="select-location-item lgs-card" key={key} id={key}
                                     onClick={select}>
                                    <span>{value.properties.display_name}</span>
                                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faChevronRight)}></SlIcon>
                                </div>
                            ))}
                        </div>
                    </LGSScrollbars>

                    <div className="call-for-actions">
                        <SlDivider/>
                        <div className="buttons-bar">
                            <SlButton close size="small" outline onClick={() => store.dialog.visible = false}>
                                <SlIcon slot="prefix" library="fa"
                                        name={FA2SL.set(faXmark)}></SlIcon>{'Close'}
                            </SlButton>
                            {snap.dialog.moreResults &&
                                <SlButton autofocus size="small" outline onClick={submitAndScroll}>
                                    <SlIcon slot="prefix" library="fa"
                                            name={FA2SL.set(faSearch)}></SlIcon>{'More results'}
                                </SlButton>
                            }
                        </div>
                    </div>
                </div>
            }

            {snap.dialog.visible && snap.dialog.noResults &&
                <SlAlert variant="warning" open>
                    <SlIcon slot="icon" library="fa" name={FA2SL.set(faTriangleExclamation)}/>
                    {'There are no results matching your search!'}
                </SlAlert>
            }

        </>
    )
}