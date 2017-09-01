// Copyright IBM Corp. 2012,2016. All Rights Reserved.
// Node module: loopback-connector-arangojs
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT
// http://loopback.io/doc/en/lb3/Building-a-connector.html

var g = require('strong-globalize')();
var arangojs = require('arangojs');
var util = require('util');
var arangodbUtils = require('./arangodb-utils');
var async = require('async');
var merge = require('merge');
var uuidv1 = require('uuid/v1');
var uuidv4 = require('uuid/v4');
var guid = require('guid');
var sha256 = require('sha256');

var Connector = require('loopback-connector').Connector;
var GeoPoint = require('loopback-datasource-juggler').GeoPoint;

var debug = require('debug')('loopback:connector:arangodb');

/**
 * --------------------------------------------------------------------------------------------------------------------
 * Class
 * --------------------------------------------------------------------------------------------------------------------
 */
exports.generateArangoDBURL = generateArangoDBURL;

function generateArangoDBURL(options) {
    options.hostname = (options.hostname || options.host || '127.0.0.1');
    options.port = (options.port || 8529);
    options.database = (options.database || options.db || 'test');
    var username = options.username || options.user;
    if (username && options.password) {
        return 'http://' + username + ':' + options.password + '@' + options.hostname + ':' + options.port + '/_db/' + options.database;
    } else {
        return 'http://' + options.hostname + ':' + options.port + '/_db/' + options.database;
    }
}

exports.initialize = function initializeDataSource(dataSource, callback) {
    if (!arangojs) {
        return;
    }

    var s = dataSource.settings;

    debug('Initialize: %j', s);

    s.safe = (s.safe !== false);
    s.w = s.w || 1;
    s.url = s.url || generateArangoDBURL(s);
    dataSource.connector = new ArangoDB(s, dataSource);

    if (callback) {
        if (s.lazyConnect) {
            debug('Lazy Connect');
            process.nextTick(function() {
                callback();
            });
        } else {
            debug('NOT Lazy Connect');
            dataSource.connector.connect(callback);
        }
    }
};

exports.ArangoDB = ArangoDB;

function ArangoDB(settings, dataSource) {
    Connector.call(this, 'arangojs', settings);

    this.debug = settings.debug || debug.enabled;

    if (this.debug) {
        debug('Settings: %j', settings);
    }

    this.dataSource = dataSource;
}

util.inherits(ArangoDB, Connector);

ArangoDB.prototype.getTypes = function() {
    return ['db', 'nosql', 'arangodb'];
};

/**
 * --------------------------------------------------------------------------------------------------------------------
 * Boot methods
 * --------------------------------------------------------------------------------------------------------------------
 */
