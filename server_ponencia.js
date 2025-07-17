const express = require('express');
const sql = require('mssql');

const app = express();
const port = 5002;

const dbConfig = {
    user: 'sa',
    password: '12345',
    server: 'localhost',
    port: 1433,
    database: 'Inscripciones_Ponencia',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

const iniciarServidor = async () => {
    try {
        await sql.connect(dbConfig);
        console.log('Base de datos Inscripciones_Ponencia conectada');
        app.listen(port, () => {
            console.log(`Servidor activo en http://localhost:${port}`);
        });
    } catch (error) {
        console.error('Error al conectar a la base de datos:', error.message);
    }
};

app.get('/', async (req, res) => {
    try {
        const result = await sql.query`SELECT GETDATE() AS fecha_actual`;
        res.json({
            estado: 'conectado',
            fecha: result.recordset[0].fecha_actual
        });
    } catch (error) {
        res.status(500).json({
            estado: 'error',
            mensaje: 'No se pudo conectar a la base de datos',
            detalle: error.message
        });
    }
});

iniciarServidor();
