/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: shaders.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-11
 * Last modified: 2025-07-11
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

    // Vertex shader for WebGL2
export const vertexShaderWebGL2 = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
`

// Fragment shader for WebGL2
export const fragmentShaderWebGL2 = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;
uniform sampler2D u_texture;

void main() {
    fragColor = texture(u_texture, v_texCoord);
}
`

// Vertex shader for WebGL1
export const vertexShaderWebGL1 = `#version 100
precision highp float;

attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}
`

// Fragment shader for WebGL1
export const fragmentShaderWebGL1 = `#version 100
precision highp float;

varying vec2 v_texCoord;
uniform sampler2D u_texture;

void main() {
    gl_FragColor = texture2D(u_texture, v_texCoord);
}
`