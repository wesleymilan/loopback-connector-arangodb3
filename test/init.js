// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-connector-mongodb
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

module.exports = require('should');

var DataSource = require('loopback-datasource-juggler').DataSource;

var TEST_ENV = process.env.TEST_ENV || 'test';
var config = require('rc')('loopback', { test: { arangodb: {}}})[TEST_ENV].arangodb;

config = {
    hostname: process.env.DS_ARANGODB_HOST,
    port: process.env.DS_ARANGODB_PORT,
    database: process.env.DS_ARANGODB_DATABASE,
    password: process.env.DS_ARANGODB_PASSWORD,
    user: process.env.DS_ARANGODB_USER
};

global.config = config;

global.getDataSource = global.getSchema = function(customConfig) {
    var db = new DataSource(require('../'), customConfig || config);
    db.log = function(a) {
        console.log(a);
    };

    return db;
};

/*global.connectorCapabilities = {
 ilike: false,
 nilike: false,
 nestedProperty: true,
 };*/

//global.sinon = require('sinon');
