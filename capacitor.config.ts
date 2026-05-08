import { CapacitorConfig } from '@capacitor/cli';

const isProduction = process.env.NODE_ENV === 'production';

const config: CapacitorConfig = {
  appId: 'com.foremanapp.foreman',
  appName: 'Foreman',
  webDir: 'out',
  server: {
    // Points the mobile app at the live hosted web app so all server-side
    // features (auth, Stripe, API routes) work without modification.
    // Replace this URL with your production Vercel domain before building.
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://www.getforeman.app',
    cleartext: false,
    androidScheme: 'https',
  },
  ios: {
    scheme: 'Foreman',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#ffffff',
  },
};

export default config;
