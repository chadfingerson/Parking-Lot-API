const express = require('express');
const bodyParser = require('body-parser');
const ds = require('../lib/datastore.js');
const dm = require('../lib/datamodel.js');
const request = require('request');
const datastore = ds.datastore;

const router = express.Router();
router.use(bodyParser.json());

var dotenv = require('dotenv');
dotenv.config();

const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');

const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: JWKS_URI
  }),

  // Validate the audience and the issuer.
  issuer: AUTH0_ISSUER,
  algorithms: ['RS256']
})

const USERS = 'Users';
const CARS = 'Cars';

// GET a list of users
router.get('/', checkJwt, (req, res, next) => {
  const accept = req.accepts('json');
  if(accept) {
    const users = dm.getEntityList(USERS, req)
    .then( (user) => {
      res.status(200).json(user);
    })
    .catch( (error) => {
      console.log(error);
      res.status(500).end();
    });
  } else {
    res.status(406).send('Not Acceptable. Only application/json is allowed.');
  }
});

// POST Create a new user
router.post('/', function(req, res, next) {
  if(req.get('content-type') !== 'application/json'){
    res.status(415).send('Server only accepts application/json data.');
  } else {
    const firstName = req.body.firstName;
    const lastName = req.body.lastName
    const email = req.body.email;
    const password = req.body.password;
    const connection = "Username-Password-Authentication";
    if ((typeof firstName === 'undefined' || firstName === null) || (typeof lastName === 'undefined' || lastName === null) || (typeof email === 'undefined' || email === null) || (typeof password === 'undefined' || password === null))
    {
      res.status(400).send("Missing property. Check documentation for proper syntax.");
    } else {
      var authBody = {
        client_id: AUTH0_CLIENT_ID,
        client_secret: AUTH0_CLIENT_SECRET,
        audience: AUTH0_API_AUDIENCE,
        grant_type: "client_credentials"
      };
      var options = {
        method: 'POST',
        url: AUTH0_OAUTH,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(authBody)
      };
      request(options, function(error, response, body) {
        if (error) {
          console.log(error);
          res.status(500).send(error);
        } else {
          var token = "Bearer " + JSON.parse(body).access_token;
          var jsonBody = {
            email: email,
            password: password,
            verify_email: true,
            given_name: firstName,
            family_name: lastName,
            connection: connection
          };
          var option = {
            method: 'POST',
            url: AUTH0_API_AUDIENCE,
            headers: {
              'authorization': token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(jsonBody)
          };
          request(option, (error, response, body) => {
            if (error) {
              console.log(error);
              res.status(500).send();
            } else {
              var resp = JSON.parse(body);
              if (response.statusCode === 201) {
                var request = {
                  firstName: firstName,
                  lastName: lastName,
                  username: email,
                  auth0id: resp.user_id
                };
                dm.createEntity(USERS, request)
                .then( (result) => {
                  res.location(req.protocol + "://" + req.get('host') + req.baseUrl + '/' + result.key.id);
                  var response = {
                    id: result.key.id
                  };
                  res.status(201).json(response);
                });
              } else {
                var resp = JSON.parse(body);
                console.log(resp);
                res.status(resp.statusCode).send(resp);
              }
            }
          });
        }
      });
    }
  }  
});

// PUT a list of all users
router.put('/', (req, res, next) => {
  res.set('Accept', 'GET, POST');
  res.status(405).end();
});

// DELETE a list of all users
router.delete('/', (req, res, next) => {
  res.set('Accept', 'GET, POST');
  res.status(405).end();
});

// GET a specific user based on provided ID
router.get('/:id', checkJwt, (req, res, next) => {
  const accept = req.accepts('json');
  if(accept) {
    const users = dm.getEntity(USERS, req, req.params.id)
    .then( (user) => {
      if(user.username && user.username !== req.user.name) {
        res.status(403).send('Forbidden');
      } else {
        const carList = dm.getEntityByOwner(CARS, req, req.user.name)
        .then( (cars) => {
          var i;
          var carList = [];
          for (i = 0; i < cars.items.length; i++) {
            var carUrl = req.protocol + "://" + req.get("host") + "/cars/" + cars.items[i].id;
            carList[i] = {
              id: cars.items[i].id,
              self: carUrl
            };
          }
          user.cars = carList;
          res.status(200).json(user);
        })
        .catch( (error) => {
          console.log(error);
          res.status(500).end();
        });
      }
    })
    .catch( (error) => {
      console.log(error)
      res.status(404).end();
    });
  } else {
    res.status(406).send('Only able to return applicaton/json');
  }
});

// PUT a specific user
router.put('/:id', checkJwt, (req, res, next) => {
  if(req.get('content-type') !== 'application/json'){
    res.status(415).send('Server only accepts application/json data.');
  } else {
    const users = dm.getEntity(USERS, req, req.params.id)
    .then( (user) => {
      if(user.username && user.username !== req.user.name) {
        res.status(403).send('Forbidden');
      } else {
        var firstName = req.body.firstName || user.firstName;
        var lastName = req.body.LastName || user.lastName;
        var username = user.username;
        var auth0id = user.auth0id;
        var request = {
          firstName: firstName,
          lastName: lastName,
          username: username,
          auth0id: auth0id
        };
        dm.updateEntity(USERS, req.params.id, request)
        .then( entity => {
          res.location(req.protocol + "://" + req.get('host') + req.baseUrl + '/' + req.params.id);
          res.status(303).end();
        })
        .catch( (error) => {
          console.log(error);
          res.status(500).end();
        });
      }
    })
    .catch( (error) => {
      console.log(error)
      res.status(404).end('User not found');
    });
  }
});

router.delete('/:id', checkJwt, (req, res, next) => {
  const users = dm.getEntity(USERS, req, req.params.id)
    .then( (user) => {
      if(user.username && user.username !== req.user.name) {
        res.status(403).send('Forbidden');
      } else {
        dm.deleteEntity(USERS, req.params.id)
        .then( (result) => {
          var authBody = {
            client_id: AUTH0_CLIENT_ID,
            client_secret: AUTH0_CLIENT_SECRET,
            audience: AUTH0_API_AUDIENCE,
            grant_type: "client_credentials"
          };
          var options = {
            method: 'POST',
            url: AUTH0_OAUTH,
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(authBody)
          };
          request(options, function(error, response, body) {
            if (error) {
              console.log(error);
              res.status(500).send(error);
            } else {
              var token = "Bearer " + JSON.parse(body).access_token;
              var jsonBody = {
                id: user.auth0id
              };
              var postUrl = AUTH0_API_AUDIENCE + 'users/' + user.auth0id;
              var option = {
                method: 'DELETE',
                url: postUrl,
                headers: {
                  'authorization': token,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(jsonBody)
              };
              request(option, (error, response, body) => {
                if (error) {
                  console.log(error);
                  res.status(500).send();
                } else {
                  
                  res.status(204).end();
                }
              });
            }
          });
        })
        .catch( (error) => {
          console.log(error);
          res.status(500).end();
        });
      }
    })
    .catch( (error) => {
      console.log(error);
      res.status(404).end();
    });
});

// POST a specific user
router.post('/:id', checkJwt, (req, res, next) => {
  res.set('Accept', 'GET, PUT, DELETE');
  res.status(405).end();
});

// GET a specific users car list
router.get('/:id/cars', checkJwt, (req, res, next) => {
  const accept = req.accepts('json');
  if(accept) {
    const users = dm.getEntity(USERS, req, req.params.id)
    .then( (user) => {
      if(user.username && user.username !== req.user.name) {
        res.status(403).send('Forbidden');
      } else {
        const carList = dm.getEntityByOwner(CARS, req, req.user.name)
        .then( (cars) => {
          var userCars = cars.items;
          res.status(200).json(userCars);
        })
        .catch( (error) => {
          console.log(error);
          res.status(500).end();
        });
      }
    })
    .catch( (error) => {
      console.log(error)
      res.status(404).end();
    });
  } else {
    res.status(406).send('Only able to return applicaton/json');
  }
});

module.exports = router;