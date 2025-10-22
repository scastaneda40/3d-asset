# 3D Asset Viewer (React + TypeScript + Vite)

This project is an interactive React + TypeScript web application built with Vite.  
It provides a performant interface for browsing, visualizing, and simulating operations on 3D models using modern front-end and WebGL technologies.

## Overview

The application demonstrates a scalable approach to managing and displaying 3D content within a React environment. It allows users to:

- Browse and filter a set of sample 3D assets
- Select individual models to preview in an interactive 3D scene
- Adjust the level of detail (LOD) and simulate compression of models
- Observe updates to model metadata such as polygon count and file size

The goal of this project is to illustrate how front-end systems can interact with 3D rendering libraries and simulate asynchronous, compute-heavy tasks such as model optimization.

## Technologies Used

- **React + TypeScript** – For component-driven UI and type safety
- **Vite** – For fast builds and hot module replacement (HMR)
- **@react-three/fiber** – React renderer for Three.js, enabling declarative 3D scenes
- **@react-three/drei** – Utility components and hooks for common 3D operations
- **Three.js** – Core 3D engine for geometry, lighting, and materials

## Core Concepts

### 1. Reducer-Based State Management

Implements `useReducer` to handle asset selection, filtering, and simulated compression events in a predictable and maintainable way.

### 2. Concurrent UI Updates

Uses React’s `useTransition` to keep the interface responsive during simulated background operations such as compression.

### 3. 3D Rendering and Normalization

Assets are either procedural geometries or imported GLTF models rendered in a consistent viewport. Imported models are normalized for scale and centered automatically to maintain visual consistency.

### 4. Simulation of Asynchronous Jobs

The compression workflow is simulated locally to represent how a front-end might trigger and track asynchronous compute tasks (e.g., decimation or texture compression) in a production system.

## Running the Project

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server

```bash
 npm run dev
```

4. Open the application in your browser
   [http://localhost:5173](http://localhost:5173)
