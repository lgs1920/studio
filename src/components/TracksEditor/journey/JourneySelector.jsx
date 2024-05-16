import { faChevronDown, faEye, faEyeSlash } from '@fortawesome/pro-regular-svg-icons'
import { faCircle, faRoute }                from '@fortawesome/pro-solid-svg-icons'
import { SlIcon, SlOption, SlSelect }       from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                            from '@Utils/FA2SL'
import { forwardRef }                       from 'react'
import { useSnapshot }                      from 'valtio'

export const JourneySelector = forwardRef(function JourneySelector(props, ref) {

    const handleRequestClose = event => {
        event.preventDefault()
    }
    const mainStore = vt3d.mainProxy.components.journeyEditor
    const mainSnapshot = useSnapshot(mainStore)
    const editorStore = vt3d.theJourneyEditorProxy
    const editorSnapshot = useSnapshot(editorStore)

    /**
     * Get journeys from the snap that contains only slugs
     */
    let journeys = []
    mainSnapshot.list.forEach(slug => {
        journeys.push(vt3d.getJourneyBySlug(slug))
    })

    /**
     * Sort the list
     *
     * //TODO other criterias
     */
    if (mainSnapshot.list.length > 1) {
        // sort list alphabetically
        journeys.sort(function (a, b) {
            if (a.title < b.title) {
                return 1
            }
            if (a.title > b.title) {
                return -1
            }
            return 0
        })

    }

    // set Default
    mainStore.theJourney = vt3d.theJourney?.slug
    const theJourney = vt3d.theJourney

    // Look for colo to add in prefix
    const prefixColor = (journey) => {
        const color = (journey.tracks.size === 1) ? journey.tracks.values().next().value.color : 'black'
        return {color: color, fontSize: '0.9em'}
    }

    return (<>
        {mainSnapshot.list.length > 1 && <SlSelect hoist label={props.label}
                                                   value={editorSnapshot.journey.slug}
                                                   onSlChange={props.onChange}
                                                   key={mainSnapshot.keys.journey.list}
                                                   size={props.size ?? 'medium'}
                                                   className="journey-selector"
        >
            <SlIcon library="fa"
                    name={FA2SL.set(faCircle)}
                    slot={'prefix'}
                    style={{
                        color: (theJourney.tracks.size === 1) ? editorSnapshot.track.color : 'black',
                        fontSize: '0.9em',
                    }}
            />
            <SlIcon library="fa" name={FA2SL.set(faChevronDown)} slot={'expand-icon'}/>

            {journeys.map(journey => <SlOption key={journey.title} value={journey.slug}>
                <SlIcon library="fa" name={FA2SL.set(faChevronDown)} slot={'expand-icon'}/>
                <SlIcon library="fa"
                        name={FA2SL.set(faCircle)}
                        slot={'prefix'}
                        style={prefixColor(journey)}
                />

                {journey.visible ? <SlIcon slot="suffix" library="fa" name={FA2SL.set(faEye)}/> : <SlIcon
                    slot="suffix" library="fa" name={FA2SL.set(faEyeSlash)}/>}
                {journey.title}
            </SlOption>)}
        </SlSelect>}
        {mainSnapshot.list.length === 1 && props.single && <>
            <span className={'journey-title'}>
            <SlIcon className={'journey-title-icon'} library="fa" name={FA2SL.set(faRoute)} slot={'expand-icon'}/>
                {vt3d.theJourney.title}
                </span>
        </>}

    </>)
})