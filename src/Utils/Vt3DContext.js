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
        return this.#context?.scene?.canvas
    }


    get tracks() {
        return this.#context.tracks
    }

    getTrackByName(name) {
        console.log(name)
        return this.#context.tracks.filter(function (arr) {
            return arr.name === name
        })[0]
    }

    addTrack = (track) => {
        if (track && track.name) {
            this.context.tracks.push({[track.name]: track})
        }
    }

}