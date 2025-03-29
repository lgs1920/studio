import { faChevronDown }              from '@fortawesome/pro-regular-svg-icons'
import { faMask, faRoute, faSquare }  from '@fortawesome/pro-solid-svg-icons'
import { SlIcon, SlOption, SlSelect } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                      from '@Utils/FA2SL'
import classNames                     from 'classnames'
import { useSnapshot }                from 'valtio'

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

    const styled = props?.style === 'card'

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
        return (journey.tracks.size === 1) ? journey.tracks.values().next().value.color : 'black'
    }


    return (<>
        {mainSnapshot.list.length > 1 &&
            <SlSelect label={props.label} size={props.size ?? 'medium'}
                      value={editorSnapshot.journey.slug}
                      onSlChange={props.onChange}
                      key={mainSnapshot.keys.journey.list}
                      className={classNames('journey-selector', !editorSnapshot.journey.visible ? 'masked' : '')}
            >
                <SlIcon library="fa"
                        name={FA2SL.set(editorSnapshot.journey.visible ? faRoute : faMask)}
                        slot={'prefix'}
                        style={{
                            color: (theJourney.tracks.size === 1) ? editorSnapshot.track.color : 'black',
                        }}
                        disabled={!editorSnapshot.journey.visible}
                />
                <SlIcon library="fa" name={FA2SL.set(faChevronDown)} slot={'expand-icon'}/>

                {journeys.map(journey =>
                                  <SlOption key={journey.title} value={journey.slug}
                                            className={classNames('journey-title', !journey.visible ? 'masked' : '')}>

                                      <SlIcon library="fa" name={FA2SL.set(faChevronDown)} slot={'expand-icon'}/>
                                      <SlIcon library="fa"
                                              name={FA2SL.set(journey.visible ? faSquare : faMask)}
                                              slot={'prefix'}
                                              style={{
                                                  color: prefixColor(journey),
                                              }}
                                      />
                                      {journey.title}
                                  </SlOption>)}
            </SlSelect>
        }
        {mainSnapshot.list.length === 1 && props.single &&
            <div className={classNames(
                'journey-title',
                styled ? 'lgs-one-line-card' : '',
                !editorSnapshot.journey.visible ? 'masked' : '',
            )}>
                <SlIcon className={'journey-title-prefix'} disabled={!editorSnapshot.journey.visible}
                        library="fa" name={FA2SL.set(editorSnapshot.journey.visible ? faRoute : faMask)}
                        slot={'expand-icon'}
                        style={{
                            color: editorSnapshot.journey.visible ? editorSnapshot.track.color : 'var(--lgs-disabled-color)',
                        }}
                />
                {editorSnapshot.journey.title}
            </div>
        }
    </>)
}