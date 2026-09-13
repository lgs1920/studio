# Tunnel Component

## Overview

The `Tunnel` component is a React component that renders a horizontal navigation tunnel. Each step in the tunnel
is represented by a FontAwesome icon, a label, and optional content. Steps can be marked as completed or mandatory, with
optional `beforeStep` and `afterStep` events to control navigation. An exit button allows the user to leave the tunnel.

## Installation

1. Import the component in your application:
   ```javascript
   import { Tunnel } from './Tunnel'
   ```

## Props

- `steps`: Array of `TunnelStep` objects defining the tunnel's steps.
- `onExit`: Callback function triggered when the user clicks the exit button.

### `TunnelStep` Structure

Each step is an object with the following properties:

- `icon` (string): FontAwesome icon name (e.g., `'user'`, `'check'`). Defaults to `'circle'`.
- `text` (string): Step label.
- `done` (boolean, optional): Indicates if the step is completed. Defaults to `false`.
- `mandatory` (boolean, optional): Indicates if the step is mandatory. Defaults to `false`.
- `component` (React.ReactNode, optional): Content to render for the active step.
- `tooltip` (string | object | false, optional): Tooltip content. Uses `text` when omitted, and `false` disables it.
- `tooltipPlacement` (string, optional): Preferred tooltip placement. Defaults to `top` and flips when needed.
- `beforeStep` ((index: number) => boolean, optional): Called before navigating to the step; return `false` to cancel
  navigation.
- `afterStep` ((index: number) => void, optional): Called after navigating to the step.

## Usage Example

```javascript
import React            from 'react'
import { Tunnel } from './Tunnel'

const Step1Component = () => <div>Step 1 content</div>
const Step2Component = () => <div>Step 2 content</div>

const steps = [
    {
        icon:       'user',
        text:       'Step 1',
        done:       false,
        mandatory:  true,
        component:  <Step1Component/>,
        beforeStep: index => {
            console.log(`Before navigating to step ${index}`)
            return true
        },
        afterStep:  index => console.log(`After navigating to step ${index}`)
    },
    {
        icon:      'check',
        text:      'Step 2',
        done:      false,
        mandatory: false,
        component: <Step2Component/>
        // No beforeStep/afterStep, handled gracefully
    }
]

const App = () => {
    const handleExit = () => console.log('Exiting tunnel')

    return <Tunnel steps={steps} onExit={handleExit}/>
}
```

## Styles

- The main container (`.lgs-tunnel-container`)
- The navigation bar (`.lgs-tunnel-bar`)
- Step buttons (`.lgs-tunnel-element`): FontAwesome icon with hover effect.
- Step content (`.lgs-tunnel-content`)

## Notes

- Mandatory steps (`mandatory: true`) must be completed (`done: true`) to allow navigation to subsequent steps.
- The `beforeStep` and `afterStep` events are optional. If not provided, navigation proceeds without errors.
