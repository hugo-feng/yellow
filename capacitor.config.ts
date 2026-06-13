import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yellow.reader',
  appName: 'Yellow Reader',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
