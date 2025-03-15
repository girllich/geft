# Image FFT Analyzer

A tool for analyzing images using Fast Fourier Transform (FFT) to detect patterns, particularly useful for pixel art analysis.

## Features

- Upload and analyze images to detect patterns
- Visualize FFT results with interactive graphs
- Identify dominant frequencies in pixel art
- Estimate original resolution of upscaled pixel art

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

## Usage

1. Start the development server:

```bash
npm run dev
```

2. Open your browser and navigate to the URL shown in the terminal (usually http://localhost:5173)
3. Upload an image and click "Analyze with FFT"
4. View the results and analysis

## Building for Production

To build the application for production:

```bash
npm run build
```

The built files will be in the `dist` directory.

## Preview Production Build

To preview the production build:

```bash
npm run preview
```

## Deploying to GitHub Pages

This project is configured for easy deployment to GitHub Pages using GitHub Actions:

1. Push your changes to the `main` branch
2. GitHub Actions will automatically build and deploy your site
3. Your site will be available at `https://girllich.github.io/geft/`

### Manual Deployment

If you prefer to deploy manually:

1. Build the project: `npm run build`
2. Push the contents of the `dist` directory to the `gh-pages` branch of your repository

## Technologies Used

- React
- TypeScript
- Vite
- mathjs
- Tailwind CSS
