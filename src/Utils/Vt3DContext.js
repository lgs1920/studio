export class Vt3DContext {
    #context

    constructor() {
        this.#context = {
            tracks: [],
        }

    }

    get context() {
        return this.#context
    }

    get viewer() {
        return this.#context.viewer
    }

    set viewer(viewer) {
        this.#context.viewer = viewer
    }

    get scene() {
        return this.#context.viewer?.scene
    }

    get camera() {
        return this?.scene?.camera
    }

    get canvas() {
        return this.#context?.canvas
    }


    get tracks() {
        return this.#context.tracks
    }

    getTrackByName(name) {
        return this.#context.tracks.filter(function (track) {
            return track.name === name
        })[0]
    }

    addTrack = (track) => {
        if (track) {
            this.#context.tracks.push({
                [`${track.name}.${track.extension}`]: track,
            })
        }
    }

}