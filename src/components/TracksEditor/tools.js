import { Journey, NO_FOCUS, RE_LOADING }                from '@Core/Journey'
import { Track }                                        from '@Core/Track'
import { DRAW_THEN_SAVE, DRAW_WITHOUT_SAVE, JUST_SAVE } from '@Core/VT3D'
import { UPDATE_JOURNEY_SILENTLY }                      from './JourneySettings'

export const updateTrack = async (action) => {

    // Update the track
    vt3d.theJourneyEditorProxy.journey.tracks.set(vt3d.theJourneyEditorProxy.track.slug, vt3d.theJourneyEditorProxy.track)
    const journey = Journey.deserialize({object: Journey.unproxify(vt3d.theJourneyEditorProxy.journey)})
    const track = Track.deserialize({object: Track.unproxify(vt3d.theJourneyEditorProxy.track)})
    // await journey.computeAll()

    if (action === DRAW_THEN_SAVE || action === JUST_SAVE) {
        vt3d.saveJourney(journey)
        // saveToDB toDB
        await journey.saveToDB()
    }

    if (action === DRAW_WITHOUT_SAVE || action === DRAW_THEN_SAVE) {
        await track.draw({action: RE_LOADING, mode: NO_FOCUS})
    }

}


/**
 * Re build the journey object,
 * Re compute metrix //TODO voir one peut paseprendre le anciens(tant que DEM n'a pa change)
 *
 * @param {Number} action
 * @return {Journey}
 */
export const updateJourney = async action => {

    const journey = Journey.deserialize({object: Journey.unproxify(vt3d.theJourneyEditorProxy.journey)})
    await journey.computeAll()
    vt3d.saveJourney(journey)
    // saveToDB toDB
    await journey.saveToDB()

    if (action !== UPDATE_JOURNEY_SILENTLY) {
        await journey.draw({action: action})
    } else {
        journey.focus()
    }
    return journey
}
