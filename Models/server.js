const express = require('express');
const cors = require('cors'); 


class Server {

    constructor(){
        this.app = express();
        this.port = process.env.PORT;

        //Ruta endpoints Mavlink
        this.mavlinkSerialRoute = '/api/mavlinkSerial';

        //Middlewares
        this.middlewares();

        //Llamar a las rutas
        this.routes();
    }

    middlewares() {

        // CORS middleware
        this.app.use(cors());

    }

    //Rutas
    routes(){

        this.app.use(this.mavlinkSerialRoute, require('../Routes/mavlinkSerial'));

    }

    //Ejecución del servicio de escucha por el puerto
    listen(){

        this.app.listen(this.port, () => {
            console.log(`Ejemplo app escuchando en el puerto:  ${this.port}`)
        });

    }
}

module.exports = Server;