ArangoDB.prototype.define = function(modelDefinition) {

    modelDefinition.settings = modelDefinition.settings || {};
    modelDefinition.settings.arangodb = modelDefinition.settings.arangodb || {};
    modelDefinition.settings.indexes = modelDefinition.settings.indexes || [];

    modelDefinition.settings.strict = (typeof modelDefinition.settings.strict !== 'undefined' ? modelDefinition.settings.strict : true);
    modelDefinition.settings.idInjection = true;

    if(modelDefinition.properties._key) throw new Error(g.f('{{ArangoDB}} property _key is reserved'));
    if(modelDefinition.properties._id) throw new Error(g.f('{{ArangoDB}} property _id is reserved'));
    if(modelDefinition.properties._rev) throw new Error(g.f('{{ArangoDB}} property _rev is reserved'));
    if(modelDefinition.properties._from) throw new Error(g.f('{{ArangoDB}} property _from is reserved'));
    if(modelDefinition.properties._to) throw new Error(g.f('{{ArangoDB}} property _to is reserved'));

    modelDefinition.columns = {};
    for(let i in modelDefinition.properties) {
        if(!modelDefinition.properties[i].arangodb) {
            modelDefinition.properties[i].arangodb = { column: i };
        }
        modelDefinition.columns[modelDefinition.properties[i].arangodb.column] = i;
    }

    if(!modelDefinition.columns._key) {
        modelDefinition.properties.key = {
            name: 'key',
            type: String,
            defaultFnID: modelDefinition.properties.key && modelDefinition.properties.key.defaultFn,
            id: true,
            arangodb: {column: '_key'}
        };
        modelDefinition.columns._key = 'key';
    } else {
        modelDefinition.properties[modelDefinition.columns._key] = merge(
            modelDefinition.properties[modelDefinition.columns._key], {
                name: modelDefinition.columns._key,
                type: String,
                defaultFnID: modelDefinition.properties.key && modelDefinition.properties.key.defaultFn,
                id: true,
                arangodb: {column: '_key'}
            }
        );
    }

    if(modelDefinition.columns._id) {
        modelDefinition.properties[modelDefinition.columns._id] = {
            name: modelDefinition.columns._id,
            type: String,
            arangodb: {column: '_id'}
        };
    }

    if(modelDefinition.columns._rev) {
        modelDefinition.properties[modelDefinition.columns._rev] = {
            name: modelDefinition.columns._rev,
            type: String,
            arangodb: {column: '_rev'}
        };
    }

    if(modelDefinition.settings.arangodb.type === 'edge') {

        if(!modelDefinition.columns._from) {
            modelDefinition.properties.from = {
                name: 'from',
                type: String,
                arangodb: {column: '_from'}
            };
            modelDefinition.columns._from = 'from';
        } else {
            modelDefinition.properties[modelDefinition.columns._from] = {
                name: modelDefinition.columns._from,
                type: String,
                arangodb: {column: '_from'}
            };
        }

        if(!modelDefinition.columns._to) {
            modelDefinition.properties.to = {
                name: 'to',
                type: String,
                arangodb: {column: '_to'}
            };
            modelDefinition.columns._to = 'to';
        } else {
            modelDefinition.properties[modelDefinition.columns._to] = {
                name: modelDefinition.columns._to,
                type: String,
                arangodb: {column: '_to'}
            };
        }

        // This index should not be created, it will be used in future features to optimize queries
        modelDefinition.settings.indexes.push(
            {
                fields: [modelDefinition.columns._from, modelDefinition.columns._to],
                unique: false,
                type: "edge",
                sparse: false,
                deduplicate: true,
                doNotCreate: true
            }
        );

    }

    //console.log(modelDefinition.settings);

    //if(modelDefinition.settings.arangodb.collection == 'UserLikePostAutoId') console.log(modelDefinition.properties);

    this._models[modelDefinition.model.modelName] = modelDefinition;
};

ArangoDB.prototype.defineProperty = function(model, propertyName, propertyDefinition) {
    var modelDef = this.getModelDefinition(model);
    modelDef.properties[propertyName] = propertyDefinition;
};

/**
 * --------------------------------------------------------------------------------------------------------------------
 * Connection methods
 * --------------------------------------------------------------------------------------------------------------------
 */
ArangoDB.prototype.connect = function(callback) {
    var self = this;
    if (self.db) {
        process.nextTick(function() {
            callback && callback(null, self.db);
        });
    } else if (self.dataSource.connecting) {
        self.dataSource.once('connected', function() {
            process.nextTick(function() {
                callback && callback(null, self.db);
            });
        });
    } else {
        debug('Connecting to ArangoDB using: ' + self.settings.url);

        var db = new arangojs.Database({
            url: self.settings.url,
            databaseName: false,
            promise: self.settings.promise || false
        });

        // Get DB info to test connection
        db.get(function(err, info) {
            if(err) {
                //g.error('{{ArangoDB}} connection is failed: %s %s', self.settings.url, err);
                return callback(err, null);
            }

            debug('ArangoDB connection is established: %j', info);
            self.db = db;
            callback(null, db);

        });
    }
};

ArangoDB.prototype.ping = function(cb) {
    var self = this;
    if (self.db) {
        self.db.get(function(err, info) {
            if(err) {
                //g.error('{{ArangoDB}} connection is failed: %s %s', self.settings.url, err);
                return cb(err, null);
            }

            debug('ArangoDB connection is established: %j', info);

            cb(null, true);

        });
    } else {
        self.dataSource.once('connected', function() {
            self.ping(cb);
        });
        self.dataSource.once('error', function(err) {
            cb(err);
        });
        self.connect(function() {});
    }
};

ArangoDB.prototype.disconnect = function(cb) {
    if (this.debug) {
        debug('disconnect');
    }
    if (this.db) {
        this.db = null;
    }
    if (cb) {
        process.nextTick(cb);
    }
};

/**
 * --------------------------------------------------------------------------------------------------------------------
 * Structure methods
 * --------------------------------------------------------------------------------------------------------------------
 */
ArangoDB.prototype.autoupdate = function(model, cb) {
    var self = this;

    modelObject = this._models[model];
    let indexes = modelObject.settings.indexes;

    async.each(indexes, function(index, indexCallback) {

        if(index.doNotCreate) return indexCallback();

        self.collection(model).createIndex(index, function(err, created) {

            if(err) {
                return indexCallback(err.response.body);
            }

            indexCallback();

        });

    }, function(err) {
        if(err) return cb(err);

        cb();
    });

};

