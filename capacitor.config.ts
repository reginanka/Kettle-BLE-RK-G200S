import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.reginanka.kettleble',
  appName: 'Kettle BLE',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'native',
      initialViewportFitValueHint: 'contain',
      style: 'DARK',
      hidden: false,
    },
    BluetoothLe: {
      displayStrings: {
        scanning: 'Пошук чайника RK-G200S...',
        cancel: 'Скасувати',
        availableDevices: 'Доступні Bluetooth-пристрої',
        noDeviceFound: 'Пристроїв не знайдено',
      },
    },
  },
};

export default config;
