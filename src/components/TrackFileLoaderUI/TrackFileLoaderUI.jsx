import './style.css'
import { Journey }                     from '@Core/Journey'
import { faMapLocation }               from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { TrackUtils }                  from '@Utils/cesium/TrackUtils'
import { FA2SL }                       from '@Utils/FA2SL'
import { UIToast }                     from '@Utils/UIToast'
import { forwardRef }                  from 'react'
import { useSnapshot }                 from 'valtio'

export const TrackFileLoaderUI = forwardRef(function TrackFileLoaderUI(props, ref) {

    const mainStore = vt3d.mainProxy
    const mainSnap = useSnapshot(mainStore)

    const uploadFile = async () => {

        // uploading a file exits full screen mode, so we force the state
        mainStore.fullSize = false

        const journey = await TrackUtils.loadJourneyFromFile()
        // File is correct let's work with
        if (journey !== undefined) {
            let theJourney = new Journey(journey.name, journey.extension, {content: journey.content})
            // Check if the track already exists in context
            // If not we manage and show it.
            if (vt3d.getJourneyBySlug(theJourney.slug)?.slug === undefined) {
                if (!theJourney.hasAltitude) {
                    mainStore.modals.altitudeChoice.show = true
                }
                // Need stats
                theJourney.extractMetrics()
                // Prepare the contexts and current values
                theJourney.addToContext()
                theJourney.addToEditor()

                const theTrack = vt3d.theJourney.tracks.entries().next().value[1]
                theTrack.addToEditor()

                TrackUtils.setProfileVisibility(vt3d.theJourney)


                await theJourney.saveToDB()
                await theJourney.saveOriginDataToDB()


                mainStore.canViewJourneyData = true
                await theJourney.draw({})
                await TrackUtils.createCommonMapObjectsStore()
                __.ui.profilerdraw()

            } else {
                // It exists, we notify it
                UIToast.warning({
                    caption: `This journey has already been loaded!`,
                    text: 'Please select another one !',
                })
            }
        }
    }

    return (
        <>
            <SlTooltip placement={props.tooltip} content="Load a track file">
                <SlButton size={'small'} onClick={uploadFile} className={'square-icon'}>
                    <SlIcon library="fa" name={FA2SL.set(faMapLocation)}/>
                </SlButton>
            </SlTooltip>
        </>
    )

})