ArangoDB.prototype.automigrate = function(models, cb) {
    var self = this;
    if (self.db) {

        debug('automigrate');

        if ((!cb) && ('function' === typeof models)) {
            cb = models;
            models = undefined;
        }

        // First argument is a model name
        if ('string' === typeof models) {
            models = [models];
        }

        models = models || Object.keys(self._models);

        // Make it serial as multiple models might map to the same collection
        async.eachSeries(models, function(model, modelCallback) {

            debug('drop model %s', model);

            debug('Properties: %j', self._models[model]);

            self.collection(model).drop(function(err, drop) {

                if(err) {
                    debug('Drop WARNING: %j', err.response.body);
                }

                debug('Dropped: %j', drop);

                let getArangoDBSettings = self.getArangoDBSettings(model);

                debug('Creating %s with Settings: %j', model, getArangoDBSettings);

                self.collection(model).create(getArangoDBSettings, function(err, create) {

                    if(err) {
                        debug('Create ERROR: %j', err.response.body);
                        return modelCallback(err.response.body);
                    }

                    debug('Created: %j', create);

                    self.collection(model).load(false);

                    self.autoupdate(model, function(err, indexes) {
                        if (err) {
                            return modelCallback(err);
                        }

                        debug('Index created: %j', create);

                        modelCallback();
                    });

                });

            });

        }, function(err) {
            if (err) {
                return cb && cb(err);
            }

            cb();

        });
    } else {
        self.dataSource.once('connected', function() {
            self.automigrate(models, cb);
        });
    }
};

ArangoDB.prototype.getArangoDBSettings = function (model) {

    if(!model) return {};

    return this._models[model].settings.arangodb;

};

ArangoDB.prototype.collectionName = function(model) {
    var settings = this.getArangoDBSettings(model);

    model = settings.collection || model;

    return model;
};

ArangoDB.prototype.collection = function(model) {
    if (!this.db) {
        throw new Error(g.f('{{ArangoDB}} connection is not established'));
    }
    var collectionName = this.collectionName(model);

    let settings = this.getArangoDBSettings(model);

    if(settings.type === 'edge') {
        return this.db.edgeCollection(collectionName);
    } else {
        return this.db.collection(collectionName);
    }
};

/**
 * The option list depends on witch method are you using
 * https://github.com/arangodb/arangojs
 * @param model
 * @param options
 */
ArangoDB.prototype.operationOptions = function(model, options) {

    let settings = this.getArangoDBSettings(model);

    let result = {};
    options = options || {}; // To avoid undefined error

    // All saving methods
    result.waitForSync = options.waitForSync || settings.waitForSync || false;

    //Save method
    result.returnNew = options.returnNew || settings.returnNew || false;
    result.silent = options.silent || settings.silent || false;

    // Replace method
    result.rev = options.rev || settings.rev || false;
    result.policy = options.policy || settings.policy || false;

    return result;

};

/**
 * --------------------------------------------------------------------------------------------------------------------
 * Translate methods
 * --------------------------------------------------------------------------------------------------------------------
 */
ArangoDB.prototype.fromDatabase = function(model, data) {
    if(!data) return null;

    //console.log('Before Data: %j', data);

    if(data.constructor === Array) {
        for (let i in data) {
            data[i] = this.fromDatabaseItem(model, data[i]);
        }
    } else {
        data = this.fromDatabaseItem(model, data);
    }

    //console.log('After Data: %j', data);

    return data;
};

ArangoDB.prototype.fromDatabaseItem = function(model, data) {
    if(!data) return null;

    let propName;
    let result = {};

    let modelObj = this._models[model];
    let neutral = ['_key', '_id', '_rev', '_oldRev'];

    for (let columnName in data) {
        if(typeof data[columnName] !== 'undefined') {
            propName = this.getModelColumnName(model, columnName);
            if (propName) result[propName] = this.revertTypeContent(model,propName, data[columnName]);
            else if(neutral.indexOf(columnName) === -1) result[columnName] = this.revertTypeContent(model,propName, data[columnName]);
        }
    }

    return result;
};

