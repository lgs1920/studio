/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WebGLOverlayComposer.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-19
 * Last modified: 2025-11-19
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { LGS_WIDGET_SCALE_FACTOR } from '@Core/constants'

/**
 * WebGLOverlayComposer – HIGH-QUALITY version
 *
 * Improvements:
 *  • Proper clip support (physical pixels)
 *  • Correct texture filtering (LINEAR for upscale, mipmap for downscale)
 *  • Minimal texture re-uploads (dirty flag)
 *  • Alpha blending only for overlays
 *  • No anisotropic filtering if not needed (can be added)
 */
export class WebGLOverlayComposer {
    #gl
    #canvas
    #program
    #sourceTexture
    #overlayTextures = new Map()
    #flushWebGLBuffer = null
    #clip = null
    #outW = 1920
    #outH = 1080
    #dpr = window.devicePixelRatio || 1
    #raf = null

    // Buffers
    #quadBuffer
    #posLoc
    #texLoc
    #texUniform

    constructor(sourceCanvas, options = {}) {
        const {
                  clip             = null,
                  width            = sourceCanvas.clientWidth,
                  height           = sourceCanvas.clientHeight,
                  flushWebGLBuffer = null,
              } = options

        this.sourceCanvas = sourceCanvas
        this.#clip = clip ? {...clip} : null
        this.#outW = width
        this.#outH = height
        this.#flushWebGLBuffer = typeof flushWebGLBuffer === 'function' ? flushWebGLBuffer : null

        this.#canvas = document.createElement('canvas')
        this.#gl =
            this.#canvas.getContext('webgl2', {
                preserveDrawingBuffer: true,
                alpha:                 false,
                antialias:             false,
                powerPreference:       'high-performance',
            }) ||
            this.#canvas.getContext('webgl', {
                preserveDrawingBuffer: true,
                alpha:                 false,
                powerPreference:       'high-performance',
            })

        if (!this.#gl) {
            throw new Error('WebGL not supported')
        }

        this.#initGL()
        this.#resize()
        this.#renderLoop()
    }

    /**
     * Creates a WebGL texture with optimal filtering
     */
    #createTexture() {
        const gl = this.#gl
        const tex = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

        // Default filtering – will be adjusted on upload
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

        return tex
    }

    /**
     * Uploads image to texture with adaptive filtering
     */
    #uploadTexture(tex, source, targetWidth, targetHeight) {
        const gl = this.#gl
        gl.bindTexture(gl.TEXTURE_2D, tex)

        // Upload
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)

        // Compute scale factor
        const srcW = source.width || source.videoWidth || source.clientWidth || 1
        const srcH = source.height || source.videoHeight || source.clientHeight || 1
        const scaleX = targetWidth / srcW
        const scaleY = targetHeight / srcH
        const scale = Math.max(scaleX, scaleY)

        if (scale > 1.2) {
            // Upscaling → LINEAR for smooth interpolation
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        }
        else if (scale < 0.75) {
            // Downscaling → LINEAR_MIPMAP_LINEAR for best quality
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
            gl.generateMipmap(gl.TEXTURE_2D)
        }
        else {
            // Near 1:1 → LINEAR (better than NEAREST for sub-pixel alignment)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        }
    }

    #initGL() {
        const gl = this.#gl

        const vs = `
            attribute vec2 a_position;
            attribute vec2 a_texcoord;
            varying vec2 v_texcoord;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texcoord = a_texcoord;
            }
        `

        const fs = `
            precision highp float;
            varying vec2 v_texcoord;
            uniform sampler2D u_texture;
            void main() {
                vec4 c = texture2D(u_texture, v_texcoord);
                gl_FragColor = c;
            }
        `

        const program = gl.createProgram()
        const compile = (type, src) => {
            const s = gl.createShader(type)
            gl.shaderSource(s, src)
            gl.compileShader(s)
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                console.error('Shader compile error:', gl.getShaderInfoLog(s))
            }
            gl.attachShader(program, s)
        }
        compile(gl.VERTEX_SHADER, vs)
        compile(gl.FRAGMENT_SHADER, fs)
        gl.linkProgram(program)

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program))
        }

        gl.useProgram(program)

        this.#program = program
        this.#posLoc = gl.getAttribLocation(program, 'a_position')
        this.#texLoc = gl.getAttribLocation(program, 'a_texcoord')
        this.#texUniform = gl.getUniformLocation(program, 'u_texture')

        // Full-screen quad (reusable)
        const quad = new Float32Array([
                                          -1, -1, 0, 1,
                                          1, -1, 1, 1,
                                          -1, 1, 0, 0,
                                          1, 1, 1, 0,
                                      ])
        this.#quadBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, this.#quadBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW)

        // Source texture
        this.#sourceTexture = this.#createTexture()
    }

    #resize = () => {
        const w = Math.round(this.#outW * this.#dpr)
        const h = Math.round(this.#outH * this.#dpr)
        if (this.#canvas.width !== w || this.#canvas.height !== h) {
            this.#canvas.width = w
            this.#canvas.height = h
            this.#canvas.style.width = this.#outW + 'px'
            this.#canvas.style.height = this.#outH + 'px'
        }
    }

    addOverlay = (element, x, y, w, h) => {
        let lx = x,
            ly = y,
            lw = w,
            lh = h

        if (lx === undefined || ly === undefined) {
            const r = element.getBoundingClientRect()
            lx = r.left / this.#dpr
            ly = r.top / this.#dpr
        }

        if (lw === undefined) {
            lw = (element.width ?? element.videoWidth ?? element.clientWidth ?? 0)
            if (element.classList?.contains('lgs-widget-canvas')) {
                lw /= LGS_WIDGET_SCALE_FACTOR
            }
        }
        if (lh === undefined) {
            lh = (element.height ?? element.videoHeight ?? element.clientHeight ?? 0)
            if (element.classList?.contains('lgs-widget-canvas')) {
                lh /= LGS_WIDGET_SCALE_FACTOR
            }
        }

        const tex = this.#createTexture()
        this.#overlayTextures.set(element, {
            tex,
            x:     Number(lx),
            y:     Number(ly),
            w:     Number(lw),
            h:     Number(lh),
            element,
            dirty: true, // Force initial upload
        })
    }

    #render = () => {
        const gl = this.#gl

        // Flush Cesium/Three.js buffer
        this.#flushWebGLBuffer?.()

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
        gl.clearColor(0, 0, 0, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)

        gl.useProgram(this.#program)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.#quadBuffer)
        gl.enableVertexAttribArray(this.#posLoc)
        gl.enableVertexAttribArray(this.#texLoc)
        gl.vertexAttribPointer(this.#posLoc, 2, gl.FLOAT, false, 16, 0)
        gl.vertexAttribPointer(this.#texLoc, 2, gl.FLOAT, false, 16, 8)

        // ─────────────────────────────────────────────────────────────────────
        // 1. Draw main source (clipped if needed)
        // ─────────────────────────────────────────────────────────────────────

        // Upload source texture (always, because Cesium updates every frame)
        const physicalClip = this.#clip
                             ? {
                x:      this.#clip.x * this.#dpr,
                y:      this.#clip.y * this.#dpr,
                width:  this.#clip.width * this.#dpr,
                height: this.#clip.height * this.#dpr,
            }
                             : {
                x:      0,
                y:      0,
                width:  this.sourceCanvas.width,
                height: this.sourceCanvas.height,
            }

        this.#uploadTexture(
            this.#sourceTexture,
            this.sourceCanvas,
            gl.canvas.width,
            gl.canvas.height,
        )

        // Compute texture coordinates for the clip region
        const srcW = this.sourceCanvas.width
        const srcH = this.sourceCanvas.height
        const u0 = physicalClip.x / srcW
        const v0 = physicalClip.y / srcH
        const u1 = (physicalClip.x + physicalClip.width) / srcW
        const v1 = (physicalClip.y + physicalClip.height) / srcH

        // Build a custom quad with clipped texcoords
        const clippedQuad = new Float32Array([
                                                 -1, -1, u0, v1,
                                                 1, -1, u1, v1,
                                                 -1, 1, u0, v0,
                                                 1, 1, u1, v0,
                                             ])
        const tmpBuf = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, tmpBuf)
        gl.bufferData(gl.ARRAY_BUFFER, clippedQuad, gl.STATIC_DRAW)
        gl.vertexAttribPointer(this.#posLoc, 2, gl.FLOAT, false, 16, 0)
        gl.vertexAttribPointer(this.#texLoc, 2, gl.FLOAT, false, 16, 8)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.#sourceTexture)
        gl.uniform1i(this.#texUniform, 0)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        gl.deleteBuffer(tmpBuf)

        // ─────────────────────────────────────────────────────────────────────
        // 2. Draw overlays with alpha blending
        // ─────────────────────────────────────────────────────────────────────

        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        for (const data of this.#overlayTextures.values()) {
            // Upload only if dirty
            if (data.dirty) {
                this.#uploadTexture(
                    data.tex,
                    data.element,
                    data.w * this.#dpr,
                    data.h * this.#dpr,
                )
                data.dirty = false
            }

            // Compute NDC coords
            const x0 = (data.x / this.#outW) * 2 - 1
            const y0 = -((data.y + data.h) / this.#outH) * 2 + 1
            const x1 = ((data.x + data.w) / this.#outW) * 2 - 1
            const y1 = -(data.y / this.#outH) * 2 + 1

            const verts = new Float32Array([
                                               x0, y0, 0, 1,
                                               x1, y0, 1, 1,
                                               x0, y1, 0, 0,
                                               x1, y1, 1, 0,
                                           ])

            const buf = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, buf)
            gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)
            gl.vertexAttribPointer(this.#posLoc, 2, gl.FLOAT, false, 16, 0)
            gl.vertexAttribPointer(this.#texLoc, 2, gl.FLOAT, false, 16, 8)

            gl.activeTexture(gl.TEXTURE1)
            gl.bindTexture(gl.TEXTURE_2D, data.tex)
            gl.uniform1i(this.#texUniform, 1)
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

            gl.deleteBuffer(buf)
        }

        gl.disable(gl.BLEND)
    }

    #renderLoop = () => {
        this.#render()
        this.#raf = requestAnimationFrame(this.#renderLoop)
    }

    getCanvas = () => this.#canvas

    clearOverlays = () => {
        const gl = this.#gl
        for (const data of this.#overlayTextures.values()) {
            gl.deleteTexture(data.tex)
        }
        this.#overlayTextures.clear()
    }

    setSize = (width, height) => {
        this.#outW = width
        this.#outH = height
        this.#resize()
    }

    dispose = () => {
        if (this.#raf) {
            cancelAnimationFrame(this.#raf)
        }
        this.clearOverlays()
        const gl = this.#gl
        gl.deleteTexture(this.#sourceTexture)
        gl.deleteBuffer(this.#quadBuffer)
        gl.deleteProgram(this.#program)
    }
}