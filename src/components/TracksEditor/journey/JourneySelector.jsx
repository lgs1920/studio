import { faChevronDown, faEye, faEyeSlash } from '@fortawesome/pro-regular-svg-icons'
import { faRoute, faSquare }                from '@fortawesome/pro-solid-svg-icons'
import { SlIcon, SlOption, SlSelect }       from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                            from '@Utils/FA2SL'
import { useSnapshot }                      from 'valtio'

export const JourneySelector = (props) => {
    const mainStore = lgs.mainProxy.components.journeyEditor
    const mainSnapshot = useSnapshot(mainStore)
    const editorStore = lgs.theJourneyEditorProxy
    const editorSnapshot = useSnapshot(editorStore)

    /**
     * Get journeys from the snap that contains only slugs
     */
    let journeys = []
    mainSnapshot.list.forEach(slug => {
        journeys.push(lgs.getJourneyBySlug(slug))
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
    mainStore.theJourney = lgs.theJourney?.slug
    const theJourney = lgs.theJourney

    // Look for colo to add in prefix
    const prefixColor = (journey) => {
        const color = (journey.tracks.size === 1) ? journey.tracks.values().next().value.color : 'black'
        return {color: color}
    }

    return (<>
        {mainSnapshot.list.length > 1 &&
            <SlSelect label={props.label}
                      value={editorSnapshot.journey.slug}
                      onSlChange={props.onChange}
                      key={mainSnapshot.keys.journey.list}
                      className="journey-selector"
        >
            <SlIcon library="fa"
                    name={FA2SL.set(faRoute)}
                    slot={'prefix'}
                    style={{
                        color: (theJourney.tracks.size === 1) ? editorSnapshot.track.color : 'black',
                    }}
            />
            <SlIcon library="fa" name={FA2SL.set(faChevronDown)} slot={'expand-icon'}/>

            {journeys.map(journey => <SlOption key={journey.title} value={journey.slug}>
                <SlIcon library="fa" name={FA2SL.set(faChevronDown)} slot={'expand-icon'}/>
                <SlIcon library="fa"
                        name={FA2SL.set(faSquare)}
                        slot={'prefix'}
                        style={prefixColor(journey)}
                />

                <SlIcon slot="suffix" library="fa" name={FA2SL.set(journey.visible ? faEye : faEyeSlash)}/>

                {journey.title}
            </SlOption>)}
        </SlSelect>}
        {mainSnapshot.list.length === 1 && props.single && <>
            <span className={'journey-title' + props.card ? ' lgs-text-card' : ''}>
            <SlIcon className={'journey-title-icon'}
                    library="fa" name={FA2SL.set(faRoute)}
                    slot={'expand-icon'}
                    style={{
                        color: (theJourney.tracks.size === 1) ? editorSnapshot?.track?.color : 'black',
                    }}
            />
                {editorSnapshot.journey.title}
                </span>
        </>}

    </>)
}