ArangoDB.prototype.toDatabase = function(model, data, newRow) {
    let keyProp = this.getPropertyDefinition(model, 'key');
    let defaultFn = keyProp && keyProp.defaultFnID;
    let settings = this._models[model].settings;

    if(data.constructor === Array) {
        for(let i in data) {
            data[i] = this.toDatabaseRow(model, data[i], defaultFn, settings, newRow);
        }

    } else {
        data = this.toDatabaseRow(model, data, defaultFn, settings, newRow);
    }

    return data;
};

ArangoDB.prototype.toDatabaseRow = function(model, data, defaultFn, settings, newRow) {
    if(!data) return null;

    let columnName;
    let result = {};

    let modelObj = this._models[model];

    if((settings.forceId || !data[this.getModelColumnName(model, '_key')]) && newRow === true) {
        if(!settings.arangodb.unique) data[this.getModelColumnName(model, '_key')] = this.getDefaultFnID(defaultFn);
        else data[this.getModelColumnName(model, '_key')] = sha256(data[this.getModelColumnName(model, '_from')] + data[this.getModelColumnName(model, '_to')]);
    }

    //delete data.id; // Must be delete, it's generated by ArangoDB

    for (let propName in data) {
        columnName = this.getDatabaseColumnName(model, propName);
        result[columnName] = data[propName] === null ? undefined : this.parseTypeContent(model, propName, data[propName]);
    }

    return result;
};

ArangoDB.prototype.parseTypeContent = function(model, propName, data) {
    let modelObj = this._models[model];
    let column = modelObj.properties[propName];

    if(!data || !column) return data;

    let columnType = column.type || String;
    let result;

    if(columnType === Date) {
        result = data.getTime();
    } else if(columnType === GeoPoint) {
        result = [data.lng,data.lat];
    } else {
        result = data;
    }

    return result;
};

ArangoDB.prototype.revertTypeContent = function(model, propName, data) {
    let modelObj = this._models[model];
    let column = modelObj.properties[propName];

    if(!data || !column) return data;

    let columnType = column.type || String;
    let result;

    if(columnType === Date) {
        result = new Date(data);
    } else if(columnType === GeoPoint) {
        result = new GeoPoint([data[1],data[0]]);
    } else {
        result = data;
    }

    return result;
};

ArangoDB.prototype.getDefaultFnID = function(defaultFn) {

    let id;

    switch(defaultFn) {
        case 'guid':
            id = guid.create();
            break;
        case 'uuid':
            id = uuidv1();
            break;
        case 'uuidv4':
            id = uuidv4();
            break;
        case 'now':
            id = (new Date()).toString();
            break;
    }

    return id;

};

ArangoDB.prototype.getDatabaseColumnName = function(model, propName) {
    model = this._models[model];

    let prop = model.properties[propName];

    if(!prop)
        return propName;
    else if (prop.arangodb)
        propName = prop.arangodb.columnName || prop.arangodb.column || propName;

    return propName;
};

ArangoDB.prototype.getPropertyType = function(model, propName) {

    return this._models[model].properties[propName].type || String;

};

ArangoDB.prototype.getPropertyDefault = function(model, propName) {

    return this._models[model].properties[propName].default;

};

ArangoDB.prototype.getModelColumnName = function(model, columnName) {
    model = this._models[model];

    return model.columns[columnName];
};

ArangoDB.prototype.convertColumnNames = function(model, data, direction) {
    if (typeof data !== 'object') {
        return data; // skip
    }

    if (typeof model === 'string') {
        model = this._models[model];
    }

    if (typeof model !== 'object') {
        return data; // unknown model type?
    }

    if (typeof model.properties !== 'object') {
        return data; // missing model properties?
    }

    for (var propName in model.properties) {
        var columnName = this.getDatabaseColumnName(model, propName);

        // Copy keys/data if needed
        if (propName === columnName) {
            continue;
        }

        if (direction === 'database') {
            data[columnName] = data[propName];
            delete data[propName];
        }

        if (direction === 'property') {
            data[propName] = data[columnName];
            delete data[columnName];
        }
    }

    return data;
};

ArangoDB.prototype.getDatabaseColumns = function(model) {
    model = this._models[model];

    let result = [];

    for (var propName in model.properties) {

        if (model.properties[propName].arangodb && model.properties[propName].arangodb.columnName)
            result.push(model.properties[propName].arangodb.columnName);
        else
            result.push(propName);

    }

    return result;
};

/**
 * --------------------------------------------------------------------------------------------------------------------
 * Query methods
 * --------------------------------------------------------------------------------------------------------------------
 */
