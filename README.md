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

- **Frontend Framework**: React 19.1.0
- **State Management**: Valtio for reactive state management
- **3D Visualization**: Cesium.js for WebGL-based 3D globe rendering
- **UI Components**: Shoelace and custom components
- **Geospatial Processing**: Turf.js for geospatial operations
- **Data Storage**: IndexedDB for local storage with structured schema
- **Build Tool**: Vite with TypeScript support
- **Icons**: FontAwesome Pro with duotone and regular icon sets

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
2. Install dependencies with `npm install` or `bun install`
3. Configure environment variables in `.env`
4. Run the development server with `npm run dev` or `bun run dev`

### Building for Production

1. Run `npm run build` or `bun run build`
2. The build output will be in the `dist` directory
3. Deploy the contents to a static web server

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