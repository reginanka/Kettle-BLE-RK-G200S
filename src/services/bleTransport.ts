import { PROTOCOL_CONSTANTS } from './kettleProtocol';

/**
 * Abstract BLE Transport interface.
 * Currently backed by Web Bluetooth for browser / GitHub Pages / TWA.
 * Can be swapped for @capacitor-community/bluetooth-le when building native Android APK.
 */
export interface KettleTransport {
  readonly deviceName: string;
  connect(onDisconnected: () => void, onNotify: (bytes: Uint8Array) => void, onLog: (msg: string) => void): Promise<void>;
  write(packet: Uint8Array): Promise<void>;
  disconnect(): void;
}

interface GattCharacteristicLike {
  properties: {
    write: boolean;
    writeWithoutResponse: boolean;
    notify: boolean;
    indicate: boolean;
  };
  startNotifications: () => Promise<GattCharacteristicLike>;
  writeValueWithResponse?: (data: BufferSource) => Promise<void>;
  writeValueWithoutResponse?: (data: BufferSource) => Promise<void>;
  writeValue?: (data: BufferSource) => Promise<void>;
  addEventListener: (type: string, listener: (ev: Event) => void) => void;
  removeEventListener: (type: string, listener: (ev: Event) => void) => void;
}

interface GattServiceLike {
  uuid: string;
  getCharacteristics: () => Promise<GattCharacteristicLike[]>;
}

interface GattServerLike {
  connected: boolean;
  connect: () => Promise<GattServerLike>;
  getPrimaryServices: () => Promise<GattServiceLike[]>;
  getPrimaryService: (uuid: string) => Promise<GattServiceLike>;
  disconnect: () => void;
}

interface BluetoothDeviceLike {
  name?: string;
  gatt?: GattServerLike;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

export class WebBluetoothTransport implements KettleTransport {
  public deviceName = 'RK-G200S';
  private device: BluetoothDeviceLike | null = null;
  private server: GattServerLike | null = null;
  private writeChar: GattCharacteristicLike | null = null;
  private notifyChar: GattCharacteristicLike | null = null;
  private disconnectHandler: (() => void) | null = null;
  private notifyHandler: ((ev: Event) => void) | null = null;

  public async connect(
    onDisconnected: () => void,
    onNotify: (bytes: Uint8Array) => void,
    onLog: (msg: string) => void
  ): Promise<void> {
    if (!isWebBluetoothSupported()) {
      throw new Error('Web Bluetooth не підтримується у цьому браузері. Використовуйте Google Chrome або Microsoft Edge.');
    }

    const bt = (navigator as unknown as {
      bluetooth: {
        requestDevice: (opts: unknown) => Promise<BluetoothDeviceLike>;
      };
    }).bluetooth;

    onLog('Пошук Bluetooth пристрою RK-G200S...');

    try {
      this.device = await bt.requestDevice({
        filters: [
          { name: PROTOCOL_CONSTANTS.DEVICE_NAME_FILTER },
          { namePrefix: PROTOCOL_CONSTANTS.DEVICE_PREFIX_FILTER },
        ],
        optionalServices: [
          PROTOCOL_CONSTANTS.SERVICE_NUS_UUID,
          PROTOCOL_CONSTANTS.SERVICE_FFF0_UUID,
        ],
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotFoundError') {
        throw new Error('Вибір пристрою скасовано.');
      }
      onLog('Фільтр імені не знайшов пристрій, відкриття загального списку...');
      this.device = await bt.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          PROTOCOL_CONSTANTS.SERVICE_NUS_UUID,
          PROTOCOL_CONSTANTS.SERVICE_FFF0_UUID,
        ],
      });
    }

    if (!this.device) {
      throw new Error('Пристрій не вибрано');
    }

    this.deviceName = this.device.name || 'RK-G200S';
    onLog(`Вибрано: ${this.deviceName}. Підключення до GATT...`);

    this.disconnectHandler = onDisconnected;
    this.device.removeEventListener('gattserverdisconnected', this.disconnectHandler);
    this.device.addEventListener('gattserverdisconnected', this.disconnectHandler);

    // Retry loop for Android BLE GATT stability
    let writeChar: GattCharacteristicLike | null = null;
    let notifyChar: GattCharacteristicLike | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (!this.device.gatt) {
          throw new Error('GATT інтерфейс недоступний');
        }

        if (!this.device.gatt.connected) {
          onLog(`Підключення GATT (спроба ${attempt}/3)...`);
          this.server = await this.device.gatt.connect();
          await new Promise((r) => setTimeout(r, 350));
        } else {
          this.server = this.device.gatt;
        }

        if (!this.server?.connected) {
          throw new Error('GATT Server is disconnected');
        }

        const services = await this.server.getPrimaryServices();
        for (const service of services) {
          const chars = await service.getCharacteristics();
          for (const ch of chars) {
            if ((ch.properties.notify || ch.properties.indicate) && !notifyChar) {
              notifyChar = ch;
            }
            if ((ch.properties.write || ch.properties.writeWithoutResponse) && !writeChar) {
              writeChar = ch;
            }
          }
        }

        if (writeChar && notifyChar) break;
        throw new Error('Не знайдено характеристики write/notify');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onLog(`GATT спроба ${attempt} не вдалась: ${msg}`);
        if (attempt >= 3) {
          throw err instanceof Error ? err : new Error(msg);
        }
        await new Promise((r) => setTimeout(r, 750));
      }
    }

    if (!writeChar || !notifyChar) {
      throw new Error('У пристрої відсутня пара write/notify (це не RK-G200S?)');
    }

    this.writeChar = writeChar;
    this.notifyChar = notifyChar;

    await this.notifyChar.startNotifications();
    this.notifyHandler = (ev: Event) => {
      const target = ev.target as { value?: DataView } | null;
      const view = target?.value;
      if (!view) return;
      const copy = new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
      onNotify(copy);
    };
    this.notifyChar.addEventListener('characteristicvaluechanged', this.notifyHandler);
    onLog('Канал сповіщень TX активовано.');
  }

  public async write(packet: Uint8Array): Promise<void> {
    if (!this.writeChar) {
      throw new Error('Канал запису BLE недоступний');
    }
    const buffer = packet.buffer.slice(packet.byteOffset, packet.byteOffset + packet.byteLength) as ArrayBuffer;
    if (this.writeChar.properties.writeWithoutResponse && typeof this.writeChar.writeValueWithoutResponse === 'function') {
      await this.writeChar.writeValueWithoutResponse(buffer);
    } else if (typeof this.writeChar.writeValueWithResponse === 'function') {
      await this.writeChar.writeValueWithResponse(buffer);
    } else if (typeof this.writeChar.writeValue === 'function') {
      await this.writeChar.writeValue(buffer);
    } else {
      throw new Error('Метод запису BLE не підтримується');
    }
  }

  public disconnect(): void {
    if (this.notifyChar && this.notifyHandler) {
      try {
        this.notifyChar.removeEventListener('characteristicvaluechanged', this.notifyHandler);
      } catch {
        // ignore
      }
      this.notifyHandler = null;
    }
    if (this.device && this.disconnectHandler) {
      try {
        this.device.removeEventListener('gattserverdisconnected', this.disconnectHandler);
      } catch {
        // ignore
      }
    }
    if (this.device?.gatt?.connected) {
      try {
        this.device.gatt.disconnect();
      } catch {
        // ignore
      }
    }
    this.writeChar = null;
    this.notifyChar = null;
    this.server = null;
  }
}
