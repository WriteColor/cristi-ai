/**
 * Cristi AI - External Hardware & IoT Sensor Layer [STANDBY / BETA NO DISPONIBLE]
 * Módulo en modo Standby / No disponible.
 * No ejecuta sondeos, no crea hardware virtual y no satura logs.
 */

import { eventBus, EVENTS } from '../eventBus.js';

export class ExternalDeviceManager {
  constructor() {
    this.status = 'standby_beta_unavailable';
    this.isStandby = true;
    this.connectedDevices = new Map();
    this.virtualSensorsActive = false;
    this.virtualSensorInterval = null;
    this.rgbState = { r: 160, g: 32, b: 240, mode: 'goth_purple', brightness: 0.8, standby: true };
  }

  registerDevice(deviceDescriptor) {
    return {
      status: 'standby',
      message: 'Módulo de hardware en standby (desarrollo beta no disponible).',
      device: deviceDescriptor
    };
  }

  disconnectDevice(id) {
    return { status: 'standby' };
  }

  handleSensorSignal(sensorType, data) {
    // Standby: Ignorado deliberadamente
    return { status: 'standby' };
  }

  setRGBColor(r, g, b, mode = 'static') {
    return {
      status: 'standby',
      message: 'Control RGB en standby (desarrollo beta no disponible).'
    };
  }

  enableVirtualSensors() {
    // Standby: No activa simulaciones innecesarias
    this.virtualSensorsActive = false;
  }

  disableVirtualSensors() {
    this.virtualSensorsActive = false;
    if (this.virtualSensorInterval) {
      clearInterval(this.virtualSensorInterval);
      this.virtualSensorInterval = null;
    }
  }

  getConnectedDevices() {
    return [];
  }

  getRGBState() {
    return this.rgbState;
  }

  getStatus() {
    return {
      isStandby: true,
      status: 'standby_beta_unavailable',
      description: 'Control de dispositivos inalámbricos (Arduino, sensores, luces) en standby de desarrollo.'
    };
  }
}

export const externalDeviceManager = new ExternalDeviceManager();
export default externalDeviceManager;
