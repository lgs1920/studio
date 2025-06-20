/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: utils.test.js
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

// Test suite for utility functions
import { describe, expect, it }            from 'vitest'
import { add, divide, multiply, subtract } from '../Utils/testUtils'

describe('Utility Functions', () => {
    it('should add two numbers correctly', () => {
        expect(add(2, 3)).toBe(5)
        expect(add(-1, 1)).toBe(0)
        expect(add(0, 0)).toBe(0)
    })

    it('should subtract two numbers correctly', () => {
        expect(subtract(5, 3)).toBe(2)
        expect(subtract(1, 1)).toBe(0)
        expect(subtract(0, 5)).toBe(-5)
    })

    it('should multiply two numbers correctly', () => {
        expect(multiply(2, 3)).toBe(6)
        expect(multiply(-1, 1)).toBe(-1)
        expect(multiply(0, 5)).toBe(0)
    })

    it('should divide two numbers correctly', () => {
        expect(divide(6, 3)).toBe(2)
        expect(divide(1, 1)).toBe(1)
        expect(divide(0, 5)).toBe(0)
    })

    it('should throw an error when dividing by zero', () => {
        expect(() => divide(5, 0)).toThrow('Cannot divide by zero')
    })
})
