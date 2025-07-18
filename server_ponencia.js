const express = require('express');
const sql = require('mssql');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
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

    // Renderizar y enviar correo
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
        from: `"Ponencia Académica" <${process.env.GMAIL_USER}>`,
        to: correo,
        subject: '✅ Confirmación de registro exitoso',
        html: htmlCorreo,
        attachments: [
          {
            filename: 'miniLogo.webp',
            path: path.join(__dirname, 'public', 'img-landing', 'miniLogo.webp'),
            cid: 'logoImage' // ID único para la primera imagen
          },
          {
            filename: 'ponente-promolider.png',
            path: path.join(__dirname, 'public', 'img-landing', 'ponente-promolider.png'),
            cid: 'ponenteImage' // ID único para la segunda imagen
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