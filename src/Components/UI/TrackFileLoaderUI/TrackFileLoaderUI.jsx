import './style.css'
import { faMapLocation }               from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { forwardRef }                  from 'react'
import { useSnapshot }                 from 'valtio'
import { Journey }                     from '../../../classes/Journey'
import { TrackUtils }                  from '../../../Utils/cesium/TrackUtils'
import { FA2SL }                       from '../../../Utils/FA2SL'
import { UINotifier }                  from '../../../Utils/UINotifier'

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

                // we need to save some information
                theJourney.addToContext()
                vt3d.addToEditor(theJourney)
                await theJourney.save()
                await theJourney.saveOrigin()

                // Force editor to close but remains usable
                mainStore.components.journeyEditor.usable = true
                await theJourney.draw()

            } else {
                // It exists, we notify it
                UINotifier.notifyWarning({
                    caption: `This track has already been loaded!`,
                    text: 'You can draw another one !',
                })
            }
        }
    }

    return (
        <>
            <div id="file-loader" className={'ui-element- transparent'} ref={ref}>
                <SlTooltip placement={'right'} content="Load a track file">
                    <SlButton size={'small'} onClick={uploadFile} className={'square-icon'}>
                        <SlIcon library="fa" name={FA2SL.set(faMapLocation)}/>
                    </SlButton>
                </SlTooltip>
            </div>
        </>
    )

})

