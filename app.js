const express = require('express');
const cors = require('cors'); // Import the cors middleware
const SerialPort = require('serialport');
const { MavLinkPacketSplitter, MavLinkPacketParser, common, ardupilotmega } = require('node-mavlink');

const serialPortPath = 'COM4';
const baudRate = 57600;

const app = express();
const portNumber = 3000;

let port;
let reader;

// Use cors middleware to enable CORS
app.use(cors());

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
      ...common.REGISTRY,
      ...ardupilotmega.REGISTRY,
    };

    app.get('/', (req, res) => {
      res.json({ status: 'Ok', message: 'Servidor en línea' });
    });

    app.get('/altitude', (req, res) => {
      const altitude = app.locals.altitude || 0;
      res.json({ altitude: altitude });
    });

    reader.on('data', (packet) => {
      const messageId = packet.header.msgid;

      switch (messageId) {
        case 33: // GLOBAL_POSITION_INT
          const altitude = (packet.payload.readInt32LE(16) / 1000).toFixed(2);
          console.log('Altitud:', altitude, 'metros');
          app.locals.altitude = altitude;
          break;
      }
    });

    reader.on('end', () => {
      console.log('Lector de paquetes MavLink desconectado.');
    });

    reader.on('error', (err) => {
      console.error('Error en el lector de paquetes MavLink:', err.message);
    });

    app.listen(portNumber, () => {
      console.log(`Servidor Express iniciado en http://localhost:${portNumber}`);
    });
  })
  .catch((error) => {
    console.error('Error al abrir el puerto serial:', error.message);
    console.error('La controladora de vuelo no está conectada.');
  });
