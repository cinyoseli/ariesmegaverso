const express = require('express');
const app = express();
const path = require('path');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt'); // Para encriptar contraseñas
const session = require('express-session'); // Para manejar sesiones
let PORT = process.env.PORT || 3000; // Puerto inicial

// Configurar carpeta de archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'mi_secreto', // Cambia esto por una clave secreta segura
    resave: false,
    saveUninitialized: true
}));
function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        return next(); // El usuario está autenticado, continúa con la siguiente función
    }
    res.redirect('/login'); // Redirige al login si no está autenticado
}
app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});
// Configurar vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware para manejar datos enviados desde formularios
app.use(bodyParser.urlencoded({ extended: true }));

// Conexión a la base de datos MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Lasamoo1989',
    database: 'miTienda'
});

db.connect((err) => {
    if (err) {
        console.error('Error al conectar a la base de datos:', err);
        return;
    }
    console.log('Conexión a la base de datos MySQL exitosa');
});

// Rutas de ejemplo
app.get('/', (req, res) => {
    res.render('home', { session: req.session });
});
app.get('/compradores/productos', (req, res) => {
    const productosPorPagina = 10; // Número de productos por página
    const paginaActual = parseInt(req.query.pagina) || 1; // Página actual (por defecto 1)
    const offset = (paginaActual - 1) * productosPorPagina; // Calcular el desplazamiento

    // Consulta para contar el total de productos
    const totalProductosQuery = 'SELECT COUNT(*) AS total FROM productos';
    db.query(totalProductosQuery, (err, totalResult) => {
        if (err) {
            console.error('Error al contar los productos:', err);
            return res.status(500).send('Error al contar los productos');
        }

        const totalProductos = totalResult[0].total;
        const totalPaginas = Math.ceil(totalProductos / productosPorPagina);

        // Consulta para obtener los productos de la página actual
        const productosQuery = 'SELECT * FROM productos LIMIT ? OFFSET ?';
        db.query(productosQuery, [productosPorPagina, offset], (err, productos) => {
            if (err) {
                console.error('Error al obtener productos:', err);
                return res.status(500).send('Error al obtener productos');
            }

            res.render('compradores/productos', {
                productos,
                paginaActual,
                totalPaginas
            });
        });
    });
});
app.get('/buscar', (req, res) => {
    const { q } = req.query; // Obtiene la consulta del buscador
    const query = `
        SELECT * FROM productos 
        WHERE nombre LIKE ? OR descripcion LIKE ?
    `;
    const searchTerm = `%${q}%`; // Agrega los comodines para la búsqueda

    db.query(query, [searchTerm, searchTerm], (err, results) => {
        if (err) {
            console.error('Error al buscar productos:', err);
            return res.status(500).send('Error al buscar productos');
        }

        res.render('buscar', { productos: results, query: q });
    });
});
// Ruta para mostrar la lista de productos
app.get('/compradores/productos', (req, res) => {
    const query = 'SELECT * FROM productos';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener productos:', err);
            return res.status(500).send('Error al obtener productos');
        }
        res.render('admin/productos', { productos: results });
    });
});

// Ruta para mostrar la descripción de un producto
app.get('/compradores/productos/:id', (req, res) => {
    const { id } = req.params;
    const query = 'SELECT * FROM productos WHERE id = ?';
    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error al obtener el producto:', err);
            return res.status(500).send('Error al obtener el producto');
        }
        if (results.length === 0) {
            return res.status(404).send('Producto no encontrado');
        }
        res.render('admin/descripcionProducto', { producto: results[0] });
    });
});
app.get('/registro', (req, res) => {
    res.render('registro');
});
app.post('/registro', (req, res) => {
    const { nombre, email, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10); // Encriptar la contraseña
    const query = 'INSERT INTO usuarios (nombre, email, password) VALUES (?, ?, ?)';
    db.query(query, [nombre, email, hashedPassword], (err) => {
        if (err) {
            console.error('Error al registrar usuario:', err);
            return res.status(500).send('Error al registrar usuario');
        }
        res.redirect('/login'); // Redirige al login después del registro
    });
});
app.get('/contacto', (req, res) => {
    res.render('contacto');
});
app.post('/contacto/enviar', (req, res) => {
    const { nombre, email, telefono, mensaje } = req.body;

    console.log('Mensaje recibido:');
    console.log(`Nombre: ${nombre}`);
    console.log(`Email: ${email}`);
    console.log(`Teléfono: ${telefono || 'No proporcionado'}`);
    console.log(`Mensaje: ${mensaje}`);

    // Aquí puedes agregar lógica para enviar un correo o guardar el mensaje en la base de datos

    res.send('Gracias por contactarnos. Nos pondremos en contacto contigo pronto.');
});
// Ruta para mostrar el formulario de login
app.get('/login', (req, res) => {
    res.render('login');
});

