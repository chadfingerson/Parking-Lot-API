const express = require('express');
const bodyParser = require('body-parser');
const ds = require('../lib/datastore.js');
const dm = require('../lib/datamodel.js');
const json2html = require('node-json2html');
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
});

const PARKING = 'Parking';
const CARS = 'Cars';

// GET a list of all parking
router.get('/', checkJwt, (req, res, next) => {
    const accept = req.accepts('json');
    console.log(accept);
    if(accept) {
        const parking = dm.getEntityList(PARKING, req)
        .then( (response) => {
          res.status(200).json(response);
        })
        .catch( (error) => {
          console.log(error);
          res.status(500).end();
        });
    } else {
        res.status(406).send('Server only accepts application/json data.');
    }
});

// POST a new parking space 
router.post('/', checkJwt, (req, res, next) => {
  if(req.get('content-type') !== 'application/json'){
    res.status(415).send('Server only accepts application/json data.');
  } else {
    var space = parseInt(req.body.space, 10);
    var type = req.body.type;
    var arrival_date = null;
    var current_car = null;
    if ((typeof space === 'undefined' || space === null) || (typeof type === 'undefined' || type === null))
    {
      res.status(400).send('Missing parameter. Check documentation');
    } else {
      const query = datastore.createQuery(PARKING).filter('space', '=', space);
      datastore.runQuery(query)
      .then ( (result) => {
        if ( result[0].length == 0) {
          var request = {
            space: space,
            type: type,
            arrival_date: arrival_date,
            current_car: current_car,
          };
          dm.createEntity(PARKING, request)
          .then( (result) => {
            res.location(req.protocol + "://" + req.get('host') + req.baseUrl + '/' + result.key.id);
            var response = {
              id: result.key.id
            };
            res.status(201).json(response);
          })
          .catch( (error) => {
            console.log(error);
            res.status(500).end();
          });
        } else {
          res.status(400).end();
        }
      })
      .catch( (error) => {
        console.log(error);
        res.status(500).end();
      });
    }
  }
});

// PUT a list of all parking
router.put('/', checkJwt, (req, res, next) => {
  res.set('Accept', 'GET, POST');
  res.status(405).end();
});

// DELETE a list of all parking
router.delete('/', checkJwt, (req, res, next) => {
  res.set('Accept', 'GET, POST');
  res.status(405).end();
});

// GET a specific parking space based on provided ID
router.get('/:id', checkJwt, (req, res, next) => {
    const accept = req.accepts('json');
    if(accept) {
        const spaces = dm.getEntity(PARKING, req, req.params.id)
        .then( (parking) => {
            res.status(200).json(parking);
        })
        .catch( (error) => {
            console.log(error);
            res.status(404).end();
        });
    } else {
        res.status(406).send('Server only accepts application/json data.');
    }
});

// PUT update an existing parking space given a parking id
router.put('/:id', checkJwt, (req, res, next) => {
    if(req.get('content-type') !== 'application/json'){
        res.status(415).send('Server only accepts application/json data.');
    } else {
        const space = dm.getEntity(PARKING, req, req.params.id)
        .then( (parking) => {
            var space = req.body.space || parking.space;
            var type = req.body.type || parking.type;
            var arrival_date = parking.arrival_date;
            var current_car = parking.current_car;
            var request = {
                space: parseInt(space, 10),
                type: type,
                arrival_date: arrival_date,
                current_car: current_car,
            };
            dm.updateEntity(PARKING, req.params.id, request)
            .then( (entity) => {
                res.location(req.protocol + "://" + req.get('host') + req.baseUrl + '/' + req.params.id);
                res.status(303).end();
            })
            .catch( (error) => {
                console.log(error);
                res.status(500).end();
            });
        })
        .catch( (error) => {
            console.log(error);
            res.status(404).send("Parking space not found.");
        });
    }
});

// DELETE a parkiong space from the datastore
router.delete('/:id', checkJwt, (req, res, next) => {
  const space = dm.getEntity(PARKING, req, req.params.id)
  .then( (parking) => {
    if(parking.current_car !== null) {
      res.status(403).send('Forbidden: Car must be removed from parking space first.');
    } else { 
      dm.deleteEntity(PARKING, req.params.id)
      .then( (result) => {
        res.status(204).end();
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

// PUT assign a car to a parking space
router.put('/:pid/cars/:cid', checkJwt, (req, res, next) => {
  const query = datastore.createQuery(PARKING).filter('current_car', '=', parseInt(req.params.cid,10));
  datastore.runQuery(query).then( (result) => {
    if ( result[0].length == 0) {
      const cars = dm.getEntity(CARS, req, req.params.cid)
      .then( (car) => {
        if(car.owner && car.owner !== req.user.name) {
          res.status(401).send('You are not authorized to move this car.');
        } else {
          const space = dm.getEntity(PARKING, req, req.params.pid)
          .then( (parking) => {
            if(parking.current_car !== null) {
              res.status(403).send('Parking space is already assigned a car.');
            } else {
              var today = new Date();
              var date = today.getFullYear() + '-' + (today.getMonth()+1) + '-' + today.getDate();
              var parkingRequest = {
                space: parseInt(parking.space, 10),
                type: parking.type,
                arrival_date: date,
                current_car: parseInt(req.params.cid, 10)
              }
              dm.updateEntity(PARKING, req.params.pid, parkingRequest)
              .then( (entity) => {
                res.location(req.protocol + "://" + req.get('host') + '/parking/' + req.params.pid);
                res.status(303).end();
              })
              .catch( (error) => {
                console.log(error);
                res.status(500).end();
              });
            }
          })
          .catch( (error) => {
            console.log(error);
            res.status(404).send('Parking not found');
          });
        }
      })
      .catch( (error) => {
        console.log(error);
        res.status(404).send('Car not found');
      });
    } else {
      res.status(403).send('Car is already assigned to a parking space')
    }
  });  
});

// DELETE Remove car from parking space
router.delete('/:pid/cars/:cid', checkJwt, (req, res, next) => {
  const space = dm.getEntity(PARKING, req, req.params.pid)
  .then( (parking) => {
    if (parking.current_car != null) {
      if(parking.current_car == req.params.cid) {
        var parkingRequest = {
          space: parseInt(parking.space, 10),
          type: parking.type,
          arrival_date: null,
          current_car: null
        }
        dm.updateEntity(PARKING, req.params.pid, parkingRequest)
        .then( (entity) => {
          res.location(req.protocol + "://" + req.get('host') + '/parking/' + req.params.pid);
          res.status(204).end();
        })
        .catch( (error) => {
          console.log(error);
          res.status(500).end();
        });
      } else {
        res.status(403).send('Parking space is not assigned to this car');
      }
    } else {
      res.status(403).send('Parking space is not assigned to a car');
    }
  })
  .catch( (error) => {
    console.log(error);
    res.status(404).send('Parking space not found');
  })
});



module.exports = router;