ArangoDB.prototype.buildFilter = function(model, where) {
    var self = this;
    let collectionName = self.collectionName(model);

    if(!where) return null;

    debug('Where: %j', where);

    let result = this.buildRecursiveFilter(model, collectionName + '_', where);
    result.result = result.result.join(' && ');

    debug('Filter: %j', result);

    return result;

};

ArangoDB.prototype.buildRecursiveFilter = function(model, prefix, where, preField, paramsCount) {
    var self = this;
    let result = [];
    let params = {};
    let sub, query;

    debug('paramsCount: %j', paramsCount);

    paramsCount = paramsCount || 0;

    preField = prefix + '.' + self.getDatabaseColumnName(model, preField);

    for(let i in where) {

        debug('Key: %j', i);
        debug('PreField: %j', preField);

        switch(i) {
            case 'and':
                sub = self.buildRecursiveFilter(model, prefix, where[i], i, paramsCount);
                result.push('(' + sub.result.join(' && ') + ')');
                params = merge(params, sub.params);
                paramsCount = sub.paramsCount;
                break;
            case 'or':
                sub = self.buildRecursiveFilter(model, prefix, where[i], i, paramsCount);
                result.push('(' + sub.result.join(' || ') + ')');
                params = merge(params, sub.params);
                paramsCount = sub.paramsCount;
                break;
            case 'gt':
                result.push(preField + ' > @p' + ++paramsCount);
                params['p'+paramsCount] = Number(where[i]);
                break;
            case 'gte':
                result.push(preField + ' >= @p' + ++paramsCount);
                params['p'+paramsCount] = Number(where[i]);
                break;
            case 'lt':
                result.push(preField + ' < @p' + ++paramsCount);
                params['p'+paramsCount] = Number(where[i]);
                break;
            case 'lte':
                result.push(preField + ' <= @p' + ++paramsCount);
                params['p'+paramsCount] = Number(where[i]);
                break;
            case 'between':
                query = '(' + preField + ' >= @p' + ++paramsCount;
                params['p'+paramsCount] = Number(where[i][0]);
                query += ' && ' + preField + ' <= @p' + ++paramsCount + ')';
                params['p'+paramsCount] = Number(where[i][1]);
                result.push(query);
                break;
            case 'inq':
                result.push(preField + ' IN @p' + ++paramsCount);
                params['p'+paramsCount] = where[i];
                break;
            case 'nin':
                result.push(preField + ' NOT IN @p' + ++paramsCount);
                params['p'+paramsCount] = where[i];
                break;
            case 'neq':
                result.push(preField + ' != @p' + ++paramsCount);
                params['p'+paramsCount] = where[i];
                break;
            case 'like':
                result.push(preField + ' LIKE @p' + ++paramsCount);
                params['p'+paramsCount] = where[i];
                break;
            case 'nlike':
                result.push(' NOT LIKE(' + preField + ', @p' + ++paramsCount + ')');
                params['p'+paramsCount] = where[i];
                break;
            case 'ilike':
                throw new Error(g.f('{{ArangoDB}} ILIKE operator not supported'));
                break;
            case 'nilike':
                throw new Error(g.f('{{ArangoDB}} NILIKE operator not supported'));
                break;
            case 'regexp':
                if(typeof where[i] === 'object') where[i] = where[i].toString().slice(1, -1);
                result.push(preField + ' =~ @p' + ++paramsCount);
                params['p'+paramsCount] = where[i];
                break;
            case 'near':
                // GEO is processed in buildIn()
                break;
            default:
                if(typeof i === 'string' && typeof where[i] !== 'object') {

                    let field = self.getDatabaseColumnName(model, i);
                    result.push(prefix + '.' + field + ' == @p' + ++paramsCount);
                    params['p'+paramsCount] = where[i];

                } else if(typeof where[i] === 'object') {

                    sub = self.buildRecursiveFilter(model, prefix, where[i], i, paramsCount);
                    result.push(sub.result);
                    params = merge(params, sub.params);
                    paramsCount = sub.paramsCount;

                } else {
                    debug('NO OPTION');
                }

        }

    }

    debug('Params: %j', params);

    return { result: result, params: params, paramsCount: paramsCount };
};

ArangoDB.prototype.buildIn = function(model, where) {

    var self = this;
    let collection = self.collectionName(model);
    let result;

    let near = findNearFilter(where);

    if(near) {
        near.unit = near.unit || 'meters';
        result = 'WITHIN(' + collection + ', ' + near.location.lat + ', ' + near.location.lng + ', ' + convertToMeters(near.distance, near.unit) + ', "' + near.unit + '")';
    } else {
        result = collection;
    }

    return result;

};

