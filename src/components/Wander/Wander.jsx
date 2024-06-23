import { faPause, faPlay,faArrowRotateLeft, faArrowRotateRight,faArrowsRepeat } from '@fortawesome/pro-regular-svg-icons'
import {  faStop }                                            from '@fortawesome/pro-solid-svg-icons'
import {faRegularArrowsRepeatSlash}              from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import { SlButton, SlIcon, SlOption, SlSelect, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                           from '@Utils/FA2SL'
import { useSnapshot } from 'valtio'
import { Wanderer }    from '../../core/ui/Wanderer.js'
import { WanderUtils } from '../../Utils/cesium/WanderUtils.js'

export const Wander = (props) => {


    const wanderStore = lgs.mainProxy.components.wanderer
    const wanderSnapshot = useSnapshot(wanderStore)

    // Use the first as default if needed
    if (wanderSnapshot.duration === undefined) {
        wanderStore.duration = Wanderer.DURATIONS.values().next().value.time.toString()
    }

    const changeDuration = (event) => {
        wanderStore.duration = event.target.value
        __.ui.wanderer.update({duration: parseInt(wanderStore.duration)})
        if (wanderStore.duration) {
            __.ui.wanderer.resume()
        }
    }

    const toggleWander = () => {
        wanderStore.run = !wanderStore.run
        if (wanderStore.run) {
            if (wanderStore.pause) {
                __.ui.wanderer.play()
                wanderStore.pause = false
            } else {
                __.ui.wanderer.start()
            }
        } else {
            __.ui.wanderer.stop()
        }
    }

    const pauseWander = () => {
        wanderStore.run = !wanderStore.run
        wanderStore.pause = true
        __.ui.wanderer.pause()
    }

    const toggleDirection = () => {
        wanderStore.forward = !wanderStore.forward
        wanderStore.run = true
        __.ui.wanderer.update({forward: wanderStore.forward})
        if (wanderStore.duration) {
            __.ui.wanderer.resume()
        }
    }
    const toggleLoop = () => {
        wanderStore.loop = !wanderStore.loop
        __.ui.wanderer.update({loop: wanderStore.loop})
    }

    // Default tooltip placement
    const tooltip = (props.tooltip) ?? 'top'

    WanderUtils.initWanderMode()

    return (<div className={"wander-menu"} id={props.id}>
        {!wanderSnapshot.run &&
            <SlTooltip hoist placement={tooltip} content="Play">
                <SlButton key={wanderSnapshot.run} size={'small'} className={'square-icon'} onClick={toggleWander}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faPlay)}/>
                </SlButton>
            </SlTooltip>
        }

        {wanderSnapshot.run &&
            <>
            <SlTooltip hoist placement={tooltip} content="Stop">
                <SlButton key={wanderSnapshot.run} size={'small'} className={'square-icon'} onClick={toggleWander}>
                    <SlIcon slot="prefix" slot="prefix" library="fa" name={FA2SL.set(faStop)}/>
                </SlButton>
            </SlTooltip>
            <SlTooltip hoist placement={tooltip} content="Pause">
                    <SlButton key={wanderSnapshot.run} size={'small'} className={'square-icon'} onClick={pauseWander}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faPause)}/>
                </SlButton>
            </SlTooltip>
            </>
}

    <SlTooltip hoist placement={tooltip} content="Reverse direction">
            <SlButton size={'small'} className={'square-icon'} onClick={toggleDirection}>
                <SlIcon slot="prefix" library="fa" name={FA2SL.set(
                    wanderSnapshot.forward ? faArrowRotateRight : faArrowRotateLeft,
                )}
                        className={`${wanderSnapshot.run ? 'fa-spin' : ''} ${!wanderSnapshot.forward ? 'fa-spin-reverse' : ''}`}
                />
            </SlButton>
        </SlTooltip>

    <SlSelect hoist
                  onSlChange={changeDuration}
                  value={wanderSnapshot.duration}
                  size={'small'}
                  className={'wanderDuration'}>
        {Wanderer.DURATIONS.map(duration =>
                <SlOption key={duration.text} value={duration.time}>{duration.text}</SlOption>,
            )}
        </SlSelect>

        <SlTooltip hoist placement={tooltip} content={wanderSnapshot.loop?'Stop Loop':'Loop'}>
            <SlButton size={'small'} className={'square-icon'} onClick={toggleLoop}>
                <SlIcon slot="prefix" library="fa" name={FA2SL.set(
                    wanderSnapshot.loop?faRegularArrowsRepeatSlash:faArrowsRepeat
                )}
                />
            </SlButton>
        </SlTooltip>
    </div>)

}

