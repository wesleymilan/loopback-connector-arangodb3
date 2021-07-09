'use strict';

// Copyright IBM Corp. 2012,2016. All Rights Reserved.
// Node module: loopback-connector-arangojs
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT
// http://loopback.io/doc/en/lb3/Building-a-connector.html

let g = require('strong-globalize')();
let arangojs = require('arangojs');
let util = require('util');
let arangodbUtils = require('./arangodb-utils');
let async = require('async');
let merge = require('merge');
let uuidv1 = require('uuid/v1');
let uuidv4 = require('uuid/v4');
let guid = require('guid');
let sha256 = require('sha256');

let Connector = require('loopback-connector').Connector;
let GeoPoint = require('loopback-datasource-juggler').GeoPoint;

let debug = require('debug')('loopback:connector:arangodb');

function ArangoDB(settings, dataSource) {

    Connector.call(this, 'arangojs', settings);

    this.debug = settings.debug || debug.enabled;

    if (this.debug) {
        debug('Settings: %j', settings);
    }

    this.dataSource = dataSource;
}

exports.ArangoDB = ArangoDB;

util.inherits(ArangoDB, Connector);

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
    if (!where) {
        return false;
    }

    function searchForNear(node) {
        if (!node) {
            return;
        }

        //let response;
        for(let i in node) {
            if(i === 'near') {
                return node[i];
            }

            if(typeof node === 'object') {
                if(searchForNear(node[i])) {
                    return node[i];
                }
            }
        }

        return false;
    }

    return searchForNear(where);

}

function getError(fnc, err, callback) {
    if(err && err.response && err.response.body) {
        debug('%s: %j', fnc, err.response.body);
        return callback(err.response.body);
    } else if(err && err.response) {
        debug('%s: %j', fnc, err.response);
        return callback(err.response);
    } else if(err) {
        debug('%s: %j', fnc, err);
        return callback(err);
    }
}

function generateArangoDBURL(options) {
    options.hostname = (options.hostname || options.host || '127.0.0.1');
    options.port = (options.port || 8529);
    options.database = (options.database || options.db || 'test');
    let username = options.username || options.user;
    if (username && options.password) {
        return 'http://' + username + ':' + options.password + '@' + options.hostname + ':' + options.port + '/_db/' + options.database;
    } else {
        return 'http://' + options.hostname + ':' + options.port + '/_db/' + options.database;
    }
}

exports.generateArangoDBURL = generateArangoDBURL;

exports.initialize = function initializeDataSource(dataSource, callback) {
    if (!arangojs) {
        return;
    }

    let s = dataSource.settings;

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

    if(modelDefinition.properties._key) {
        throw new Error(g.f('{{ArangoDB}} property _key is reserved'));
    }
    if(modelDefinition.properties._id) {
        throw new Error(g.f('{{ArangoDB}} property _id is reserved'));
    }
    if(modelDefinition.properties._rev) {
        throw new Error(g.f('{{ArangoDB}} property _rev is reserved'));
    }
    if(modelDefinition.properties._from) {
        throw new Error(g.f('{{ArangoDB}} property _from is reserved'));
    }
    if(modelDefinition.properties._to) {
        throw new Error(g.f('{{ArangoDB}} property _to is reserved'));
    }

    modelDefinition.ids = [];
    modelDefinition.columns = {};
    for(let i in modelDefinition.properties) {
        if(!modelDefinition.properties[i].arangodb) {
            modelDefinition.properties[i].arangodb = { column: i };
        }
        modelDefinition.columns[modelDefinition.properties[i].arangodb.column] = i;

        if(modelDefinition.properties[i].id) {
            modelDefinition.ids.push(i);
        }
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
                type: 'edge',
                sparse: false,
                deduplicate: true,
                doNotCreate: true
            }
        );

    }

    this._models[modelDefinition.model.modelName] = modelDefinition;
};

ArangoDB.prototype.defineProperty = function(model, propertyName, propertyDefinition) {
    let modelDef = this.getModelDefinition(model);
    modelDef.properties[propertyName] = propertyDefinition;
};

/**
 * --------------------------------------------------------------------------------------------------------------------
 * Connection methods
 * --------------------------------------------------------------------------------------------------------------------
 */
