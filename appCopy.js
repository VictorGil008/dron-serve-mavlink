const dgram = require('dgram');
const { MavEsp8266 } = require('node-mavlink');

const udpPort = 14552;
let prevRollDegrees = 0;

async function startTelemetry() {
  try {
    const port = new MavEsp8266();

    // Inicia la comunicación con el ESP8266
    await port.start();

    // Escucha los paquetes MAVLink
    port.on('data', (packet) => {
      processMavLinkPacket(packet);
    });

    // Configura el servidor UDP para recibir datos MAVLink del ESP8266
    const udpServer = dgram.createSocket('udp4');

    udpServer.on('listening', () => {
      const address = udpServer.address();
      console.log(`Servidor UDP escuchando en ${address.address}:${address.port}`);
    });

    udpServer.on('message', (message) => {
      // Reenvía los datos MAVLink al puerto MAVLink
      port.write(message);
    });

    udpServer.bind(udpPort);

    console.log('Telemetría iniciada correctamente.');
  } catch (error) {
    console.error('Error al iniciar la telemetría:', error);
  }
}

function processMavLinkPacket(packet) {
  const messageId = packet.header.msgid;

  switch (messageId) {
    case 33: // GLOBAL_POSITION_INT
      const altitude = (packet.payload.readInt32LE(16) / 1000).toFixed(2);
      console.log('Altitud:', altitude, 'metros');
      
      break;

    case 147: // BATTERY_STATUS
      // Verificar si el paquete tiene la longitud esperada
      if (packet.payload.length >= 54) {
        const batteryVoltage = (packet.payload.readUInt16LE(10) / 1000).toFixed(2);
        const batteryCurrent = (packet.payload.readInt16LE(1) / 100).toFixed(2);
        const batteryRemaining = packet.payload.readInt8(35);

        console.log(`Bat ${batteryVoltage}v ${batteryCurrent}A ${batteryRemaining}%`);
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


    default:
      
      break;
  }
}

startTelemetry();
