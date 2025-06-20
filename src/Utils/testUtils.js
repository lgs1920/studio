/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: testUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-04
 * Last modified: 2025-05-04
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Simple utility functions for testing purposes
 */

/**
 * Adds two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
export function add(a, b) {
    return a + b
}

/**
 * Subtracts second number from first number
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Difference of a and b
 */
export function subtract(a, b) {
    return a - b
}

/**
 * Multiplies two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Product of a and b
 */
export function multiply(a, b) {
    return a * b
}

/**
 * Divides first number by second number
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Quotient of a and b
 * @throws {Error} If b is zero
 */
export function divide(a, b) {
    if (b === 0) {
        throw new Error('Cannot divide by zero')
    }
    return a / b
}