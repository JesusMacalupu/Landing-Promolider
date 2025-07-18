const express = require('express');
const sql = require('mssql');
const path = require('path');

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

// Variables para el control de registros
let registrosActuales = 50;
const TOTAL_CUPOS = 100;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'inscripcion-ponencia.html'));
});

// Obtener estado actual
app.get('/estado', (req, res) => {
  res.json({
    registros: registrosActuales,
    cupos: TOTAL_CUPOS - registrosActuales
  });
});

// Registrar nuevo participante
app.post('/registrar', async (req, res) => {
  const { nombre, correo } = req.body;

  if (!nombre || !correo) {
    return res.status(400).json({ exito: false, mensaje: 'Faltan datos' });
  }

  try {
    await sql.connect(dbConfig);
    await sql.query`
      INSERT INTO RegistroFormulario (Nombre, Correo)
      VALUES (${nombre}, ${correo})
    `;
    
    // Actualizar contadores
    registrosActuales = Math.min(registrosActuales + 1, TOTAL_CUPOS);
    const cuposDisponibles = TOTAL_CUPOS - registrosActuales;
    
    res.json({ 
      exito: true,
      registros: registrosActuales,
      cupos: cuposDisponibles
    });
  } catch (error) {
    console.error('❌ Error al registrar:', error);
    res.status(500).json({ exito: false, mensaje: 'Error en el servidor' });
  }
});

// Iniciar servidor
const iniciarServidor = async () => {
  try {
    await sql.connect(dbConfig);
    console.log('✅ Conectado a la base de datos');
    app.listen(port, () => {
      console.log(`✅ Servidor corriendo en http://localhost:${port}`);
    });
  } catch (error) {
    console.error('❌ Error al conectar a la base de datos:', error.message);
  }
};

iniciarServidor(); 