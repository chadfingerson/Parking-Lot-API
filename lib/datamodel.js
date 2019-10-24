const ds = require('./datastore.js');
const datastore = ds.datastore;

module.exports.createEntity = function createEntity(kind, obj) {
  const key = datastore.key(kind);
  const entity = {
    key: key,
    data: ds.toDatastore(obj),
  };

  return datastore.insert(entity).then(() => {
    return entity;
  });
}

module.exports.updateEntity = async function updateEntity(kind, id, obj) {
  const key = datastore.key([kind, parseInt(id, 10)]);
  const entity = {
    key: key,
    data: ds.toDatastore(obj),
  };

  return await datastore.update(entity).then(() => {
    return entity;
  });
}

module.exports.getEntity = async function getEntity(kind, req, id) {
  const key = datastore.key([kind, parseInt(id,10)]);
  return await datastore.get(key).then( (entities) => {
    result = entities.map(ds.fromDatastore);
    result[0].self = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + id;
    return result[0];
  });
}

module.exports.getEntityByOwner = async function getEntityByOwner(kind, req, owner) {
  const query = datastore.createQuery(kind);
  const results = {};
  return datastore.runQuery(query).then( (entities) => {
    results.items = entities[0].map(ds.fromDatastore).filter( item => item.owner === owner);
    for (i = 0; i < results.items.length; i++) {
      results.items[i].self = req.protocol + "://" + req.get("host") + "/cars/" + results.items[i].id;
    }
    return results;
  })
  .catch((error) => {
    console.log(error);
    return null;
  });
}

module.exports.getEntityList = function getEntityList (kind, req) {
  var query = datastore.createQuery(kind).limit(5);
  const results = {};
  if(Object.keys(req.query).includes("cursor")) {
    query = query.start(req.query.cursor);
  }
  return datastore.runQuery(query).then( (entities) => {
    results.items = entities[0].map(ds.fromDatastore);
    results.length = entities[0].length;
    for (i = 0; i < results.items.length; i++) {
      results.items[i].self = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + results.items[i].id;
    }
    if(entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS) {
      results.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + entities[1].endCursor;
    }
    return results;
  })
  .catch((error) => {
    console.log(error);
    return null;
  });
}

module.exports.deleteEntity = function deleteEntity(kind, id) {
  const key = datastore.key([kind, parseInt(id,10)]);
  return datastore.delete(key);
}