const SerialPort = require('serialport');
const { MavLinkPacketSplitter, MavLinkPacketParser, common, ardupilotmega } = require('node-mavlink');

const serialPortPath = 'COM4';
const baudRate = 57600; 

let prevRollDegrees = 0;


const port = new SerialPort(serialPortPath, { baudRate });

// Configura el lector de paquetes MavLink
const reader = port.pipe(new MavLinkPacketSplitter()).pipe(new MavLinkPacketParser());


const REGISTRY = {
  ...common.REGISTRY,
  ...ardupilotmega.REGISTRY,
};

reader.on('data', packet => {
  const messageId = packet.header.msgid;

  switch (messageId) {
    case 33: // GLOBAL_POSITION_INT
      const altitude = (packet.payload.readInt32LE(16) / 1000).toFixed(2);
      console.log('Altitud:', altitude, 'metros');
      break;
  }
});


// Manejador de eventos para la desconexión del lector de paquetes MavLink
reader.on('end', () => {
  console.log('Lector de paquetes MavLink desconectado.');
});

// Manejador de eventos para errores en el lector de paquetes MavLink
reader.on('error', (err) => {
  console.error('Error en el lector de paquetes MavLink:', err.message);
});
