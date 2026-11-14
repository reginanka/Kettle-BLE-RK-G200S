import { Capacitor } from '@capacitor/core';
import { BleClient, type BleDevice, type BleService } from '@capacitor-community/bluetooth-le';
import { PROTOCOL_CONSTANTS } from './kettleProtocol';

/**
 * Abstract BLE Transport interface.
 * Uses Web Bluetooth in browsers / PWA / TWA and @capacitor-community/bluetooth-le
 * inside native Capacitor Android / iOS builds.
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

export function isNativeCapacitor(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

export function isBleSupported(): boolean {
  return isNativeCapacitor() || isWebBluetoothSupported();
}

export function createDefaultBleTransport(): KettleTransport {
  return isNativeCapacitor() ? new CapacitorBleTransport() : new WebBluetoothTransport();
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

interface CapacitorCharTarget {
  serviceUuid: string;
  charUuid: string;
  writeWithoutResponse: boolean;
}

export class CapacitorBleTransport implements KettleTransport {
  public deviceName = 'RK-G200S';
  private deviceId: string | null = null;
  private writeTarget: CapacitorCharTarget | null = null;
  private notifyTarget: CapacitorCharTarget | null = null;
  private initialized = false;

  private clearRefs(): void {
    this.writeTarget = null;
    this.notifyTarget = null;
    this.deviceId = null;
  }

  private findCharacteristicTargets(services: BleService[]): {
    writeTarget: CapacitorCharTarget | null;
    notifyTarget: CapacitorCharTarget | null;
  } {
    let writeTarget: CapacitorCharTarget | null = null;
    let notifyTarget: CapacitorCharTarget | null = null;

    // Prefer exact Nordic UART Service (NUS) characteristics first
    for (const service of services) {
      const sUuid = service.uuid.toLowerCase();
      for (const ch of service.characteristics) {
        const cUuid = ch.uuid.toLowerCase();
        if (cUuid === PROTOCOL_CONSTANTS.RX_CHAR_UUID && (ch.properties.write || ch.properties.writeWithoutResponse)) {
          writeTarget = {
            serviceUuid: service.uuid,
            charUuid: ch.uuid,
            writeWithoutResponse: ch.properties.writeWithoutResponse,
          };
        }
        if (cUuid === PROTOCOL_CONSTANTS.TX_CHAR_UUID && (ch.properties.notify || ch.properties.indicate)) {
          notifyTarget = {
            serviceUuid: service.uuid,
            charUuid: ch.uuid,
            writeWithoutResponse: false,
          };
        }
        if (sUuid === PROTOCOL_CONSTANTS.SERVICE_NUS_UUID) {
          if (!writeTarget && (ch.properties.write || ch.properties.writeWithoutResponse)) {
            writeTarget = {
              serviceUuid: service.uuid,
              charUuid: ch.uuid,
              writeWithoutResponse: ch.properties.writeWithoutResponse,
            };
          }
          if (!notifyTarget && (ch.properties.notify || ch.properties.indicate)) {
            notifyTarget = {
              serviceUuid: service.uuid,
              charUuid: ch.uuid,
              writeWithoutResponse: false,
            };
          }
        }
      }
    }

    // Fallback to any write/notify characteristic pair
    if (!writeTarget || !notifyTarget) {
      for (const service of services) {
        for (const ch of service.characteristics) {
          if (!notifyTarget && (ch.properties.notify || ch.properties.indicate)) {
            notifyTarget = {
              serviceUuid: service.uuid,
              charUuid: ch.uuid,
              writeWithoutResponse: false,
            };
          }
          if (!writeTarget && (ch.properties.write || ch.properties.writeWithoutResponse)) {
            writeTarget = {
              serviceUuid: service.uuid,
              charUuid: ch.uuid,
              writeWithoutResponse: ch.properties.writeWithoutResponse,
            };
          }
        }
      }
    }

    return { writeTarget, notifyTarget };
  }

  public async connect(
    onDisconnected: () => void,
    onNotify: (bytes: Uint8Array) => void,
    onLog: (msg: string) => void
  ): Promise<void> {
    if (!this.initialized) {
      await BleClient.initialize({ androidNeverForLocation: false });
      this.initialized = true;
    }

    const enabled = await BleClient.isEnabled();
    if (!enabled) {
      try {
        await BleClient.requestEnable();
      } catch {
        throw new Error('Увімкніть Bluetooth на пристрої для підключення до чайника.');
      }
    }

    onLog('Пошук Bluetooth пристрою RK-G200S (Capacitor BLE)...');

    let device: BleDevice | null = null;
    try {
      device = await BleClient.requestDevice({
        namePrefix: PROTOCOL_CONSTANTS.DEVICE_PREFIX_FILTER,
        optionalServices: [
          PROTOCOL_CONSTANTS.SERVICE_NUS_UUID,
          PROTOCOL_CONSTANTS.SERVICE_FFF0_UUID,
        ],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/cancel|dismiss|aborted/i.test(msg)) {
        throw new Error('Вибір пристрою скасовано.');
      }
      onLog('Фільтр імені не знайшов пристрій, відкриття загального списку...');
      try {
        device = await BleClient.requestDevice({
          optionalServices: [
            PROTOCOL_CONSTANTS.SERVICE_NUS_UUID,
            PROTOCOL_CONSTANTS.SERVICE_FFF0_UUID,
          ],
        });
      } catch (fallbackErr) {
        const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        if (/cancel|dismiss|aborted/i.test(fallbackMsg)) {
          throw new Error('Вибір пристрою скасовано.');
        }
        throw fallbackErr instanceof Error ? fallbackErr : new Error(fallbackMsg);
      }
    }

    if (!device) {
      throw new Error('Пристрій не вибрано');
    }

    this.deviceId = device.deviceId;
    this.deviceName = device.name || 'RK-G200S';
    onLog(`Вибрано: ${this.deviceName}. Підключення до GATT...`);

    let writeTarget: CapacitorCharTarget | null = null;
    let notifyTarget: CapacitorCharTarget | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        onLog(`Підключення GATT (спроба ${attempt}/3)...`);
        await BleClient.connect(
          this.deviceId,
          (disconnectedId) => {
            if (disconnectedId === this.deviceId) {
              this.clearRefs();
              onDisconnected();
            }
          },
          { timeout: 10000 }
        );
        await new Promise((r) => setTimeout(r, 350));

        let services = await BleClient.getServices(this.deviceId);
        if (services.length === 0) {
          await BleClient.discoverServices(this.deviceId);
          services = await BleClient.getServices(this.deviceId);
        }

        const targets = this.findCharacteristicTargets(services);
        writeTarget = targets.writeTarget;
        notifyTarget = targets.notifyTarget;

        if (writeTarget && notifyTarget) break;
        throw new Error('Не знайдено характеристики write/notify');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onLog(`GATT спроба ${attempt} не вдалась: ${msg}`);
        try {
          await BleClient.disconnect(this.deviceId);
        } catch {
          // ignore
        }
        if (attempt >= 3) {
          this.clearRefs();
          throw err instanceof Error ? err : new Error(msg);
        }
        await new Promise((r) => setTimeout(r, 750));
      }
    }

    if (!writeTarget || !notifyTarget || !this.deviceId) {
      this.clearRefs();
      throw new Error('У пристрої відсутня пара write/notify (це не RK-G200S?)');
    }

    this.writeTarget = writeTarget;
    this.notifyTarget = notifyTarget;

    await BleClient.startNotifications(
      this.deviceId,
      this.notifyTarget.serviceUuid,
      this.notifyTarget.charUuid,
      (value: DataView) => {
        const copy = new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
        onNotify(copy);
      }
    );

    onLog('Канал сповіщень TX активовано.');
  }

  public async write(packet: Uint8Array): Promise<void> {
    if (!this.deviceId || !this.writeTarget) {
      throw new Error('Канал запису BLE недоступний');
    }
    const copy = Uint8Array.from(packet);
    const view = new DataView(copy.buffer);
    if (this.writeTarget.writeWithoutResponse) {
      await BleClient.writeWithoutResponse(
        this.deviceId,
        this.writeTarget.serviceUuid,
        this.writeTarget.charUuid,
        view
      );
    } else {
      await BleClient.write(
        this.deviceId,
        this.writeTarget.serviceUuid,
        this.writeTarget.charUuid,
        view
      );
    }
  }

  public disconnect(): void {
    const devId = this.deviceId;
    const notify = this.notifyTarget;
    this.clearRefs();

    if (!devId) return;
    void (async () => {
      if (notify) {
        try {
          await BleClient.stopNotifications(devId, notify.serviceUuid, notify.charUuid);
        } catch {
          // ignore
        }
      }
      try {
        await BleClient.disconnect(devId);
      } catch {
        // ignore
      }
    })();
  }
}
