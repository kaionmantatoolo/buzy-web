# Buzy Web - Hong Kong Bus ETA

A web version of the Buzy app, providing real-time bus arrival times for Hong Kong KMB and CTB routes.

## Features

- **Nearby Routes**: Find bus routes near your current location
- **Search**: Search for routes by number using a custom keypad
- **Favorites**: Save up to 5 favorite routes for quick access
- **Route Details**: View all stops with real-time ETA information
- **Interactive Map**: See route paths and stop locations on an interactive map
- **Bilingual**: Supports English and Traditional Chinese (Cantonese)
- **PWA Support**: Install as a standalone app on mobile devices

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI Library**: Material UI (MUI) v5 with Material 3 theming
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **Maps**: Leaflet (OpenStreetMap)
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

```bash
# Navigate to the web app directory
cd buzy-web

# Install dependencies
npm install

# Run development server
npm run dev
```

The app will be available at `http://localhost:3000`.

### Building for Production

```bash
npm run build
npm start
```

## Deployment to Vercel

### Option 1: Via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Set the root directory to `buzy-web`
5. Click "Deploy"

### Option 2: Via Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Deploy
cd buzy-web
vercel
```

## Project Structure

```
buzy-web/
├── app/                    # Next.js App Router pages
│   ├── api/               # API proxy routes
│   │   └── eta/          # KMB/CTB ETA API proxies
│   ├── favorites/        # Favorites page
│   ├── route/            # Route detail pages
│   ├── search/           # Search page
│   ├── settings/         # Settings page
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Home (Nearby) page
│   └── providers.tsx     # Client providers
├── components/            # React components
│   ├── layout/           # Layout components
│   ├── map/              # Map components
│   ├── route/            # Route-related components
│   └── ui/               # UI components
├── lib/                   # Utilities and services
│   ├── i18n/             # Internationalization
│   ├── services/         # API services
│   ├── stores/           # Zustand stores
│   └── types/            # TypeScript types
└── public/               # Static assets
```

## Data Sources

- **Route Data**: Fetched from [buzyData GitHub repo](https://github.com/kaionmantatoolo/buzyData)
- **KMB ETA**: [data.etabus.gov.hk](https://data.etabus.gov.hk)
- **CTB ETA**: [rt.data.gov.hk](https://rt.data.gov.hk)

## API Proxy

The app uses Next.js API routes to proxy requests to the KMB and CTB APIs to avoid CORS issues:

- `/api/eta/kmb/[...path]` → `https://data.etabus.gov.hk/v1/transport/kmb/[path]`
- `/api/eta/ctb/[...path]` → `https://rt.data.gov.hk/v2/transport/citybus/[path]`

## Configuration

### Environment Variables

No environment variables are required for basic functionality. All API endpoints are public.

### Settings

Users can configure the following in the Settings page:
- Discovery range (300m - 1500m)
- Joint route display preference (KMB or CTB info)
- Language (English or Traditional Chinese)

## PWA Installation

### iOS (Safari)

1. Open the app in Safari
2. Tap the Share button
3. Select "Add to Home Screen"

### Android (Chrome)

1. Open the app in Chrome
2. Tap the menu (three dots)
3. Select "Add to Home screen"

## Browser Support

- Chrome 80+
- Safari 14+
- Firefox 80+
- Edge 80+

## License

This project is for personal use. Route data is sourced from public Hong Kong government APIs.

## Credits

- Original iOS app: Buzy
- Route data: [buzyData](https://github.com/kaionmantatoolo/buzyData)
- KMB/CTB APIs: Hong Kong Government Open Data
