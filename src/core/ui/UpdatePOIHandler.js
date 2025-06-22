// Ancien code
const handleChangeLatitude = async event => {
    point = Object.assign($pois.list.get(point.id), {
        latitude: event.target.value * 1,
    })
    $pois.list.set(point.id, point)
    await __.ui.poiManager.persistToDatabase(point)
}

// Nouveau code simplifié
const handleChangeLatitude = async event => {
    await __.ui.poiManager.updatePOI(point.id, {
        latitude: event.target.value * 1
    })
}