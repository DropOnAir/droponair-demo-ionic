import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.droponairdemo',
  appName: 'DropOnAir Demo',
  webDir: 'dist/droponair-demo-ionic',
  server: {
    androidScheme: 'https',
  },
};

export default config;
