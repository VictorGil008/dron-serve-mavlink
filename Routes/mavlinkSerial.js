const {Router} = require('express');
const SerialPort = require('serialport');
const { exec } = require('child_process');
const path = require('path');
const { MavLinkPacketSplitter, MavLinkPacketParser, minimal, common, ardupilotmega } = require('node-mavlink');

const router = Router();

//Windows
const serialPortPath = 'COM4';
// Linux
// const serialPortPath = '/dev/ttyACM0';

const baudRate = 115200;

let port;
let reader;
let routerAltitude = 0;
let routerBatVoltage = 0;
let routerBatCurrent = 0;
let routerBatRemaining = 0;
let prevRollDegrees = 0;


router.get('/ejecutarScriptWindows', (req, res) => {
  const scriptPath = path.join(__dirname, '..', 'Scripts', 'Windows', 'Encender_Mavproxy.bat');

  // Reemplaza las barras invertidas con barras inclinadas para el sistema de archivos Windows
  const scriptPathWindows = scriptPath.replace(/\//g, '\\');

  // Ejecutar el script utilizando el módulo child_process
  exec(`start "" "${scriptPathWindows}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error al ejecutar el script: ${error.message}`);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    console.log(`Script ejecutado con éxito: ${stdout}`);
    res.status(200).json({ status: 'Ok', message: 'Script ejecutado correctamente' });

    // Esperar 15 segundos antes de abrir el puerto serial
    setTimeout(() => {
      // Función para abrir el puerto serial
      const openSerialPort = async () => {
        return new Promise((resolve, reject) => {
          try {
            port = new SerialPort(serialPortPath, { baudRate }, (error) => {
              if (error) {
                reject(error);
              } else {
                reader = port.pipe(new MavLinkPacketSplitter()).pipe(new MavLinkPacketParser());
                resolve();
              }
            });
          } catch (error) {
            reject(error);
          }
        });
      };

      // Intenta abrir el puerto serial
      openSerialPort()
        .then(() => {
          console.log('Puerto serial abierto correctamente.');
          // Configuración del resto del código
          const REGISTRY = {
            ...minimal.REGISTRY,
            ...common.REGISTRY,
            ...ardupilotmega.REGISTRY,
          };

          router.get('/', (req, res) => {
            res.status(200).json({ status: 'Ok', message: 'Servidor en línea' });
          });

          router.get('/altitude', (req, res) => {
            res.json({  
                altitude: routerAltitude,
                batria: {
                    batteryVolt: routerBatVoltage,
                    batteryCurrent: routerBatCurrent,
                    batteryRemaining: routerBatRemaining
                } 
                
            });
          });

          reader.on('data', (packet) => {
            // const clazz = REGISTRY[packet.header.msgid]
            const messageId = packet.header.msgid;
            // console.log('Received MavLink message with ID:', messageId);
            // console.log('Received MavLink packet:', packet);
            // const messageId = packet.header.msgid;
            // console.log('Received MavLink message with ID:', messageId);

            // if (clazz) {
            //   const data = packet.protocol.data(packet.payload, clazz);
            //   console.log('Decoded MavLink Data:', data);
            // }

            switch (messageId) {
                case 33: // GLOBAL_POSITION_INT
                    const altitude = (packet.payload.readInt32LE(16) / 1000).toFixed(2);
                    console.log('Altitud:', altitude, 'metros');
                    routerAltitude = altitude;
                break;

                case 147: // BATTERY_STATUS
                    // Verificar si el paquete tiene la longitud esperada
                    if (packet.payload.length >= 54) {
                        const batteryVoltage = (packet.payload.readUInt16LE(10) / 1000).toFixed(2);
                        const batteryCurrent = (packet.payload.readInt16LE(1) / 100).toFixed(2);
                        const batteryRemaining = packet.payload.readInt8(35);

                        console.log(`Bat ${batteryVoltage}v ${batteryCurrent}A ${batteryRemaining}%`);
                        
                        routerBatVoltage = batteryVoltage ;
                        routerBatCurrent = batteryCurrent;
                        routerBatRemaining = batteryRemaining;
                    } else {
                        console.error('Longitud de paquete inesperada para BATTERY_STATUS');
                    }
                break; 

                case 30: // ATTITUDE
                    if (packet.payload.length >= 28) {
                        const rollRadians = packet.payload.readFloatLE(4);
                        const pitchRadians = packet.payload.readFloatLE(8);
                        const yawRadians = packet.payload.readFloatLE(12);

                        // Convertir de radianes a grados
                        const rollDegrees = (rollRadians * (180 / Math.PI)).toFixed(2);
                        const pitchDegrees = (pitchRadians * (180 / Math.PI)).toFixed(2);
                        const yawDegrees = (yawRadians * (180 / Math.PI)).toFixed(2);

                        console.log('Roll (grados):', rollDegrees);
                        console.log('Pitch (grados):', pitchDegrees);
                        console.log('Yaw (grados):', yawDegrees);

                        // Detectar movimiento a la izquierda o derecha
                        const rollChange = rollDegrees - prevRollDegrees;
                        if (rollChange > 0.1) {
                        console.log('Movimiento a la derecha');
                        } else if (rollChange < -0.1) {
                        console.log('Movimiento a la izquierda');
                        }

                        // Actualizar el valor anterior de roll
                        prevRollDegrees = rollDegrees;
                    } else {
                        console.log('El paquete ATTITUDE recibido no tiene la longitud esperada.');
                    }
                break;
            }
          });

          reader.on('end', () => {
            console.log('Lector de paquetes MavLink desconectado.');
          });

          reader.on('error', (err) => {
            console.error('Error en el lector de paquetes MavLink:', err.message);
          });

        })
        .catch((error) => {
          console.error('Error al abrir el puerto serial:', error.message);
          console.error('La controladora de vuelo no está conectada.');
        });

    }, 10000);

  });
});



