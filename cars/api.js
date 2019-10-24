const express = require('express');
const bodyParser = require('body-parser');
const ds = require('../lib/datastore.js');
const dm = require('../lib/datamodel.js');
const json2html = require('node-json2html');
const datastore = ds.datastore;

var dotenv = require('dotenv');
dotenv.config();

const router = express.Router();
router.use(bodyParser.json());

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

const CARS = 'Cars';
const PARKING = 'Parking';

// GET a list of all cars
router.get('/', checkJwt, (req, res, next) => {
  const accepts = req.accepts('json');
  if(accepts) {
    const cars = dm.getEntityList(CARS, req)
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

// POST a new car 
router.post('/', checkJwt, (req, res, next) => {
  if(req.get('content-type') !== 'application/json'){
    res.status(415).send('Server only accepts application/json data.');
  } else {
    var make = req.body.make;
    var model = req.body.model;
    var year = parseInt(req.body.year, 10);
    var license = req.body.license;
    var owner = req.user.name;
    if ((typeof make === 'undefined' || make === null) || (typeof model === 'undefined' || model === null)
      || (typeof year === 'undefined' || year === null) || (typeof license === 'undefined' || license === null)
      || (typeof owner === 'undefined' || owner === null))
    {
      res.status(400).send('Missing parameter. Check documentation');
    } else {
      const query = datastore.createQuery(CARS).filter('license', '=', license);
      datastore.runQuery(query)
      .then ( (result) => {
        if ( result[0].length == 0) {
          var request = {
            make: make,
            model: model,
            year: year,
            license: license,
            owner: req.user.name
          };
          dm.createEntity(CARS, request)
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

// PUT a list of all cars
router.put('/', checkJwt, (req, res, next) => {
  res.set('Accept', 'GET, POST');
  res.status(405).end();
});

// DELETE a list of all cars
router.delete('/', checkJwt, (req, res, next) => {
  res.set('Accept', 'GET, POST');
  res.status(405).end();
});

// GET a specific car based on provided ID
router.get('/:id', checkJwt, (req, res, next) => {
  const accepts = req.accepts('json');
  console.log(accepts);
  if(accepts) {
    const cars = dm.getEntity(CARS, req, req.params.id)
    .then( (car) => {
      if(car.owner && car.owner !== req.user.name) {
        res.status(403).send('Forbidden');
      } else {
        res.status(200).json(car);
      }
    })
    .catch( (error) => {
      res.status(404).end();
    });
  } else {
    res.status(406).send('Server only accepts application/json data.');
  }
});

// PUT update an existing car given a car id
router.put('/:id', checkJwt, (req, res, next) => {
  if(req.get('content-type') !== 'application/json'){
    res.status(415).send('Server only accepts application/json data.');
  } else {
    const cars = dm.getEntity(CARS, req, req.params.id)
    .then( (car) => {
      if(car.owner && car.owner !== req.user.name) {
        res.status(403).send('Forbidden');
      } else {
        var make = req.body.make || car.make;
        var model = req.body.model || car.model;
        var license = req.body.license || car.license;
        var year = req.body.year || car.year;
        var owner = car.owner;
        var request = {
          make: make,
          model: model,
          license: license,
          year: year,
          owner: owner
        };
        dm.updateEntity(CARS, req.params.id, request)
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
      res.status(404).end('Car not found');
    });
  }
});

// DELETE a car from the datastore
router.delete('/:id', checkJwt, (req, res, next) => {
  const cars = dm.getEntity(CARS, req, req.params.id)
  .then( (car) => {
    if(car.owner && car.owner !== req.user.name) {
      res.status(403).send('Forbidden');
    } else { 
      dm.deleteEntity(CARS, req.params.id)
      .then( (result) => {
        const query = datastore.createQuery(PARKING).filter('current_car', '=', parseInt(req.params.cid,10));
        datastore.runQuery(query).then( (result) => {
          if ( result[0].length == 0) {
            console.log("I got here from delete car");
            res.status(204).end();
          } else {
            var parkingRequest = {
              space: parseInt(result[0].space, 10),
              type: result[0].type,
              arrival_date: null,
              current_car: null
            };
          dm.updateEntity(PARKING, req.params.pid, parkingRequest)
          .then( (entity) => {
            res.status(204).end();
          })
          .catch( (error) => {
            console.log(error);
            res.status(500).end();
          });
        }});
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
})

module.exports = router;