ArangoDB.prototype.buildSort = function(model, order) {
    var self = this;
    let result = [];
    let item;
    let forPrefix = self.collectionName(model) + '_';

    if(!order) return null;
    if(order.constructor !== Array) order = [order];

    for(let i in order) {
        item = order[i].split(' ');

        item[0] = self.getDatabaseColumnName(model, item[0]);

        result.push(forPrefix + '.' + item[0] + ' ' + item[1]);
    }

    return result.join(', ');
};

ArangoDB.prototype.buildLimit = function(model, offset, limit) {
    if(!limit) return null;

    offset = (offset?Number(offset):0);
    limit = Number(limit);
    //limit = (limit?Number(limit):100);

    if(limit < offset) return null;

    return offset + ',' + limit;
};

ArangoDB.prototype.buildCollect = function(model, collect) {
    if(!collect) return null;

    if(collect.constructor === Array) return collect.join(' '); //TODO threat different types of Collect params
    else return collect;
};

ArangoDB.prototype.buildReturn = function(model, fields) {
    var self = this;
    let fieldName;
    let result = [];
    let forPrefix = self.collectionName(model) + '_';

    if(!fields) return forPrefix;
    if(fields.constructor !== Array) fields = [fields];

    for(let i in fields) {
        if(fields[i] !== 'count_') {
            fieldName = self.getDatabaseColumnName(model, fields[i]);
            result.push(fieldName + ':' + forPrefix + '.' + fieldName);
        } else {
            result.push('count: count_');
        }
    }

    if(result.length > 0) return '{' + result.join(', ') + '}';
    else if(fields.length === 0) return fields[0];
    else throw new Error(g.f('{{ArangoDB}} RETURN params invalid'));
};

ArangoDB.prototype.buildQuery = function(model, query) {
    var self = this;
    let result = [];

    debug('buildQuery: %j', query);

    result.push('FOR ' + query.for);
    result.push('IN ' + query.in);

    if(query.filter && query.filter.result) result.push('FILTER ' + query.filter.result);
    if(query.collect) result.push('COLLECT ' + query.collect);
    if(query.sort) result.push('SORT ' + query.sort);
    if(query.limit && !query.collect) result.push('LIMIT ' + query.limit);

    if(!query.update) result.push('RETURN ' + query.return);
    else {
        result.push('UPDATE ' + query.for + ' WITH ' + query.update.result + ' IN ' + query.in);
        result.push('RETURN NEW');
    }

    let params = merge(
        query.filter && query.filter.params || {},
        query.update && query.update.params || {},
        query.in && query.in.params || {}
    );

    return { string: result.join(' '), params: params };
};

ArangoDB.prototype.buildUpdate = function(model, data) {

    if(!data) return null;
    let result = [];
    let params = {};
    let paramsCount = 0;

    for(let i in data) {
        result.push(this.getDatabaseColumnName(model, i) + ': @u' + ++paramsCount);
        params['u'+paramsCount] = data[i] || this.getPropertyDefault(model, i) || this.getPropertyType(model, i).prototype || null;
    }

    return { result: '{' + result.join(', ') + '}', params: params };

};

ArangoDB.prototype.buildQueryString = function(model, filter, data, callback) {

    var self = this;
    let collectionName = self.collectionName(model);
    let query = {
        for: collectionName + '_',
        in: null,
        filter: null,
        collect: null,
        update: null,
        sort: null,
        limit: null,
        return: null
    };

    async.parallel([
        function(cb) {
            query.in = self.buildIn(model, filter.where);
            cb();
        },
        function(cb) {
            query.filter = self.buildFilter(model, filter.where);
            cb();
        },
        function(cb) {
            query.sort = self.buildSort(model, filter.order);
            cb();
        },
        function(cb) {
            query.limit = self.buildLimit(model, filter.skip, filter.limit);
            cb();
        },
        function(cb) {
            query.return = self.buildReturn(model, filter.fields);
            cb();
        },
        function(cb) {
            query.update = self.buildUpdate(model, data);
            cb();
        },
        function(cb) {
            query.collect = self.buildCollect(model, filter.collect);
            cb();
        }
    ], function(err) {

        if (err) return callback(err);

        debug('PRE QUERY: %j', query);

        query = self.buildQuery(model, query);

        debug('POS QUERY: %j', query);

        callback(null, query);

    });

};

