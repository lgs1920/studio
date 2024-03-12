import './style.css'
import { faLocationDot }         from '@fortawesome/pro-regular-svg-icons'
import { SlCard }                from '@shoelace-style/shoelace/dist/react'
import { forwardRef, useEffect } from 'react'
import { useSnapshot }           from 'valtio'
import { MouseUtils }            from '../../../Utils/cesium/MouseUtils'
import { FA2SL }                 from '../../../Utils/FA2SL'
import { TextValueUI }           from '../TextValueUI/TextValueUI'

export const FloatingMenu = forwardRef(function FloatingMenu(props, ref) {

    const menuStore = vt3d.mainProxy.components.floatingMenu
    const menuSnap = useSnapshot(menuStore)
    menuStore.show = false

    useEffect(() => {
        MouseUtils.mouseCoordinatesInfo = document.getElementById('mouse-coordinates-info-container')
    })

    return (<>
            <div id="mouse-coordinates-info-container">
                <SlCard>
                    <div id={'mouse-coordinates-info'}>
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

