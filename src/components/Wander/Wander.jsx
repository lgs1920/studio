import { WANDER_DURATION } from '@Core/ui/Wanderer'
import {
    faArrowsRotateReverse, faBackwardStep, faForwardStep, faPause, faPlay,
}                          from '@fortawesome/pro-regular-svg-icons'
import {
    SlButton, SlIcon, SlOption, SlSelect, SlTooltip,
}                          from '@shoelace-style/shoelace/dist/react'
import { FA2SL }           from '@Utils/FA2SL'
import { useSnapshot }     from 'valtio'

export const Wander = (props) => {


    const wanderStore = vt3d.mainProxy.components.wanderer
    const wanderSnapshot = useSnapshot(wanderStore)

    // Use the first as default if needed
    if (wanderSnapshot.duration === undefined) {
        wanderStore.duration = WANDER_DURATION.values().next().value.time.toString()
    }

    const changeDuration = (event) => {
        wanderStore.duration = event.target.value
    }

    const toggleWander = () => {
        wanderStore.run = !wanderStore.run
        wanderStore.placement = undefined
    }

    const togglePlacement = (event) => {
        wanderStore.forcedToStart = event.currentTarget.id.includes('start')
    }
    const toggleDirection = (event) => {
        wanderStore.rightWay = !wanderStore.rightWay
    }
    // Default tooltip placement
    const tooltip = (props.tooltip) ?? 'top'

    return (<>
        <SlTooltip hoist placement={tooltip} content="Go to Start">
            <SlButton size={'small'} className={'square-icon'} onClick={togglePlacement} id={'force-start'}>
                <SlIcon library="fa" name={FA2SL.set(faBackwardStep)}/>
            </SlButton>
        </SlTooltip>
        {!wanderSnapshot.run &&
            <SlTooltip hoist placement={tooltip} content="Play">
                <SlButton key={wanderSnapshot.run} size={'small'} className={'square-icon'} onClick={toggleWander}>
                    <SlIcon library="fa" name={FA2SL.set(faPlay)}/>
                </SlButton>
            </SlTooltip>
        }
        {wanderSnapshot.run &&
            <SlTooltip hoist placement={tooltip} content="Pause">
                <SlButton key={wanderSnapshot.run} size={'small'} className={'square-icon'} onClick={toggleWander}>
                    <SlIcon library="fa" name={FA2SL.set(faPause)}/>
                </SlButton>
            </SlTooltip>
        }
        <SlTooltip hoist placement={tooltip} content="Go to End">
            <SlButton size={'small'} className={'square-icon'} onClick={togglePlacement} id={'force-end'}>
                <SlIcon library="fa" name={FA2SL.set(faForwardStep)}/>
            </SlButton>
        </SlTooltip>
        <SlTooltip hoist placement={tooltip} content="Reverse direction">
            <SlButton size={'small'} className={'square-icon'} onClick={toggleDirection}>
                <SlIcon library="fa" name={FA2SL.set(faArrowsRotateReverse)}/>
            </SlButton>
        </SlTooltip>
        <SlSelect hoist
                  onSlChange={changeDuration}
                  value={wanderSnapshot.duration}
                  size={'small'}
                  className={'wanderDuration'}>
            {WANDER_DURATION.map(duration =>
                <SlOption key={duration.text} value={duration.time}>{duration.text}</SlOption>,
            )}
        </SlSelect>
    </>)

}

