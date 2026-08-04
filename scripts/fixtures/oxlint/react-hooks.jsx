import { useState } from 'react'

export const InvalidHooksFixture = () => {
    if (Math.random() > 0.5) {
        useState(0)
    }

    return null
}
