import './style.css'
import { faLocationDot }         from '@fortawesome/pro-regular-svg-icons'
import { SlCard }                from '@shoelace-style/shoelace/dist/react'
import { forwardRef, useEffect } from 'react'
import { useSnapshot }           from 'valtio'
import { FA2SL }                 from '../../../Utils/FA2SL'
import { TextValueUI }           from '../TextValueUI/TextValueUI'

export const FloatingMenu = forwardRef(function FloatingMenu(props, ref) {

    const menuStore = vt3d.mainProxy.components.floatingMenu
    const menuSnap = useSnapshot(menuStore)
    menuStore.show = false

    useEffect(() => {
        vt3d.floatingMenu.menu = document.getElementById('floating-menu-container')
        //
        //     if (menuStore.show) {
        //         let timeout
        //         window.addEventListener('mouseout', event => {
        //             if (event.target == check_div ||
        //                 Array.from(menuStore.menu.children).includes(event.target)) {
        //                 console.log(true, 'mouse out')
        //                 timeout = setTimeout(() => clearTimeout(timeout), 3 * SECOND)
        //             } else {
        //                 clearTimeout(timeout)
        //             }
        //         })
        //
        //     }
    }, [])

    return (<>
            <div id="floating-menu-container">
                <SlCard>
                    <div id={'floating-menu'}>
                        <div>
                            <sl-icon variant="primary" library="fa" name={FA2SL.set(faLocationDot)}></sl-icon>
                        </div>
                        <div>
                            <TextValueUI value={menuSnap.longitude.toFixed(5)}
                                         id={'cursor-longitude'}
                                         text={'Lon:'}/>
                            <TextValueUI value={menuSnap.latitude.toFixed(5)}
                                         id={'cursor-latitude'}
                                         text={'Lat:'}/>
                        </div>
                    </div>
                </SlCard>
            </div>
        </>


    )
})

