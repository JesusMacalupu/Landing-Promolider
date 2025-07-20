const express = require('express');
const sql = require('mssql');
const path = require('path');
const fs = require('fs').promises;
const nodemailer = require('nodemailer');
require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const { io: clientIO } = require('socket.io-client');

const app = express();
const server = http.createServer(app);
const io = new Server(server); // Socket.IO como servidor
const port = 5002;

// Configuración de EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public', 'templates'));

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

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

let registrosActuales = 50;
const TOTAL_CUPOS = 100;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'inscripcion-ponencia.html'));
});

app.get('/estado', (req, res) => {
  res.json({
    registros: registrosActuales,
    cupos: TOTAL_CUPOS - registrosActuales
  });
});

// Endpoint accesible desde 5004
app.get('/estado-local', (req, res) => {
  res.json({ mensaje: 'Estado local desde 5002', desde: '5002' });
});

// POST de registro
app.post('/registrar', async (req, res) => {
  const { nombre, correo, telefono } = req.body;

  if (!nombre || !correo || !telefono) {
    return res.status(400).json({ exito: false, mensaje: 'Faltan datos' });
  }

  try {
    await sql.connect(dbConfig);
    await sql.query`
      INSERT INTO RegistroFormulario (Nombre, Correo, Telefono)
      VALUES (${nombre}, ${correo}, ${telefono})
    `;

    registrosActuales = Math.min(registrosActuales + 1, TOTAL_CUPOS);
    const cuposDisponibles = TOTAL_CUPOS - registrosActuales;

    // Enviar correo
    try {
      const htmlCorreo = await new Promise((resolve, reject) => {
        app.render('correo', {
          nombre,
          correo,
          telefono,
          fecha: new Date().toLocaleDateString('es-MX')
        }, (err, html) => {
          if (err) reject(err);
          else resolve(html);
        });
      });

      await transporter.sendMail({
        from: `"Promolíder" <${process.env.GMAIL_USER}>`,
        to: correo,
        subject: '✅ Confirmación de registro exitoso',
        html: htmlCorreo,
        attachments: [
          {
            filename: 'miniLogo.webp',
            path: path.join(__dirname, 'public', 'img-landing', 'miniLogo.webp'),
            cid: 'logoImage'
          },
          {
            filename: 'ponente-promolider.png',
            path: path.join(__dirname, 'public', 'img-landing', 'ponente-promolider.png'),
            cid: 'ponenteImage'
          }
        ]
      });

      console.log(`Correo enviado a: ${correo}`);
    } catch (emailError) {
      console.error('Error al enviar correo:', emailError);
    }

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

// Ruta para recibir la nueva fecha desde el servidor 5004
app.post('/api/update-date', async (req, res) => {
    try {
        const { targetDate } = req.body;
        if (!targetDate) {
            return res.status(400).json({ error: 'Fecha de destino requerida' });
        }

        // Guardar la fecha en un archivo JSON
        await fs.writeFile('targetDate.json', JSON.stringify({ targetDate }));
        res.json({ message: 'Fecha actualizada correctamente' });
    } catch (error) {
        console.error('Error en /api/update-date:', error.message);
        res.status(500).json({ error: 'Error al procesar la solicitud' });
    }
});

// Ruta para obtener la fecha actual
app.get('/api/get-date', async (req, res) => {
    try {
        const data = await fs.readFile('targetDate.json', 'utf8');
        const { targetDate } = JSON.parse(data);
        res.json({ targetDate });
    } catch (error) {
        // Si no hay archivo, usar una fecha por defecto
        res.json({ targetDate: new Date('2025-12-31T23:59:59').toISOString() });
    }
}); 

// === 🔌 Comunicación Bidireccional con puerto 5004 ===

// Cliente conectado a 5004
const socket5004 = clientIO('http://localhost:5004');
socket5004.on('connect', () => {
  console.log('🔌 5002 conectado como cliente a 5004');
});
socket5004.on('mensaje-desde-5004', (data) => {
  console.log('📥 [5002] Mensaje recibido de 5004:', data);
});

// Escuchar conexiones entrantes desde 5004
io.on('connection', (socket) => {
  console.log('📡 [5002] Cliente conectado');
  socket.on('mensaje-desde-5004', (data) => {
    console.log('📨 [5002] Evento recibido desde 5004:', data);
  });
});

// Iniciar servidor
const iniciarServidor = async () => {
  try {
    await sql.connect(dbConfig);
    console.log('✅ Conectado a la base de datos');
    server.listen(port, () => {
      console.log(`✅ Servidor corriendo en http://localhost:${port}`);
    });
  } catch (error) {
    console.error('❌ Error al conectar a la base de datos:', error.message);
  }
};

iniciarServidor();