router.get('/ejecutarScriptLinux', (req, res) => {
  const scriptPath = path.join(__dirname, '..', 'Scripts', 'Linux', 'Encender_Mavproxy.sh');

  // Reemplaza las barras invertidas con barras inclinadas para el sistema de archivos Linux
  const scriptPathLinux = scriptPath.replace(/\\/g, '/');

  // Ejecutar el script utilizando el módulo child_process
  exec(`sh "${scriptPathLinux}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error al ejecutar el script: ${error.message}`);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    console.log(`Script ejecutado con éxito: ${stdout}`);
    res.status(200).json({ status: 'Ok', message: 'Script ejecutado correctamente' });

    // Esperar 15 segundos antes de abrir el puerto serial
    setTimeout(() => {
      // Función para abrir el puerto serial
      const openSerialPort = async () => {
        return new Promise((resolve, reject) => {
          try {
            port = new SerialPort(serialPortPath, { baudRate }, (error) => {
              if (error) {
                reject(error);
              } else {
                reader = port.pipe(new MavLinkPacketSplitter()).pipe(new MavLinkPacketParser());
                resolve();
              }
            });
          } catch (error) {
            reject(error);
          }
        });
      };

      // Intenta abrir el puerto serial
      openSerialPort()
        .then(() => {
          console.log('Puerto serial abierto correctamente.');
          // Configuración del resto del código
          const REGISTRY = {
            ...minimal.REGISTRY,
            ...common.REGISTRY,
            ...ardupilotmega.REGISTRY,
          };

          router.get('/', (req, res) => {
            res.status(200).json({ status: 'Ok', message: 'Servidor en línea' });
          });

          router.get('/altitude', (req, res) => {
            res.json({  
                altitude: routerAltitude,
                batria: {
                    batteryVolt: routerBatVoltage,
                    batteryCurrent: routerBatCurrent,
                    batteryRemaining: routerBatRemaining
                } 
                
            });
          });

          reader.on('data', (packet) => {
            // const clazz = REGISTRY[packet.header.msgid]
            const messageId = packet.header.msgid;
            // console.log('Received MavLink message with ID:', messageId);
            // console.log('Received MavLink packet:', packet);
            // const messageId = packet.header.msgid;
            // console.log('Received MavLink message with ID:', messageId);

            // if (clazz) {
            //   const data = packet.protocol.data(packet.payload, clazz);
            //   console.log('Decoded MavLink Data:', data);
            // }

            switch (messageId) {
                case 33: // GLOBAL_POSITION_INT
                    const altitude = (packet.payload.readInt32LE(16) / 1000).toFixed(2);
                    console.log('Altitud:', altitude, 'metros');
                    routerAltitude = altitude;
                break;

                case 147: // BATTERY_STATUS
                    // Verificar si el paquete tiene la longitud esperada
                    if (packet.payload.length >= 54) {
                        const batteryVoltage = (packet.payload.readUInt16LE(10) / 1000).toFixed(2);
                        const batteryCurrent = (packet.payload.readInt16LE(1) / 100).toFixed(2);
                        const batteryRemaining = packet.payload.readInt8(35);

                        console.log(`Bat ${batteryVoltage}v ${batteryCurrent}A ${batteryRemaining}%`);
                        
                        routerBatVoltage = batteryVoltage ;
                        routerBatCurrent = batteryCurrent;
                        routerBatRemaining = batteryRemaining;
                    } else {
                        console.error('Longitud de paquete inesperada para BATTERY_STATUS');
                    }
                break; 

                case 30: // ATTITUDE
                    if (packet.payload.length >= 28) {
                        const rollRadians = packet.payload.readFloatLE(4);
                        const pitchRadians = packet.payload.readFloatLE(8);
                        const yawRadians = packet.payload.readFloatLE(12);

                        // Convertir de radianes a grados
                        const rollDegrees = (rollRadians * (180 / Math.PI)).toFixed(2);
                        const pitchDegrees = (pitchRadians * (180 / Math.PI)).toFixed(2);
                        const yawDegrees = (yawRadians * (180 / Math.PI)).toFixed(2);

                        console.log('Roll (grados):', rollDegrees);
                        console.log('Pitch (grados):', pitchDegrees);
                        console.log('Yaw (grados):', yawDegrees);

                        // Detectar movimiento a la izquierda o derecha
                        const rollChange = rollDegrees - prevRollDegrees;
                        if (rollChange > 0.1) {
                        console.log('Movimiento a la derecha');
                        } else if (rollChange < -0.1) {
                        console.log('Movimiento a la izquierda');
                        }

                        // Actualizar el valor anterior de roll
                        prevRollDegrees = rollDegrees;
                    } else {
                        console.log('El paquete ATTITUDE recibido no tiene la longitud esperada.');
                    }
                break;
            }
          });

          reader.on('end', () => {
            console.log('Lector de paquetes MavLink desconectado.');
          });

          reader.on('error', (err) => {
            console.error('Error en el lector de paquetes MavLink:', err.message);
          });

        })
        .catch((error) => {
          console.error('Error al abrir el puerto serial:', error.message);
          console.error('La controladora de vuelo no está conectada.');
        });

    }, 10000);

  });
});



    module.exports = router;