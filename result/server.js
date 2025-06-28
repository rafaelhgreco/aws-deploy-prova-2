var express = require('express'),
    async = require('async'),
    { Pool } = require('pg'),
    path = require('path'),
    cookieParser = require('cookie-parser'),
    app = express(),
    server = require('http').Server(app),
    io = require('socket.io')(server);

var port = process.env.PORT || 4000;

io.on('connection', function (socket) {

  socket.emit('message', { text : 'Welcome!' });

  socket.on('subscribe', function (data) {
    socket.join(data.channel);
  });
});

// 1. Pegar os detalhes da conexão a partir das variáveis de ambiente
const dbHost = process.env.POSTGRES_HOST;
const dbUser = process.env.POSTGRES_USER;
const dbPassword = process.env.POSTGRES_PASSWORD;

// 2. Construir a connection string dinamicamente
const connectionString = `postgres://${dbUser}:${dbPassword}@${dbHost}/postgres`;

// 3. Criar o Pool de conexões com a string correta
var pool = new Pool({
  connectionString: connectionString
});

async.retry(
  {times: 1000, interval: 1000},
  function(callback) {
    pool.connect(function(err, client, done) {
      if (err) {
        console.error("Waiting for db");
      }
      callback(err, client);
    });
  },
  function(err, client) {
    if (err) {
      return console.error("Giving up");
    }
    console.log("Connected to db");
    
    // --- ALTERAÇÃO APLICADA AQUI ---
    // Garante que a tabela 'votes' exista antes de começar a ler dela.
    const createTableQuery = 'CREATE TABLE IF NOT EXISTS votes (id VARCHAR(255) NOT NULL UNIQUE, vote VARCHAR(255) NOT NULL)';
    client.query(createTableQuery, function(err, result) {
      if (err) {
        console.error("Error creating table 'votes':", err);
        return; // Para a execução se a tabela não puder ser criada
      }
      console.log("Table 'votes' is ready or already exists.");
      // Inicia o loop para buscar os votos APENAS DEPOIS de garantir que a tabela existe.
      getVotes(client);
    });
    // --- FIM DA ALTERAÇÃO ---
  }
);

function getVotes(client) {
  client.query('SELECT vote, COUNT(id) AS count FROM votes GROUP BY vote', [], function(err, result) {
    if (err) {
      console.error("Error performing query: " + err);
    } else {
      var votes = collectVotesFromResult(result);
      io.sockets.emit("scores", JSON.stringify(votes));
    }

    // Agenda a próxima verificação, mesmo que a consulta atual tenha falhado
    setTimeout(function() { getVotes(client) }, 1000);
  });
}

function collectVotesFromResult(result) {
  var votes = {a: 0, b: 0};

  result.rows.forEach(function (row) {
    votes[row.vote] = parseInt(row.count);
  });

  return votes;
}

app.use(cookieParser());
app.use(express.urlencoded({extended: true})); // Adicionado 'extended: true' para remover o aviso de 'deprecated'
app.use(express.static(__dirname + '/views'));

app.get('/', function (req, res) {
  res.sendFile(path.resolve(__dirname + '/views/index.html'));
});

server.listen(port, function () {
  var port = server.address().port;
  console.log('App running on port ' + port);
});