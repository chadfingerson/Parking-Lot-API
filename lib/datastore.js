const {Datastore} = require('@google-cloud/datastore');
const projectId = 'fingersfinal';

module.exports.Datastore = Datastore;
module.exports.datastore = new Datastore();

module.exports.toDatastore = function toDatastore(obj) {
    const results = [];
    Object.keys(obj).forEach(k => {
        if (obj[k] === undefined) {
        return;
        }
        results.push({
        name: k,
        value: obj[k]
        });
    });
    return results;
}

module.exports.fromDatastore = function fromDatastore(item) {
    item.id = item[Datastore.KEY].id;
    return item;
}
