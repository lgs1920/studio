/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: usesafeClick.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-25
 * Last modified: 2025-10-25
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *  const safeSave = useSafeClick(handleSave);
 *  <button {...safeSave}>saver</button>
 ******************************************************************************/

export const useSafeClick = (onClick, threshold = 5) => {
    const dragged = useRef(false)
    const start = useRef({x: 0, y: 0})

    const onPointerDown = useCallback((e) => {
        start.current = {x: e.clientX, y: e.clientY}
        dragged.current = false
    }, [])

    const onPointerMove = useCallback((e) => {
        const dx = Math.abs(e.clientX - start.current.x)
        const dy = Math.abs(e.clientY - start.current.y)
        if (dx > threshold || dy > threshold) {
            dragged.current = true
        }
    }, [threshold])

    const onFilteredClick = useCallback((e) => {
        if (!dragged.current) {
            onClick?.(e)
        }
    }, [onClick])

    return {
        onPointerDown,
        onPointerMove,
        onClick: onFilteredClick,
    }
}