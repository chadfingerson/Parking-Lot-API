const path = require('path');
const bodyParser = require('body-parser');
const express = require('express');
const config = require('./config');
const request = require('request');
const login = express.Router();
login.use(bodyParser.json());
const create = express.Router();
create.use(bodyParser.json());

// Load environment variables from .env
var dotenv = require('dotenv');
dotenv.config();

const app = express();

app.enable('trust proxy');

//Boats
app.use('/cars', require('./cars/api'));

//Users
app.use('/users', require('./users/api'));

//Parking
app.use('/parking', require('./parking/api'));

//Login
app.use('/login', login);

login.post('/', (req, res, next) => {
  const username = req.body.username;
  const password = req.body.password;
  var options = {
    method: 'POST',
    url: AUTH0_URL,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    form: {
      grant_type: 'password',
      username: username,
      password: password,
      audience: AUTU0_AUDIENCE,
      scope: 'openid profile',
      responseType: 'id_token',
      client_id: AUTH0_CLIENT_ID,
      client_secret: AUTH0_CLIENT_SECRET,
    }
  };
  request(options, (error, response, body) => {
    if (error) {
      console.log(error);
      res.status(500).send(error);
    } else {
      var statusCode = response.statusCode;
      res.status(statusCode).send(JSON.parse(body));
    }
  });
});

app.use((req, res) => {
  res.status(404).send('Not Found');
});

app.use((err, req, res) => {
  console.error(err);
  res.status(500).send(err.response || 'Something broke!');
});

if (module === require.main) {
  // Start the server
  const server = app.listen(config.get('PORT'), () => {
    const port = server.address().port;
    console.log(`App listening on port ${port}`);
  });
}

module.exports = app;
