import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FirstTrade - Indian Stock & F&O Terminal',
    short_name: 'FirstTrade',
    description: 'Live Indian Stock Market & Option Trading Terminal with real-time NSE/BSE feeds',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B0E14',
    theme_color: '#00D09C',
    orientation: 'portrait-primary',
    scope: '/',
    categories: ['finance', 'business', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  };
}
