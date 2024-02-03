export class Vt3DContext {
    #context
    constructor() {
        this.#context = {
            tracks:[]
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

    get camera() {
        return this.#context.viewer?.scene?.camera
    }

    get tracks() {
        return this.#context.tracks
    }

    getTrackByName(name) {
        console.log(name)
        return this.#context.tracks.filter(function(arr){return arr.name === name})[0]
    }
    addTrack = (track) => {
        if(track && track.name) {
            this.context.tracks.push({[track.name] :track})
        }
    }

}