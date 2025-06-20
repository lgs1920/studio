# LGS1920 Studio

## Introduction

LGS1920 Studio is a powerful web-based geospatial application for creating, managing, and visualizing geographical
journeys, tracks, and points of interest. Built with modern web technologies, it provides a feature-rich environment for
working with geographical data including 3D visualization powered by Cesium.

## Project Phases

### Phase 1: Core Platform (Current)

The current implementation provides a robust foundation for geographical journey mapping and visualization, including:

- Interactive 3D visualization of geographical data
- Journey and track management
- POI (Points of Interest) system with customizable styling
- Elevation data integration from multiple sources
- Import/export capabilities for standard formats
- Local data persistence

### Phase 2: Journey Video Creation (Upcoming)

The second phase will expand the platform's capabilities with video generation features:

- Automated journey fly-through video creation
- Customizable camera paths and angles
- Track animation with configurable timing and speed
- Video export in standard formats (MP4, WebM)
- POI highlighting and focus points in videos
- Narration and text overlay options
- Custom transition effects between POIs and segments

## Key Features

### Interactive Map Visualization

- 3D globe visualization powered by Cesium
- Multiple base maps and terrain providers
- Customizable viewing angles and camera positions
- Automatic rotation for dynamic viewing

### Journey Management

- Create, edit, and visualize complete journeys
- Organize multiple tracks in a single journey
- Apply global styling and visualization options
- Toggle visibility of journey components

### Track Editing

- Draw and edit track paths with precise control
- Style tracks with custom colors, widths, and patterns
- Calculate and display track metrics (distance, elevation gain/loss)
- Automated terrain height sampling

### Points of Interest (POIs)

- Add, edit, and manage POIs with rich information
- Customizable POI styling with colors and icons
- Expanded or collapsed information display
- Distance-based placement validation
- Grouping and categorization options

### Elevation Data

- Support for multiple elevation data sources
- Custom elevation servers integration
- File-based elevation information
- Simulated elevation when real data is unavailable
- Elevation profile visualization

### Import/Export

- Support for GeoJSON, KML, and GPX formats
- Export complete journeys or individual tracks
- Custom export options with styling preservation
- Clipboard integration for quick sharing

## Technology Stack

- **Frontend Language**: JavaScript
- **Frontend Framework**: [React 19.1.0](https://react.dev/) - A JavaScript library for building user interfaces
- **State Management**: [Valtio](https://valtio.pmnd.rs) - A proxy-based state management tool for React
- **3D Visualization**: [Cesium.js](https://cesium.com/) - The WebGL-based globe and map engine
- **Canvas Rendering**: [Konva](https://konvajs.org/) - HTML5 Canvas JavaScript framework for drawings and animations
- **UI Components**: [Shoelace](https://shoelace.style/) - A collection of web components used for the UI
- **Geospatial Processing**: [Turf.js](https://turfjs.org/) - Advanced geospatial analysis for browsers and Node.js
- **Data Storage**: IndexedDB for local storage with structured schema
- **Build Tool**: [Vite](https://vitejs.dev/) - Next generation frontend tooling
- **Icons**: [FontAwesome](https://fontawesome.com/) - The iconic SVG, font, and CSS toolkit
- **Charts Library**: [ECharts](https://echarts.apache.org/en/index.html) - A powerful, interactive charting library
- **JavaScript Runtime**: [Bun](https://bun.sh/) - A fast all-in-one JavaScript runtime

## Architecture

The application follows a modular architecture with several key components:

### Core Components

- **Journey**: The main container for geographical data, containing tracks and POIs
- **Track**: Represents a path or route with styling and metadata
- **POI (Point of Interest)**: Markers on the map with additional information
- **Event Management**: Custom event system for handling mouse and touch interactions
- **Store Management**: Reactive state management using Valtio

### Utility Modules

- **CesiumUtils**: Helper functions for Cesium integration
- **TrackUtils**: Operations on tracks such as drawing, focusing, and calculating metrics
- **POIUtils**: Functions for POI visualization and management
- **SceneUtils**: Scene management including camera control and visualization options
- **ElevationServer**: Services for fetching and processing elevation data

## User Interface

- **Editor Panels**: Specialized panels for editing journeys, tracks, and POIs
- **Settings Controls**: User interface for configuring application behavior
- **Component Library**: Reusable UI components like toggles, buttons, and dialogs
- **Visualization Tools**: Components for data visualization like elevation profiles

## Usage Guide

### Creating a Journey

1. Import geographical data or create a new journey
2. Add and customize tracks with styling options
3. Place POIs at key locations along the journey
4. Configure elevation data source if needed
5. Save the journey to local storage or export

### Editing Tracks

Tracks can be edited using:

- Style settings for color and thickness
- Visibility toggles for showing/hiding
- Start and stop flags for marking key points
- Point-by-point editing for precise control

### Managing POIs

POIs can be:

- Added at specific coordinates
- Styled with custom colors and icons
- Expanded to show detailed information
- Associated with parent tracks or journeys
- Toggled for visibility

## Development

### Prerequisites

- Node.js 16+
- npm or bun package manager
- Modern web browser with WebGL support

### Setup

1. Clone the repository
2. Install dependencies with `bun install`
3. Configure environment variables in `.env`
4. Run the development server with `bun run dev`

## Later in Phase 2: Journey Video Creation

The upcoming video creation module will allow users to transform their journeys into engaging videos:

### Video Generation Features

- **Camera Path Creation**: Design custom camera paths for journey fly-throughs
- **POI Focus Points**: Automatically focus on POIs with configurable dwell times
- **Speed Control**: Variable speed settings for different journey segments
- **Transition Effects**: Smooth transitions between key points and segments
- **Video Quality Settings**: Configure resolution, framerate, and quality
- **Export Options**: Generate videos in standard formats for sharing

### Video Customization

- **Text Overlays**: Add titles, captions, and descriptions
- **Custom Styling**: Apply visual themes and effects to videos
- **Narration**: Add audio narration or background music
- **Highlight Points**: Emphasize important locations or features
- **Timeline Editor**: Visual timeline for editing video segments

### Integration with Core Platform

- Seamless transition from journey editing to video creation
- Reuse of styling and visualization settings
- Integrated preview of video segments
- Direct export to common video platforms

## License

© 2025 LGS1920. All rights reserved.