/**
 * --------------------------------------------------------------------------------------------------------------------
 * CRUD methods
 * --------------------------------------------------------------------------------------------------------------------
 */
ArangoDB.prototype.executeAQL = function(query, params, options, callback) {
    var self = this;

    self.aqlParser(query, params, function(err, aql) {

        if(err) return callback(err);
        if(!aql) return callback('Invalid AQL');
        if(!aql.query) return callback('Invalid AQL Query');

        self.db.query(aql.query, (aql.params || undefined), function(err, cursor) {

            if(err) {
                debug('AQL ERROR: %j', err.response.body);
                return callback(err.response.body);
            }

            if(!cursor) return callback();

            if(options && options.return === 'cursor') return callback(null, cursor);

            cursor.all(function(err, result) {

                if(err) {
                    debug('AQL cursor ERROR: %j', err.response.body);
                    return callback(err.response.body);
                }

                debug('AFTER RESULT: %j', result);

                callback(null, result);

            });

        });

    });

};

ArangoDB.prototype.aqlParser = function(query, params, callback) {

    if(!params) return callback(null, { query: query, params: null });

    let paramsResult = {};
    let paramsCount = 0;
    let paramsObjectSize, queryParts, queryTags, tag;

    if(params.constructor === Array) {

        queryParts = query.split('?');

        if(queryParts.length - 1 != params.length) return callback('Params length does not match (' + queryParts.length + ', ' + params.length + ')');

        for(let i in queryParts) {

            if(params[paramsCount]) {
                queryParts[i] = queryParts[i].trim() + '@p' + paramsCount;
                paramsResult['p' + paramsCount] = params[paramsCount];
                paramsCount++;
            }

        }

        return callback(null, { query: queryParts.join(' '), params: paramsResult });

    } else if(params.constructor === Object) {

        queryTags = query.match(/@\w*/g);
        paramsObjectSize = Object.keys(params).length;

        if(queryTags.length != paramsObjectSize) return callback('Params length does not match (' + queryTags.length + ', ' + paramsObjectSize + ')');

        for(let i in queryTags) {
            tag = queryTags[i].slice(1);
            if(!params[tag]) return callback('Param not found (' + tag + ')');
        }

        callback(null, { query: query, params: params });

    } else {
        callback('Invalid params type, must be Array or Object');
    }

};

ArangoDB.prototype.all = function all(model, filter, callback) {
    debug('F: ALL');
    debug('Filter: %j', filter);

    var self = this;

    self.buildQueryString(model, filter, null, function(err, query) {

        self.db.query(query.string, (query.params || undefined), function(err, cursor) {

            if(err) {
                debug('All ERROR: %j', err.response.body);
                return callback(err.response.body);
            }

            if(!cursor) return callback();

            cursor.all(function(err, result) {

                if(err) {
                    debug('All cursor ERROR: %j', err.response.body);
                    return callback(err.response.body);
                }

                result = self.fromDatabase(model, result);

                debug('AFTER RESULT: %j', result);

                callback(null, result);

            });

        });

    });

};

ArangoDB.prototype.create = function(model, data, options, callback) {
    var self = this;

    if(options.constructor === Function) {
        callback = options;
        options = undefined;
    }

    if(arangodbUtils.isEmpty(data)) return callback('Data is required', null);

    data = self.toDatabase(model, data, true);

    var full = options.full;
    options = self.operationOptions(model, options);

    let type = self.getArangoDBSettings(model)['type'];

    if(type === 'edge') {
        self.collection(model).save(data, createCallback);
    } else {
        self.collection(model).save(data, options, createCallback);
    }

    function createCallback(err, doc) {

        if(err) {
            debug('Document Create ERROR: %j', err.response.body);
            return callback(err.response.body);
        }

        if(full === true) callback(null, self.fromDatabase(model, doc));
        else callback(null, doc._key);

    }

};

ArangoDB.prototype.save = function(model, data, options, callback) {
    var self = this;

    if(options.constructor === Function) {
        callback = options;
        options = undefined;
    }

    if(arangodbUtils.isEmpty(data)) return callback('Data is required', null);

    if(!data.key && !data.id) return callback('key or id is required', null);

    data = self.toDatabase(model, data);

    options = self.operationOptions(model, options);

    self.collection(model).replace(data, data, options, function(err, doc) {

        if(err) {
            debug('Document Create ERROR: %j', err.response.body);
            return callback(err.response.body);
        }

        callback(null, self.fromDatabase(model, doc));

    });
};

