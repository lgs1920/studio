```markdown
# LGS1920 – Widget Context Menu System (React)

A clean, production-ready context menu system for draggable/resizable widgets.

## Features

- Single floating context menu (singleton pattern)
- Opens on **long-press** (mobile) **or right-click** (desktop)
- Smart positioning with automatic flip inside viewport
- Auto-close when clicking outside
- Actions: resize (±10 %), reset size, snap to 9 positions, delete widget
- Fully compatible with **React + react-moveable + Valtio + Shoelace**

## Setup & Usage

### 1. Create the Valtio store (once)

```js
// src/stores/ui/contextMenu.js
import { proxy } from 'valtio'

export const contextMenu = proxy({
    visible: false,
    type: null,        // 'widget' | 'canvas' | etc.
    targetId: null,    // ID of the targeted widget
    position: { x: 0, y: 0 },
})
```

### 2. Initialize the singleton (app root)

```jsx
// App.jsx or Studio.jsx
import { ContextMenu }       from '@Utils/ContextMenu'
import { WidgetContextMenu } from '@Components/WidgetContextMenu'
import { contextMenu }       from '@Stores/ui/contextMenu'
import { useRef, useEffect } from 'react'

let menuManager = null

export const App = () => {
    const menuRootRef = useRef(null)

    useEffect(() => {
        menuManager = new ContextMenu()
        menuManager.initialize(menuRootRef.current)
        return () => menuManager?.destroy()
    }, [])

    // Watch store changes to show/hide the menu
    useEffect(() => {
        if (contextMenu.visible && contextMenu.position) {
            menuManager.showAt(contextMenu.position)
        }
        else {
            menuManager.hide()
        }
    }, [contextMenu.visible, contextMenu.position])

    return (
        <>
            {/* Your canvas + widgets here */}

            {/* Floating menu – always mounted */}
            <div
                ref={menuRootRef}
                style={{position: 'fixed', zIndex: 9999, pointerEvents: 'none'}}
            >
                {contextMenu.visible && contextMenu.type === 'widget' && (
                    <WidgetContextMenu targetId={contextMenu.targetId}/>
                )}
            </div>
        </>
    )
}
```

### 3. Use the hook inside your Widget

```jsx
// Inside any Widget.jsx
import { usePointerInteractions } from '@Hooks/usePointerInteractions'
import { contextMenu }            from '@Stores/ui/contextMenu'
import { useCallback, useRef }    from 'react'

const Widget = ({config, children}) => {
    const widgetRef = useRef(null)

    const openMenu = useCallback((e) => {
        const x = e.clientX ?? e.touches?.[0]?.clientX
        const y = e.clientY ?? e.touches?.[0]?.clientY

        contextMenu.visible = true
        contextMenu.type = 'widget'
        contextMenu.targetId = config.id
        contextMenu.position = {x, y}
    }, [config.id])

    const pointerInteractions = usePointerInteractions({
                                                           onLongTapOrRightClick: openMenu,
                                                           longTapDelay:          600,
                                                           preventContextMenu:    true,
                                                       })

    return (
        <div
            ref={(el) => {
                widgetRef.current = el
                pointerInteractions(el)
            }}
            className="lgs-widget"
        >
            {children}
        </div>
    )
}
```