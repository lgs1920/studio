import { TextValueUI }     from '@Components/TextValueUI/TextValueUI'
import { SECOND }          from '@Core/constants'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { UIUtils }         from '@Utils/UIUtils'
import { ELEVATION_UNITS } from '@Utils/UnitUtils'
import { useRef }          from 'react'
import Timeout             from 'smart-timeout'
import './style.css'

export const MapPOIContent = ({point, hide}) => {
    const inner = useRef(null)

    const handleContextMenu = (event) => {
        event.preventDefault()
        if (!__.ui.cameraManager.isRotating()) {
            lgs.mainProxy.components.pois.context.visible = true
            lgs.mainProxy.components.pois.current = point
            __.ui.sceneManager.propagateEventToCanvas(event)
        }
    }

    return (
        <div className="poi-on-map">
            <div
                className="poi-on-map-inner"
                ref={inner}
                onContextMenu={handleContextMenu}
                onPointerLeave={() => {
                    Timeout.set(
                        lgs.mainProxy.components.pois.context.timer,
                        hide,
                        1.5 * SECOND,
                    )
                }}
            >
                {(point.expanded || (!point.expanded && point.over)) && !point.showFlag &&

                    <>
                        <h3><FontAwesomeIcon icon={point.icon}
                                             className="poi-as-flag"/> {point.title ?? 'Point Of Interest'}</h3>
                        {point.scale > 0.6 && (
                            <div className="poi-full-coordinates">
                                {!point.simulatedHeight && (
                                    <TextValueUI
                                        className="poi-elevation"
                                        text={'Altitude: '}
                                        value={point.height}
                                        format={'%d'}
                                        units={ELEVATION_UNITS}
                                    />
                                )}
                                {point.simulatedHeight && <span>&nbsp;</span>}
                                <div className="poi-coordinates">
                                        <span>
                                            {UIUtils.toDMS(point.latitude)},{' '}
                                            {UIUtils.toDMS(point.longitude)}
                                        </span>
                                    <br/>
                                    <span>
                                            [{sprintf('%.5f', point.latitude)},{' '}
                                        {sprintf('%.5f', point.longitude)}]
                                        </span>
                                    <br/>

                                </div>
                            </div>
                        )}
                    </>
                }
                {point.showFlag || !point.expanded && !point.over &&
                    <FontAwesomeIcon icon={point.icon} className="poi-as-flag"/>
                }
            </div>
            <div className="poi-on-map-marker"></div>
        </div>
    )
}