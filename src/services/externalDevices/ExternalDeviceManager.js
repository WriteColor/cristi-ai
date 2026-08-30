/**
 * Cristi AI - External Hardware & IoT Sensor Management Layer
 * Provides clean abstractions for Arduino, IoT sensors (temp, motion, light, buttons),
 * and smart actuators (RGB lights, buzzers) communicating via EventBus.
 */

import { eventBus, EVENTS } from '../eventBus';
import { logger } from '../logger';

export class ExternalDeviceManager {
  constructor() {
    this.connectedDevices = new Map();
    this.virtualSensorsActive = false;
    this.virtualSensorInterval = null;

    // Default RGB light state
    this.rgbState = { r: 160, g: 32, b: 240, mode: 'goth_purple', brightness: 0.8 };
  }

  /**
   * Register a new external device or sensor module
   * @param {Object} deviceDescriptor - { id, name, type: 'sensor'|'actuator'|'hybrid', protocol }
   */
  registerDevice(deviceDescriptor) {
    const id = deviceDescriptor.id || `dev_${Date.now()}`;
    const device = {
      ...deviceDescriptor,
      id,
      status: 'connected',
      registeredAt: Date.now()
    };
    this.connectedDevices.set(id, device);

    eventBus.emit(EVENTS.DEVICE_CONNECTED, device);
    logger.info('HARDWARE', `Dispositivo externo conectado: "${device.name}" (${device.type})`, device);
    return device;
  }

  /**
   * Disconnect/unregister a device
   * @param {string} id 
   */
  disconnectDevice(id) {
    if (this.connectedDevices.has(id)) {
      const device = this.connectedDevices.get(id);
      device.status = 'disconnected';
      this.connectedDevices.delete(id);
      eventBus.emit(EVENTS.DEVICE_DISCONNECTED, { id, name: device.name });
      logger.info('HARDWARE', `Dispositivo externo desconectado: "${device.name}"`);
    }
  }

  /**
   * Handle an incoming signal from a physical or virtual sensor
   * @param {string} sensorType - e.g. 'motion', 'temperature', 'light', 'button'
   * @param {any} data - payload
   */
  handleSensorSignal(sensorType, data) {
    const payload = {
      sensorType,
      data,
      timestamp: Date.now()
    };

    logger.info('SENSOR', `Señal recibida de sensor [${sensorType}]:`, data);
    eventBus.emit(EVENTS.SENSOR_EVENT, payload);

    // Contextual reaction triggers
    if (sensorType === 'motion' && data?.detected) {
      eventBus.emit(EVENTS.EMOTION_CHANGED, 'surprised');
    } else if (sensorType === 'button_pressed') {
      eventBus.emit(EVENTS.EMOTION_CHANGED, 'happy');
    }
  }

  /**
   * Control smart actuator: Set RGB Light color and animation mode
   * @param {number} r (0-255)
   * @param {number} g (0-255)
   * @param {number} b (0-255)
   * @param {string} mode - 'static' | 'breathe' | 'pulse' | 'goth_purple'
   */
  setRGBColor(r, g, b, mode = 'static') {
    this.rgbState = { r, g, b, mode, brightness: 1.0 };
    eventBus.emit(EVENTS.ACTUATOR_COMMAND, {
      type: 'rgb_light',
      state: this.rgbState
    });
    logger.info('HARDWARE', `Comando RGB enviado: RGB(${r}, ${g}, ${b}) Modo: ${mode}`);
    return this.rgbState;
  }

  /**
   * Enable virtual sensors for testing, simulation and demonstrations
   */
  enableVirtualSensors() {
    if (this.virtualSensorsActive) return;
    this.virtualSensorsActive = true;

    // Register standard simulated hardware
    this.registerDevice({
      id: 'arduino_sensor_hub_1',
      name: 'Arduino Ambient Sensor Hub (Simulado / Virtual)',
      type: 'hybrid',
      protocol: 'serial'
    });

    this.registerDevice({
      id: 'smart_rgb_lamp_1',
      name: 'Smart Goth RGB Lamp (Simulado / Virtual)',
      type: 'actuator',
      protocol: 'mqtt'
    });

    logger.info('HARDWARE', 'Módulo de Sensores Virtuales y Dispositivos IoT activado.');
  }

  disableVirtualSensors() {
    this.virtualSensorsActive = false;
    if (this.virtualSensorInterval) {
      clearInterval(this.virtualSensorInterval);
      this.virtualSensorInterval = null;
    }
  }

  getConnectedDevices() {
    return Array.from(this.connectedDevices.values());
  }

  getRGBState() {
    return this.rgbState;
  }
}

export const externalDeviceManager = new ExternalDeviceManager();