ArangoDB.prototype.replaceOrCreate = function(model, data, options, callback) {
    var self = this;

    self.save(model, data, options, function(err, replaced) {
        if(err) {
            options.full = true;
            self.create(model, data, options, callback);
        } else {
            callback(null, replaced);
        }
    });

};

ArangoDB.prototype.replaceById = function(model, id, data, options, callback) {

    if(id.indexOf('/') == -1) data.key = id;
    else data.id = id;

    this.save(model, data, options, callback);

};

ArangoDB.prototype.updateOrCreate = function(model, data, options, callback) {
    var self = this;

    let id = data.key ? { key: data.key } : { id: data.id };

    options.returnValue = 'new';

    self.update(model, id, data, options, function(err, update) {
        if(err) {
            callback(err);
        } else if(update.length === 0) {
            self.create(model, data, options, callback);
        } else {
            callback(null, update && update[0]);
        }

    });

};

ArangoDB.prototype.update = ArangoDB.prototype.updateAll = function(model, where, data, options, callback) {
    let self = this;

    if(options.constructor === Function) {
        callback = options;
        options = undefined;
    }

    self.buildQueryString(model, { where: where }, self.toDatabase(model, data), function(err, query) {

        self.db.query(query.string, (query.params || undefined), { count: true }, function(err, cursor) {

            if(err) {
                debug('ERROR: %j', err.response.body);
                return callback(err.response.body);
            }

            if(options && options.returnValue === 'new') callback(null, self.fromDatabase(model, cursor && cursor._result || 0));
            else callback(null, cursor && cursor.count || 0);

        });

    });

};

ArangoDB.prototype.updateAttributes = function(model, id, data, options, callback) {

    this.update(model, { key: id }, data, options, callback);

};

ArangoDB.prototype.destroyAll = function(model, where, options, callback) {
    var self = this;

    if (!callback) {
        switch('function') {
            case typeof where:
                debug('destroyAll: NO where, NO options');
                callback = where;
                where = undefined;
                break;
            case typeof options:
                debug('destroyAll: NO options');
                callback = options;
                options = undefined;
                break;
            default:
                debug('destroyAll: ERROR');
                throw new Error(g.f('{{ArangoDB}} Callback not defined'));
        }
    }

    options = self.operationOptions(model, options);

    debug('destroyAll: %j, %j, %j', model, where, options);

    if(!arangodbUtils.isEmpty(where)) {

        debug('Truncate with WHERE: %j', where);

        self.all(model, { where: where, fields: ['key'] }, function(err, items) {

            var destroyCount = 0;

            async.each(items, function(item, cb){
                self.collection(model).removeByKeys([item.key], options, function(err, doc) {
                    if(err) {
                        debug('Document Destroy ERROR: %j', err.response.body);
                        return cb(err.response.body);
                    }

                    destroyCount++;

                    cb(null, true);
                });
            }, function(err) {
                if(err) {
                    debug('Destroy ERROR: %j', err.response.body);
                    return callback && callback(err.response.body, destroyCount);
                }

                callback(null, destroyCount);
            });

        });

    } else {

        debug('Truncate ALL');

        self.collection(model).truncate(function(err, truncate) {

            if(err) {
                debug('Truncate ERROR: %j', err.response.body);
                return callback && callback(err.response.body);
            }

            debug('Truncate: %j', truncate);

            callback && callback(null, { count: truncate });

        });

    }

};

ArangoDB.prototype.count = function(model, where, options, callback) {

    this.all(model, { where: where, fields: ['count_'], collect: 'WITH COUNT INTO count_' }, function(err, count) {
        if(err) {
            debug('Count ERROR: %j', err.response.body);
            return callback(err.response.body);
        }

        callback(null, count && count[0] && count[0].count);

    });

};

function convertToMeters(distance, unit) {
    switch (unit) {
        case 'meters':
            return distance;
        case 'kilometers':
            return distance * 1000;
        case 'miles':
            return distance * 1600;
        case 'feet':
            return distance * 0.3048;
        default:
            console.warn('unsupported unit ' + unit + ', valid units: meters, kilometers, miles, feet, default unit \'meters\'');
            return distance;
    }
}

function findNearFilter(where) {
    if (!where) return false;

    return searchForNear(where);

    function searchForNear(node) {
        if (!node) {
            return;
        }

        let response;
        for(let i in node) {
            if(i === 'near') return node[i];

            if(typeof node === 'object') {
                if(searchForNear(node[i])) {
                    return node[i];
                }
            }
        }

        return false;
    }

}















