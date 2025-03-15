# Pixel Art Gemini Analyzer

A tool for generating pixel art with Gemini AI and analyzing images to detect native resolution patterns. This application allows you to both create pixel art using Google's Gemini AI and analyze existing pixel art to determine its native resolution.

## Features

- Generate pixel art using Google's Gemini AI with customizable prompts
- Upload and analyze images to detect patterns using Fast Fourier Transform (FFT)
- Visualize FFT results with interactive graphs
- Identify dominant frequencies in pixel art
- Determine the native resolution of upscaled pixel art
- Display pixel art at its original resolution

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
