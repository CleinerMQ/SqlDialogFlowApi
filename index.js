const express = require('express');
const { WebhookClient } = require('dialogflow-fulfillment');
const app = express();
const sql = require('mssql');

// Configuración de la conexión a SQL Server
const config = {
  user: 'Kennyxd_SQLLogin_1',
  password: 'e7bf38hjqp',
  server: 'ProyectoTesis.mssql.somee.com',
  database: 'ProyectoTesis',
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

// Función para realizar la conexión
async function conectar() {
  try {
    // Intentar conectar a la base de datos
    const pool = await sql.connect(config);
    console.log('Conexión exitosa a la base de datos');
    return pool;
  } catch (error) {
    // Capturar cualquier error durante la conexión
    console.error('Error al conectar a la base de datos:', error.message);
    return null; // Devuelve null en caso de error
  }
}

// Función para conectar a la base de datos
function connectToDatabase() {
  return conectar().then((connection) => {
    if (connection) {
      return connection;
    } else {
      throw new Error('Error al conectar a la base de datos');
    }
  });
}

// Función para realizar una consulta de estado en la base de datos
function queryEstado(connection, Dni) {
  return new Promise((resolve, reject) => {
    const request = connection.request();
    request.input('Dni', Dni); // Usar input para evitar problemas de SQL Injection

    request.query('SELECT * FROM PedidosClientes WHERE DNICliente = @Dni', (error, results, fields) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}


// Función para realizar una consulta en la base de datos
function queryDatabase(connection) {
  return new Promise((resolve, reject) => {
    connection.query('SELECT * FROM Producto where esActivo  = 1', (error, results, fields) => {
      if (error) {
        console.error('Error al ejecutar la consulta:', error);
        reject(error);
      } else {
        console.log('Resultado de la consulta:', results);
        resolve(results);
      }
    });
  });
}

// Función para manejar la lectura de productos desde MySQL
function handleReadFromMySQL(agent) {
  return connectToDatabase().then((connection) => {
    return queryDatabase(connection).then((result) => {
      console.log('Resultados de la consulta:', result);

      const recordset = result && result.recordset;

      if (recordset && recordset.length > 0) {
        agent.add("Contamos con todos estos productos👇😁");
        const formattedResponse = recordset.map((producto) => {
          return {
            Id: producto.idProducto,
            Marca: producto.marca,
            Descripcion: producto.descripcion,
            Precio: producto.precio,
          };
        });

        formattedResponse.forEach((p) => {
          const fulfillmentText = `IdProducto: ${p.Id}\nMarca: ${p.Marca}\nDescripción: ${p.Descripcion}\nPrecio: ${p.Precio}\n`;
          agent.add(fulfillmentText);
        });
      } else {
        agent.add('No se encontraron productos.');
      }
      connection.close(); // Cerrar la conexión
      return Promise.resolve(); // Asegurarse de que la promesa se resuelva después de cerrar la conexión
    });
  });
}



// Function to insert data into the PedidosClientes table
function insertPedido(connection, data) {
  return new Promise((resolve, reject) => {
    const query = 'INSERT INTO PedidosClientes (NombreCliente, DNICliente, DireccionCliente, TelefonoCliente, EstadoPedido, total) VALUES (@NombreCliente, @DNICliente, @DireccionCliente, @TelefonoCliente, @EstadoPedido, @TotalPedido); SELECT SCOPE_IDENTITY() AS PedidoID;';

    const request = connection.request();

    request.input('NombreCliente', sql.VarChar, data.NombreCliente);
    request.input('DNICliente', sql.VarChar, data.DNICliente);
    request.input('DireccionCliente', sql.VarChar, data.DireccionCliente);
    request.input('TelefonoCliente', sql.VarChar, data.TelefonoCliente);
    request.input('EstadoPedido', sql.VarChar, 'Pendiente');
    request.input('TotalPedido', sql.Decimal, 0);

    request.query(query, (error, results) => {
      if (error) {
        reject(error);
      } else {
        const pedidoID = results && results.recordset && results.recordset[0] ? results.recordset[0].PedidoID : null;
        resolve(pedidoID);
      }
    });
  });
}

// Function to handle the write operation and display PedidoID
function handleWriteIntoMysql(agent) {
  const { parameters } = agent.request_.body.queryResult;

  const safeJoin = (param) => (Array.isArray(param) ? param.join(' ') : param);

  const data = {
    NombreCliente: safeJoin(parameters.Nombre),
    DNICliente: safeJoin(parameters.DNICliente),
    DireccionCliente: safeJoin(parameters.DireccionCliente),
    TelefonoCliente: safeJoin(parameters.Telefono),
  };

  console.log("Datos:");
  console.log(data.NombreCliente);
  console.log(data.DNICliente);
  console.log(data.DireccionCliente);
  console.log(data.TelefonoCliente);

  return connectToDatabase()
    .then((connection) => {
      return insertPedido(connection, data)
        .then((pedidoID) => {
          if (pedidoID !== null) {
            agent.add(`Su pedido ha sido registrado con éxito 🤭. El número de pedido es: ${pedidoID}`);
            agent.add(`Ahora Escriba "Reguistrar Productos" para reguistrar sus productos 🙌 `);
          } else {
            agent.add("No se pudo obtener el ID del pedido después de la inserción.");
          }
        })
        .catch((error) => {
          console.error("Error al registrar el pedido: ", error);
          agent.add("Hubo un error al procesar tu pedido. Por favor, inténtalo de nuevo.");
        })
        .finally(() => {
          connection.close(); // Close the connection
        });
    });
}




// Función para verificar el estado de un pedido
function checkOrderStatus(agent) {
  const Dni = agent.parameters.DNI


  return connectToDatabase().then((connection) => {
    return queryEstado(connection, Dni).then((result) => {
      console.log(result)
      const estado = result && result.recordset;

      if (estado && estado.length > 0) {
        const estadoPedido = result.recordset[0].EstadoPedido;

        agent.add(`🔋El estado de tu pedido es:  ${estadoPedido}`);
      } else {
        agent.add('No se encontró ningún pedido con este numero de DNI.🙁');
      }
      connection.close(); // Cerrar la conexión
    });
  });
}

// Función para realizar una consulta de categorías en la base de datos
function queryCategorias(connection) {
  return new Promise((resolve, reject) => {
    connection.query("SELECT * FROM Categoria where esActivo  = 1", (error, results, fields) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}
// Función para ListarCategorias
function ListarCategorias(agent) {
  return connectToDatabase().then((connection) => {
    return queryCategorias(connection).then((result) => {
      console.log('Resultados de la consulta de categorías:', result);

      const categorias = result && result.recordset;

      if (categorias && categorias.length > 0) {
        const nombresCategorias = categorias.map(categoria => categoria.descripcion);
        agent.add("🌟 Claro, tengo estas variedades de categorías para ofrecerte. 🤖💼");
        nombresCategorias.forEach((nombre) => {
          agent.add(`${nombre}`);
        });
        agent.add("🌟Sobre que categoria en espesifico te gustaria que le mostremos?🤓");
      } else {
        agent.add('No se encontraron categorías.');
      }
      connection.close(); // Cerrar la conexión
      return Promise.resolve(); // Asegurarse de que la promesa se resuelva después de cerrar la conexión
    });
  });
}

// Función para realizar una consulta de productos por categoría en la base de datos
function queryProductosPorCategoria(connection, categoria) {
  return new Promise((resolve, reject) => {
    const request = connection.request();
    request.input('Categoria', sql.VarChar, categoria); // Usar input para evitar problemas de SQL Injection
    console.log(categoria);
    request.query('SELECT * FROM Producto WHERE idCategoria IN (SELECT idCategoria FROM Categoria WHERE descripcion = @Categoria) AND esActivo = 1', (error, results, fields) => {
      console.log(request);
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

// Función para ListarProductosPorCategoria
function ListarProductosPorCategoria(agent) {
  const categoria = agent.parameters.Categoria; // Obtener la categoría desde la solicitud de Dialogflow

  return connectToDatabase().then((connection) => {
    return queryProductosPorCategoria(connection, categoria).then((result) => {
      console.log('Resultados de la consulta de productos por categoría:', result);

      const productos = result && result.recordset;

      if (productos && productos.length > 0) {
        agent.add(`Aquí tienes algunos productos de la categoría ${categoria}:`);
        const formattedResponse = productos.map((producto) => {  // Cambio aquí: usar 'productos' en lugar de 'recordset'
          return {
            Id: producto.idProducto,
            Marca: producto.marca,
            Descripcion: producto.descripcion,
            Precio: producto.precio,
          };
        });

        formattedResponse.forEach((p) => {
          const fulfillmentText = `Id Producto: ${p.Id}\nMarca: ${p.Marca}\nDescripción: ${p.Descripcion}\nPrecio: ${p.Precio}\n`;
          agent.add(fulfillmentText);
        });
      } else {
        agent.add(`No se encontraron productos para la categoría ${categoria}.`);
      }

      connection.close(); // Cerrar la conexión
      return Promise.resolve(); // Asegurarse de que la promesa se resuelva después de cerrar la conexión
    });
  });
}
function getProductPriceById(connection, productId) {
  return new Promise((resolve, reject) => {
    const request = connection.request();
    request.input('ProductId', sql.Int, productId); // Assuming the ID is of type INT, adjust if needed

    request.query('SELECT Precio FROM Producto WHERE idProducto = @ProductId AND esActivo = 1', (error, results) => {
      if (error) {
        reject(error);
      } else {
        const price = results && results.recordset && results.recordset[0] ? results.recordset[0].Precio : null;
        resolve(price);
      }
    });
  });
}

function insertDetallesPedido(connection, data) {
  return new Promise((resolve, reject) => {
    const query = 'INSERT INTO DetallesPedidosClientes (ProductoID, Cantidad, Precio, PedidoID) VALUES (@ProductoID, @Cantidad, @Precio, @PedidoID);';

    const request = connection.request();

    request.input('ProductoID', sql.Int, data.IdProducto);
    request.input('Cantidad', sql.Int, data.Cantidad);
    request.input('Precio', sql.Decimal, data.Precio);
    request.input('PedidoID', sql.Int, data.idPedido);

    request.query(query, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
        
      }
    });
  });
}

function InsertarDetallesProducto(agent) {
  const { parameters } = agent.request_.body.queryResult;

  const safeJoin = (param) => (Array.isArray(param) ? param.join(' ') : param);

  const data = {
    IdProducto: safeJoin(parameters.IdProducto),
    Cantidad: safeJoin(parameters.Cantidad),
    idPedido: safeJoin(parameters.idPedido),
  };

  return connectToDatabase()
    .then((connection) => {
      return getProductPriceById(connection, data.IdProducto)
        .then((precio) => {
          data.Precio = precio; // Assign the price to the data object
          return insertDetallesPedido(connection, data);
        })
        .then(() => {
          agent.add("Su Producto se reguistro a su pedido.");
        })
        .catch((error) => {
          console.error("Error al insertar detalles del producto: ", error);
          agent.add("Hubo un error al procesar los detalles del producto. Por favor, inténtalo de nuevo.");
        })
        .finally(() => {
          connection.close(); // Close the connection
        });
    });
}



// Definir mapeo de intenciones
let intentMap = new Map();

intentMap.set("Mostrar_Productos", handleReadFromMySQL);
intentMap.set('NuevoPedio', handleWriteIntoMysql);
intentMap.set('Estado_Pedido', checkOrderStatus);
intentMap.set('Mostrar_Categorias', ListarCategorias);
intentMap.set("Mostrar_Productos_Categoria", ListarProductosPorCategoria);
intentMap.set("DetallesPedidoCliente", InsertarDetallesProducto);
// Manejar las solicitudes de Dialogflow
app.post('/webhook', express.json(), function (req, res) {
  const agent = new WebhookClient({ request: req, response: res });
  console.log("Dialogflow Request headers: " + JSON.stringify(req.headers));
  console.log("Dialogflow Request body: " + JSON.stringify(req.body));

  agent.handleRequest(intentMap);
});

app.get('/', function (req, res) {
  // Respuesta con un mensaje
  res.send('¡Servidor Api cargado!');
});

// Iniciar el servidor en el puerto 3002
app.listen(3002, () => {
  console.log("Estamos ejecutando el servidor en el puerto 3002");
});
