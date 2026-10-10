/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayCameraOwnership.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-10
 * Last modified: 2026-10-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/** Camera leases protect map persistence while Replay borrows a Cesium camera. */
const cameras = new WeakMap()
const owners = new WeakMap()
const revisions = new WeakMap()

/** Return the camera lifecycle revision used to reject stale asynchronous reads. */
export const replayCameraOwnershipRevision = camera => camera ? revisions.get(camera) ?? 0 : 0

/** Report whether a physical camera is currently borrowed by Replay. */
export const isCameraOwnedByReplay = camera => Boolean(camera && cameras.has(camera))

/** Return the camera currently borrowed by an owner, excluding superseded leases. */
export const replayOwnedCameraFor = owner => {
    const lease = owners.get(owner)
    return lease && cameras.get(lease.camera) === lease ? lease.camera : null
}

/** Return the original view retained by the current camera lease. */
export const replayReturnCameraStateFor = owner => {
    const lease = owners.get(owner)
    return lease && cameras.get(lease.camera) === lease ? lease.cameraState : null
}

/** Acquire a camera without replacing the original map snapshot on reentrant starts. */
export const acquireReplayCameraOwnership = (owner, camera, cameraState) => {
    if (!camera) return cameraState
    const previous = cameras.get(camera)
    if (previous?.owner === owner) return previous.cameraState
    const lease = {owner, camera, cameraState: previous?.cameraState ?? cameraState}
    cameras.set(camera, lease)
    owners.set(owner, lease)
    revisions.set(camera, replayCameraOwnershipRevision(camera) + 1)
    return lease.cameraState
}

/** Release only the current camera lease so stale cleanup cannot release a newer owner. */
export const releaseReplayCameraOwnership = owner => {
    const camera = replayOwnedCameraFor(owner)
    if (camera) {
        cameras.delete(camera)
        revisions.set(camera, replayCameraOwnershipRevision(camera) + 1)
    }
    owners.delete(owner)
}

/** Snapshot a Replay pose separately from the normal map return state. */
export const captureReplayEntryCameraState = camera => {
    const position = camera?.positionCartographic
    if (!position) return null
    return {
        destination: {
            longitude: position.longitude * 180 / Math.PI,
            latitude: position.latitude * 180 / Math.PI,
            height: position.height,
        },
        orientation: {heading: camera.heading, pitch: camera.pitch, roll: camera.roll},
        altitude: position.height,
    }
}