ArangoDB.prototype.connect = function(callback) {
    let self = this;
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

        let db = new arangojs.Database({
            url: self.settings.url,
            databaseName: false,
            promise: self.settings.promise || false
        });

        // Get DB info to test connection
        db.get(function(err, info) {
            if(err) {
                //g.error('{{ArangoDB}} connection is failed: %s %s', self.settings.url, err);
                return getError('Connect', err, callback);
            }

            debug('ArangoDB connection is established: %j', info);
            self.db = db;
            callback(null, db);

        });
    }
};

ArangoDB.prototype.ping = function(cb) {
    let self = this;
    if (self.db) {
        self.db.get(function(err, info) {
            if(err) {
                //g.error('{{ArangoDB}} connection is failed: %s %s', self.settings.url, err);
                return getError('Ping', err, cb);
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
ArangoDB.prototype.autoUpdate = function(model, cb) {
    let self = this;

    let modelObject = this._models[model];
    let indexes = modelObject.settings.indexes;

    async.each(indexes, function(index, indexCallback) {

        if(index.doNotCreate) {
            return indexCallback();
        }

        self.collection(model).createIndex(index, function(err) {

            if(err) {
                return indexCallback(err.response.body);
            }

            indexCallback();

        });

    }, function(err) {
        if(err) {
            return cb(err);
        }

        cb();
    });

};

ArangoDB.prototype.autoMigrate = function(models, cb) {
    let self = this;
    if (self.db) {

        debug('autoMigrate');

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
                    return getError('Drop WARNING', err, cb);
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

                    self.autoUpdate(model, function(err) {
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
            self.autoMigrate(models, cb);
        });
    }
};

ArangoDB.prototype.getArangoDBSettings = function (model) {

    if(!model) {
        return {};
    }

    return this._models[model].settings.arangodb;

};

ArangoDB.prototype.collectionName = function(model) {
    let settings = this.getArangoDBSettings(model);

    model = settings.collection || model;

    return model;
};

ArangoDB.prototype.collection = function(model) {
    if (!this.db) {
        throw new Error(g.f('{{ArangoDB}} connection is not established'));
    }
    let collectionName = this.collectionName(model);

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
    if(!data) {
        return null;
    }

    if(data.constructor === Array) {
        for (let i in data) {
            data[i] = this.fromDatabaseItem(model, data[i]);
        }
    } else {
        data = this.fromDatabaseItem(model, data);
    }

    return data;
};

ArangoDB.prototype.fromDatabaseItem = function(model, data) {
    if(!data) {
        return null;
    }

    let propName;
    let result = {};

    let neutral = ['_key', '_id', '_rev', '_oldRev'];

    for (let columnName in data) {
        if(typeof data[columnName] !== 'undefined') {
            propName = this.getModelColumnName(model, columnName);
            if (propName) {
                result[propName] = this.revertTypeContent(model,propName, data[columnName]);
            }
            else if(neutral.indexOf(columnName) === -1) {
                result[columnName] = this.revertTypeContent(model,propName, data[columnName]);
            }
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
    if(!data) {
        return null;
    }

    let columnName;
    let result = {};

    if((settings.forceId || !data[this.getModelColumnName(model, '_key')]) && newRow === true) {
        if(!settings.arangodb.unique) {
            data[this.getModelColumnName(model, '_key')] = this.getDefaultFnID(defaultFn);
        }
        else {
            data[this.getModelColumnName(model, '_key')] = sha256(data[this.getModelColumnName(model, '_from')] + data[this.getModelColumnName(model, '_to')]);
        }
    }

    for (let propName in data) {
        columnName = this.getDatabaseColumnName(model, propName);
        result[columnName] = data[propName] === null ? undefined : this.parseTypeContent(model, propName, data[propName]);
    }

    return result;
};

ArangoDB.prototype.parseTypeContent = function(model, propName, data) {
    let modelObj = this._models[model];
    let column = modelObj.properties[propName];

    if(!data || !column) {
        return data;
    }

    let columnType = column.type || String;
    let result;

    if(columnType === Date) {
        if(data instanceof Date === false) {
            data = new Date(data);
        }
        result = data.getTime();
    } else if(columnType === GeoPoint) {
        result = [data.lng,data.lat];
    } else if(columnType === Array) {
        result = data.length > 0 ? data : undefined;
    } else if(columnType === Object) {
        result = Object.keys(data).length > 0 ? data : undefined;
    } else {
        result = data;
    }

    return result;
};

ArangoDB.prototype.revertTypeContent = function(model, propName, data) {
    let modelObj = this._models[model];
    let column = modelObj.properties[propName];

    if(!data || !column) {
        return data;
    }

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
    {
        return propName;
    }
    else if (prop.arangodb)
    {
        propName = prop.arangodb.columnName || prop.arangodb.column || propName;
    }

    return propName;
};

ArangoDB.prototype.getPropertyDefault = function(model, propName) {

    return this._models[model].properties[propName] && this._models[model].properties[propName].default || null;

};

ArangoDB.prototype.getModelColumnName = function(model, columnName) {
    model = this._models[model];

    return model.columns[columnName];
};

ArangoDB.prototype.getDatabaseColumns = function(model) {
    model = this._models[model];

    let result = [];

    for (let propName in model.properties) {

        if (model.properties[propName].arangodb && model.properties[propName].arangodb.columnName)
        {
            result.push(model.properties[propName].arangodb.columnName);
        }
        else
        {
            result.push(propName);
        }

    }

    return result;
};

/**
 * --------------------------------------------------------------------------------------------------------------------
 * Query methods
 * --------------------------------------------------------------------------------------------------------------------
 */
ArangoDB.prototype.buildFilter = function(model, where) {
    let self = this;
    let collectionName = self.collectionName(model);

    if(!where) {
        return null;
    }

    debug('Where: %j', where);

    let result = this.buildRecursiveFilter(model, collectionName + '_', where);
    result.result = result.result.join(' && ');

    debug('Filter: %j', result);

    return result;

};

ArangoDB.prototype.buildRecursiveFilter = function(model, prefix, where, preField, paramsCount) {
    let self = this;
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
            case 'nilike':
                throw new Error(g.f('{{ArangoDB}} NILIKE operator not supported'));
            case 'regexp':
                if(typeof where[i] === 'object') {
                    where[i] = where[i].toString().slice(1, -1);
                }
                result.push(preField + ' =~ @p' + ++paramsCount);
                params['p'+paramsCount] = where[i];
                break;
            case 'near':
                // GEO is processed in buildIn()
                break;
            default:
                if(typeof i === 'string' && (typeof where[i] !== 'object' || where[i] === null)) {

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

    let self = this;
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
    let self = this;
    let result = [];
    let item;
    let forPrefix = self.collectionName(model) + '_';

    if(!order) {
        return null;
    }
    if(order.constructor !== Array) {
        order = [order];
    }

    for(let i in order) {
        item = order[i].split(' ');

        item[0] = self.getDatabaseColumnName(model, item[0]);

        result.push(forPrefix + '.' + item[0] + ' ' + item[1]);
    }

    return result.join(', ');
};

ArangoDB.prototype.buildLimit = function(model, offset, limit) {
    if(!limit) {
        return null;
    }

    offset = (offset?Number(offset):0);
    limit = Number(limit);

    if(limit < offset) {
        return null;
    }

    return offset + ',' + limit;
};

ArangoDB.prototype.buildCollect = function(model, collect) {
    if(!collect) {
        return null;
    }

    if(collect.constructor === Array) {
        return collect.join(' ');
    } //TODO threat different types of Collect params
    else {
        return collect;
    }
};

ArangoDB.prototype.buildReturn = function(model, fields) {
    let self = this;
    let fieldName;
    let result = [];
    let forPrefix = self.collectionName(model) + '_';

    if(!fields) {
        return forPrefix;
    }
    if(fields.constructor !== Array) {
        fields = [fields];
    }

    for(let i in fields) {
        if(fields[i] !== 'count_') {
            fieldName = self.getDatabaseColumnName(model, fields[i]);
            result.push(fieldName + ':' + forPrefix + '.' + fieldName);
        } else {
            result.push('count: count_');
        }
    }

    if(result.length > 0) {
        return '{' + result.join(', ') + '}';
    }
    else if(fields.length === 0) {
        return fields[0];
    }
    else {
        throw new Error(g.f('{{ArangoDB}} RETURN params invalid'));
    }
};

ArangoDB.prototype.buildQuery = function(model, query) {
    //let self = this;
    let result = [];

    debug('buildQuery: %j', query);

    result.push('FOR ' + query.for);
    result.push('IN ' + query.in);

    if(query.filter && query.filter.result) {
        result.push('FILTER ' + query.filter.result);
    }
    if(query.collect) {
        result.push('COLLECT ' + query.collect);
    }
    if(query.sort) {
        result.push('SORT ' + query.sort);
    }
    if(query.limit && !query.collect) {
        result.push('LIMIT ' + query.limit);
    }

    if(!query.update) {
        result.push('RETURN ' + query.return);
    }
    else {
        result.push('UPDATE ' + query.for + ' WITH ' + query.update.result + ' IN ' + query.in + ' OPTIONS { mergeObjects: false } ');
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

    if(!data) {
        return null;
    }
    let result = [];
    let params = {};
    let paramsCount = 0;

    for(let i in data) {
        result.push(this.getDatabaseColumnName(model, i) + ': @u' + ++paramsCount);
        params['u' + paramsCount] = data[i] || this.getPropertyDefault(model, i) || null;
    }

    return { result: '{' + result.join(', ') + '}', params: params };

};

ArangoDB.prototype.buildQueryString = function(model, filter, data, callback) {

    let self = this;
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

        if (err) {
            return callback(err);
        }

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
    let self = this;

    self.aqlParser(query, params, function(err, aql) {

        if(err) {
            return callback(err);
        }
        if(!aql) {
            return callback('Invalid AQL');
        }
        if(!aql.query) {
            return callback('Invalid AQL Query');
        }

        self.db.query(aql.query, (aql.params || undefined), function(err, cursor) {

            if(err) {
                return getError('AQL ERROR', err, callback);
            }

            if(!cursor) {
                return callback();
            }

            if(options && options.return === 'cursor') {
                return callback(null, cursor);
            }

            cursor.all(function(err, result) {

                if(err) {
                    return getError('AQL cursor', err, callback);
                }

                debug('AFTER RESULT: %j', result);

                callback(null, result);

            });

        });

    });

};

ArangoDB.prototype.aqlParser = function(query, params, callback) {

    if(!params) {
        return callback(null, { query: query, params: null });
    }

    let paramsResult = {};
    let paramsCount = 0;
    let queryParts;

    if(params.constructor === Array) {

        queryParts = query.split('?');

        if(queryParts.length - 1 !== params.length) {
            return callback('Params length does not match (' + queryParts.length + ', ' + params.length + ')');
        }

        for(let i in queryParts) {

            if(params[paramsCount]) {
                queryParts[i] = queryParts[i].trim() + '@p' + paramsCount;
                paramsResult['p' + paramsCount] = params[paramsCount];
                paramsCount++;
            }

        }

        return callback(null, { query: queryParts.join(' '), params: paramsResult });

    } else if(params.constructor === Object) {

        /*queryTags = query.match(/@\w*!/g);
        paramsObjectSize = Object.keys(params).length;

        if(queryTags.length != paramsObjectSize) return callback('Params length does not match (' + queryTags.length + ', ' + paramsObjectSize + ')');

        for(let i in queryTags) {
            tag = queryTags[i].slice(1);
            if(!params[tag]) return callback('Param not found (' + tag + ')');
        }*/

        callback(null, { query: query, params: params });

    } else {
        callback('Invalid params type, must be Array or Object');
    }

};

ArangoDB.prototype.all = function all(model, filter, callback) {
    debug('F: ALL');
    debug('Filter: %j', filter);

    let self = this;

    self.buildQueryString(model, filter, null, function(err, query) {

        self.db.query(query.string, (query.params || undefined), function(err, cursor) {

            if(err) {
                return getError('All query', err, callback);
            }

            if(!cursor) {
                return callback();
            }

            cursor.all(function(err, result) {

                if(err) {
                    return getError('All cursor ERROR', err, callback);
                }

                result = self.fromDatabase(model, result);

                debug('AFTER RESULT: %j', result);

                callback(null, result);

            });

        });

    });

};

ArangoDB.prototype.createCallback = function(full, model, err, doc, callback) {

    let self = this;

    if(err) {
        return getError('Document Create', err, callback);
    }

    if(full === true) {
        callback(null, self.fromDatabase(model, doc));
    }
    else {
        callback(null, doc._key);
    }

};

ArangoDB.prototype.create = function(model, data, options, callback) {

    let self = this;

    if(options.constructor === Function) {
        callback = options;
        options = undefined;
    }

    if(arangodbUtils.isEmpty(data)) {
        return callback('Data is required', null);
    }

    data = self.toDatabase(model, data, true);

    let full = options.full;
    options = self.operationOptions(model, options);

    let type = self.getArangoDBSettings(model).type;

    if(type === 'edge') {
        self.collection(model).save(data, function(err, doc){ self.createCallback(full, model, err, doc, callback); });
    } else {
        self.collection(model).save(data, options, function(err, doc){ self.createCallback(full, model, err, doc, callback); });
    }

    debug('CREATE: %j', data);

};

ArangoDB.prototype.save = function(model, data, options, callback) {
    let self = this;

    if(options.constructor === Function) {
        callback = options;
        options = undefined;
    }

    if(arangodbUtils.isEmpty(data)) {
        return callback('Data is required', null);
    }

    if(!data.key && !data.id) {
        return callback('key or id is required', null);
    }

    data = self.toDatabase(model, data);

    options = self.operationOptions(model, options);

    self.collection(model).replace(data._key, data, options, function(err, doc) {

        if(err) {
            return getError('Document Save', err, callback);
        }

        callback(null, self.fromDatabase(model, doc));

    });
};

ArangoDB.prototype.replaceById = function(model, id, data, options, callback) {

    if(id && id.indexOf('/') === -1) {
        data.key = id;
    }
    else {
        data.id = id;
    }

    this.save(model, data, options, callback);

};

ArangoDB.prototype.updateOrCreate = function(model, data, options, callback) {
    let self = this;

    let field;
    let where = {};
    for(let id in self._models[model].ids) {
        field = self._models[model].ids[id];
        if(!data[field]) {
            return callback(new Error('All id fields are required (' + field + ')'));
        }
        where[field] = data[field];
    }

    options.returnValue = 'new';

    self.update(model, where, data, options, function(err, update) {
        if(err) {
            return getError('Update or Create', err, callback);
        } else if(update.length === 0) {
            self.create(model, data, options, callback);
        } else {
            callback(null, update && update[0]);
        }

    });

};

ArangoDB.prototype.upsert = ArangoDB.prototype.updateOrCreate;

ArangoDB.prototype.update = ArangoDB.prototype.updateAll = function(model, where, data, options, callback) {
    let self = this;

    if(options.constructor === Function) {
        callback = options;
        options = undefined;
    }

    if(!where) {
        return callback(new Error('No update allowed without WHERE params!'));
    }
    if(!where.where) {
        where = { where: where };
    }

    data = JSON.parse(JSON.stringify(data));

    self.buildQueryString(model, where, self.toDatabase(model, data), function(err, query) {

        self.db.query(query.string, (query.params || undefined), { count: true }, function(err, cursor) {

            if(err) {
                return getError('Update', err, callback);
            }

            if(options && options.returnValue === 'new') {
                callback(null, self.fromDatabase(model, cursor && cursor._result || 0));
            }
            else {
                callback(null, cursor && cursor.count || 0);
            }

        });

    });

};

ArangoDB.prototype.updateAttributes = function(model, id, data, options, callback) {

    this.update(model, { key: id }, data, options, callback);

};

ArangoDB.prototype.destroyAll = function(model, where, options, callback) {

    let self = this;

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

        let primaryKey = self.getModelColumnName(model, '_key');

        self.all(model, { where: where, fields: [primaryKey] }, function(err, items) {

            let destroyCount = 0;

            async.each(items, function(item, cb){
                self.collection(model).removeByKeys([item[primaryKey]], options, function(err) {
                    if(err) {
                        return getError('Document Destroy', err, callback);
                    }

                    destroyCount++;

                    cb(null, true);
                });
            }, function(err) {
                if(err) {
                    return getError('Destroy', err, callback);
                }

                callback(null, destroyCount);
            });

        });

    } else {

        debug('Truncate ALL');

        self.collection(model).truncate(function(err, truncate) {

            if(err) {
                return getError('Truncate', err, callback);
            }

            debug('Truncate: %j', truncate);

            callback(null, { count: truncate });

        });

    }

};

ArangoDB.prototype.count = function(model, where, options, callback) {

    this.all(model, { where: where, fields: ['count_'], collect: 'WITH COUNT INTO count_' }, function(err, count) {
        if(err) {
            return getError('Count', err, callback);
        }

        callback(null, count && count[0] && count[0].count);

    });

};














