# LGS1920 Studio Development Guidelines

This document provides essential information for developers working on the LGS1920 Studio project. It includes
build/configuration instructions, testing information, and additional development guidelines.

## Build/Configuration Instructions

### Prerequisites

- [Bun](https://bun.sh/) (JavaScript runtime and package manager)
- Node.js 16+ (as mentioned in the README)
- Modern web browser with WebGL support (for Cesium)

### Setup and Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```
3. Configure environment variables in `.env` if needed

### Development Server

Start the development server:

```bash
bun dev
```

This will start the Vite development server at `http://localhost:5173`.

### Building for Production

Build the project for production:

```bash
bun build
```

The build output will be in the `dist/{version}` directory, where `{version}` is read from `public/version.json`.

### Deployment

Deploy the project using:

```bash
bun deploy
```

This runs the `deploy.js` script which handles the deployment process.

## Testing Information

### Testing Framework

The project uses [Vitest](https://vitest.dev/) as the testing framework, which is compatible with Vite and works well
with React components.

### Test Configuration

Tests are configured in `vitest.config.ts`, which sets up:

- JSDOM for simulating a browser environment
- Path aliases that match the project's structure
- Test file patterns and exclusions

### Running Tests

Run all tests once:

```bash
bun test
```

Run tests in watch mode (for development):

```bash
bun test:watch
```

### Writing Tests

#### Test File Location

Place test files in the `src/__tests__` directory with a `.test.js`, `.test.jsx`, `.test.ts`, or `.test.tsx` extension.

#### Example Test

Here's a simple example of a test file:

```javascript
// src/__tests__/utils.test.js
import { describe, it, expect } from 'vitest';
import { add, subtract } from '../Utils/testUtils';

describe('Utility Functions', () => {
  it('should add two numbers correctly', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('should subtract two numbers correctly', () => {
    expect(subtract(5, 3)).toBe(2);
  });
});
```

#### Testing React Components

For React components, use React Testing Library:

```javascript
// src/__tests__/Component.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MyComponent from '../components/MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

## Additional Development Information

### Project Structure

- `src/`: Source code
    - `assets/`: Static assets
    - `components/`: React components
    - `core/`: Core application logic
    - `Utils/`: Utility functions
    - `__tests__/`: Test files
- `public/`: Public assets
- `dist/`: Build output
- `.junie/`: Project documentation and guidelines

### Code Style and Conventions

The project uses ESLint for code linting with the following configurations:

- ESLint recommended rules
- TypeScript ESLint rules
- React Hooks rules

Run the linter:

```bash
bun lint
```

### Path Aliases

The project uses path aliases for cleaner imports:

- `@Utils` → `./src/Utils`
- `@Editor` → `./src/components/TracksEditor`
- `@Components` → `./src/components`
- `@Core` → `./src/core`

Example usage:

```javascript
import { someUtil } from '@Utils/someUtil';
import { SomeComponent } from '@Components/SomeComponent';
```

### Technology Stack

- **Frontend Framework**: React 19.1.0
- **State Management**: Valtio
- **3D Visualization**: Cesium.js
- **Canvas Rendering**: Konva
- **UI Components**: Shoelace
- **Geospatial Processing**: Turf.js
- **Build Tool**: Vite
- **JavaScript Runtime**: Bun

### Working with Cesium

The project uses Cesium for 3D globe visualization. When working with Cesium:

1. Import Cesium components from the project's wrapper components in `src/components/cesium/`
2. Use the utility functions in `src/Utils/cesium/` for common Cesium operations
3. The Cesium viewer is configured in `src/components/cesium/Viewer.jsx`

### Data Storage

The project uses IndexedDB for local storage with a structured schema. The database operations are abstracted through
utility functions.