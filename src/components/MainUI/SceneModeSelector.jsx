import { SCENE_MODES }                 from '@Core/constants'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                       from '@Utils/FA2SL'
import { useRef, useState }            from 'react'
import { useSnapshot }                 from 'valtio/index'

export const SceneModeSelector = (props) => {
    const settings = useSnapshot(lgs.settings.scene)
    const buttonGroup = useRef(null)
    const placement = props.tooltip ?? 'right'
    const [waitingMode, setWaitingMode] = useState(false)

    const selectSceneMode = (event) => {
        if (waitingMode) {
            __.ui.sceneManager.morph(parseInt(event.target.dataset.sceneMode), __.ui.sceneManager.afterMorphing)
            handleOut(event)
        }
        else {
            handleHover(event)
        }
    }
    const handleOut = (event) => {
        setWaitingMode(false)
    }
    const handleHover = (event) => {
        setWaitingMode(true)
        event.preventDefault()
    }

    return (
        <div ref={buttonGroup} className={'scene-mode-selector'} onMouseLeave={handleOut}
             waiting-mode={waitingMode ? 'true' : 'false'}>

            {
                settings.mode.available.map(mode => (
                    <SlTooltip key={`scene-mode-${SCENE_MODES.get(mode).value}`}
                               placement={placement} content={SCENE_MODES.get(mode).title}>
                        <SlButton size={'small'}
                                  visible={settings.mode.value === SCENE_MODES.get(mode).value}
                                  className={'square-icon'} onclick={selectSceneMode}
                                  data-scene-mode={SCENE_MODES.get(mode).value}>
                            <SlIcon slot="prefix" library="fa" name={FA2SL.set(SCENE_MODES.get(mode).icon)}/>
                        </SlButton>
                    </SlTooltip>
                ))
            }
        </div>
    )
}