// Ruta para manejar el login
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    const query = 'SELECT * FROM usuarios WHERE email = ?';
    db.query(query, [email], async (err, results) => {
        if (err) {
            console.error('Error al buscar usuario:', err);
            return res.status(500).send('Error al buscar usuario');
        }
        if (results.length === 0) {
            return res.status(401).send('Usuario no encontrado');
        }

        const user = results[0];
        const isPasswordValid = await bcrypt.compare(password, user.password); // Comparar contraseñas

        if (!isPasswordValid) {
            return res.status(401).send('Contraseña incorrecta');
        }

        // Guardar el usuario en la sesión
        req.session.userId = user.id;
        req.session.userType = user.tipo;

        res.redirect('/'); // Redirige a la página principal
    });
});

// Ruta para cerrar sesión
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/'); // Redirige a la página principal
    });
});

// Ruta para agregar un producto al carrito
app.post('/carrito/agregar', isAuthenticated, (req, res) => {
    const { productoId } = req.body;
    const usuarioId = req.session.userId;

    // Verificar si el producto ya está en el carrito
    const queryCheck = 'SELECT * FROM carrito WHERE usuario_id = ? AND producto_id = ?';
    db.query(queryCheck, [usuarioId, productoId], (err, results) => {
        if (err) {
            console.error('Error al verificar el carrito:', err);
            return res.status(500).send('Error al verificar el carrito');
        }

        if (results.length > 0) {
            // Si el producto ya está en el carrito, incrementa la cantidad
            const queryUpdate = 'UPDATE carrito SET cantidad = cantidad + 1 WHERE usuario_id = ? AND producto_id = ?';
            db.query(queryUpdate, [usuarioId, productoId], (err) => {
                if (err) {
                    console.error('Error al actualizar el carrito:', err);
                    return res.status(500).send('Error al actualizar el carrito');
                }
                res.redirect('/compradores/carrito');
            });
        } else {
            // Si el producto no está en el carrito, agrégalo
            const queryInsert = 'INSERT INTO carrito (usuario_id, producto_id, cantidad) VALUES (?, ?, 1)';
            db.query(queryInsert, [usuarioId, productoId], (err) => {
                if (err) {
                    console.error('Error al agregar al carrito:', err);
                    return res.status(500).send('Error al agregar al carrito');
                }
                res.redirect('/compradores/carrito');
            });
        }
    });
});
app.post('/carrito/finalizar', isAuthenticated, (req, res) => {
    const usuarioId = req.session.userId;

    const query = 'DELETE FROM carrito WHERE usuario_id = ?';
    db.query(query, [usuarioId], (err) => {
        if (err) {
            console.error('Error al finalizar el pedido:', err);
            return res.status(500).send('Error al finalizar el pedido');
        }

        res.send('Pedido finalizado con éxito. ¡Gracias por tu compra!');
    });
});
app.get('/compradores/carrito', isAuthenticated, (req, res) => {
    const usuarioId = req.session.userId;

    const query = `
        SELECT c.id AS carrito_id, p.nombre, p.precio, c.cantidad, p.imagen
        FROM carrito c
        JOIN productos p ON c.producto_id = p.id
        WHERE c.usuario_id = ?
    `;
    db.query(query, [usuarioId], (err, results) => {
        if (err) {
            console.error('Error al obtener el carrito:', err);
            return res.status(500).send('Error al obtener el carrito');
        }

        res.render('compradores/carrito', { carrito: results });
    });
});

const server = app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`El puerto ${PORT} está en uso. Intentando con otro puerto...`);
        PORT += 1; // Incrementa el puerto
        server.listen(PORT); // Intenta iniciar el servidor en el nuevo puerto
    } else {
        console.error('Error al iniciar el servidor:', err);
    }
});

// Iniciar el servidor
