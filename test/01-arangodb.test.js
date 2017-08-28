// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-connector-arangodb
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// This test written in mocha+should.js
var semver = require('semver');
var should = require('./init.js');
//var testUtils = require('../lib/test-utils');
var async = require('async');

var GeoPoint = require('loopback-datasource-juggler').GeoPoint;

var Superhero, User, Post, PostWithStringId, db, PostWithUUID,
    PostWithUUID, PostWithNumberId,
    Category, UserWithRenamedColumns, PostWithStringIdAndRenamedColumns, Employee,
    UserLikePostAutoId, UserLikePostManualID, UserLikePostAutoUniqueID;

describe('arangodb connector', function() {

    before(function(done) {
        db = getDataSource();

        User = db.define('User', {
            firstName: {type: String},
            lastName: {type: String},
            email: {type: String, unique: true, required: true },
            age: Number,
            icon: Buffer
        }, {
            forceId: false,
            indexes: [
                {
                    fields: ['name', 'age'],
                    unique: false,
                    type: "hash",
                    sparse: true,
                    deduplicate: true
                },
                {
                    fields: ['age'],
                    unique: false,
                    type: "persistent",
                    sparse: true,
                    deduplicate: true
                }
            ]
        });

        UserWithRenamedColumns = db.define('UserWithRenamedColumns', {
            renamedName: { type: String, arangodb: { column: 'name' }},
            renamedEmail: { type: String, unique: true, arangodb: { column: 'email' }},
            age: Number,
            icon: Buffer
        }, {
            arangodb: {
                collection: 'User' // Overlay on the User collection
            }
        });

        Superhero = db.define('Superhero', {
            name: { type: String },
            power: { type: String, unique: true },
            address: { type: String, required: false },
            description: { type: String, required: false },
            location: { type: Object, required: false },
            age: Number,
            icon: Buffer
        }, {
            arangodb: {
                collection: 'sh'
            },
            indexes: [
                {
                    "fields": ["location"],
                    "type": "geo",
                    "geoJson": true
                }
            ]
        });

        Post = db.define('Post', {
            title: { type: String, length: 255 },
            content: { type: String },
            comments: [String]
        }, {
            arangodb: {
                collection: 'Post' // Customize the collection name
            },
            forceId: false
        });

        UserLikePostAutoId = db.define('UserLikePostAutoId', {
            title: { type: String, length: 255 },
            content: { type: String },
            comments: [String]
        }, {
            arangodb: {
                type: 'edge',
                collection: 'UserLikePostAutoId' // Customize the collection name
            },
            forceId: true
        });

        UserLikePostManualID = db.define('UserLikePostManualID', {
            title: { type: String, length: 255 },
            content: { type: String },
            comments: [String]
        }, {
            arangodb: {
                type: 'edge',
                collection: 'UserLikePostManualID' // Customize the collection name
            },
            forceId: false
        });

        UserLikePostAutoUniqueID = db.define('UserLikePostAutoUniqueID', {
            title: { type: String, length: 255 },
            content: { type: String },
            comments: [String]
        }, {
            arangodb: {
                type: 'edge',
                unique: 'plain', // Valid values: plain, md5, SHA256
                collection: 'UserLikePostAutoUniqueID' // Customize the collection name
            },
            forceId: true // Should be settled to true, arangodb.unique only works if this option is true
        });

        Product = db.define('Product', {
            name: { type: String, length: 255 },
            description: { type: String },
            price: { type: Number },
            pricehistory: { type: Object }
        }, {
            arangodb: {
                collection: 'ProductCollection' // Customize the collection name
            },
            forceId: false
        });

        PostWithStringId = db.define('PostWithStringId', {
            key: { type: String },
            title: { type: String, length: 255 },
            content: { type: String }
        }, {
            forceId: false,
            strict: false
        });

        PostWithUUID = db.define('PostWithUUID', {
            key: { defaultFn: 'uuid' },
            title: { type: String, length: 255 },
            content: { type: String }
        }, {
            forceId: true,
            strict: false
        });

        PostWithNumberId = db.define('PostWithNumberId', {
            title: { type: String, length: 255 },
            content: { type: String }
        });

        Category = db.define('Category', {
            title: { type: String, length: 255 },
            posts: { type: String }
        });

        PostWithStringIdAndRenamedColumns = db.define('PostWithStringIdAndRenamedColumns', {
            renamedTitle: { type: String, length: 255, arangodb: { column: 'title' }},
            renamedContent: { type: String, arangodb: { column: 'content' }}
        }, {
            arangodb: {
                collection: 'PostWithStringId' // Overlay on the PostWithStringId collection
            }
        });

        Employee = db.define('Employee', {
                key: { type: String, id: true },
                title: { type: String, length: 255 },
                name: { type: String },
                age: { type: Number },
                contact: { type: String }
            },
            {
                forceId: false,
                arangodb: {
                    collection: 'employee',
                    keyOptions: {
                        type: 'traditional'
                    },
                    waitForSync: true
                }
            });

        //It doesn't work due to a Loopback Bug
        User.hasMany(Post, {through: UserLikePostAutoId, foreignKey: 'to', keyThrough: 'from', primaryKey: 'id'});
        Post.hasMany(User, {through: UserLikePostAutoId, foreignKey: 'from', keyThrough: 'to', primaryKey: 'id'});
        UserLikePostAutoId.belongsTo(User, { foreignKey: 'from', primaryKey: 'id' });
        UserLikePostAutoId.belongsTo(Post, { foreignKey: 'to', primaryKey: 'id' });

        let modelList = [
            'User',
            'Post',
            'PostWithUUID',
            'PostWithNumberId',
            'PostWithStringId',
            'Employee',
            'UserLikePostAutoId',
            'UserLikePostManualID',
            'UserLikePostAutoUniqueID'
        ];

        db.automigrate(modelList, function (err) {
            //console.log(err);
            should.not.exist(err);
            done();
        });
    });

    beforeEach(function(done) {
        //User.settings.arangodb = {};
        User.destroyAll(function() {
            Post.destroyAll(function() {
                PostWithUUID.destroyAll(function() {
                    PostWithNumberId.destroyAll(function() {
                        PostWithStringId.destroyAll(function() {
                            Employee.destroyAll(function() {
                                done();
                            });
                        });
                    });
                });
            });
        });
    });

    /*beforeEach(function(done) {
        db = getDataSource();
        let modelList = ['User', 'Post', 'PostWithUUID', 'PostWithNumberId', 'PostWithStringId'];
        db.automigrate(modelList, function(err) {
            //console.log(err);
            should.not.exist(err);
            done();
        });
    });*/

    describe('Check database conection with ping', function() {
        it('should return true for valid connection', function(done) {
            db.ping(done);
        });

        it('should report connection errors with invalid config', function(done) {
            var ds = getDataSource({
                host: 'localhost',
                port: 4 // unassigned by IANA
            });
            ds.ping(function(err) {
                //(!!err).should.be.true;
                err.message.should.match(/connect ECONNREFUSED/);
                done();
            });
        });

        it('ignores invalid option', function(done) {
            var configWithInvalidOption = config;
            configWithInvalidOption.invalidOption = 'invalid';
            var ds = getDataSource(configWithInvalidOption);
            ds.ping(done);
        });
    });

    describe('User: Checking indexes', function() {
        it('should create indexes', function (done) {
            db.automigrate('User', function () {
                db.connector.db.collection('User').indexes(function (err, result) {
                    should.not.exist(err);
                    should.exist(result);

                    let valid = true;
                    let types = [];

                    for(let i in result) {
                        types.push(result[i].type);
                    }

                    if(types.indexOf('primary') == -1) valid = false;
                    if(types.indexOf('hash') == -1) valid = false;
                    if(types.indexOf('persistent') == -1) valid = false;

                    valid.should.eql(true);
                    done(err, result);
                });
            });
        });

        it('should create complex indexes', function(done) {
            db.automigrate('Superhero', function() {
                db.connector.db.collection('sh').indexes(function(err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result[0].type.should.eql('primary');
                    result[0].fields.should.eql(['_key']);
                    result[1].type.should.eql('geo1');
                    result[1].fields.should.eql(['location']);
                    done(err, result);
                });
            });
        });
    });

    describe('PostWithUUID: UUID', function() {
        it('should allow to create post with id type UUID', function(done) {
            PostWithUUID.create({ title: 'UUID', notListed: 'should appears' }, function(err, post) {
                PostWithUUID.find({ where: { key: post.id.key.toString() }}, function(err, p) {
                    should.not.exist(err);
                    post = p[0];
                    should.exist(post);
                    post.key.should.match(/^[0-9a-z]{8}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{12}$/);

                    done();
                });
            });
        });
    });

    describe('PostWithStringId: String', function() {
        it('should allow to create post with id type String', function(done) {
            PostWithStringId.create({ key: 'string', title: 'String' }, function(err, post) {
                PostWithStringId.find({ where: { key: post.id.key.toString() }}, function(err, p) {
                    should.not.exist(err);
                    post = p[0];
                    should.exist(post);
                    post.key.should.eql('string');

                    done();
                });
            });
        });
    });

    describe('User: Fields validation', function() {

        it('User without email should return ValidationError', function(done) {
            let user = {
                firstName: 'Without',
                lastName: 'Email',
                age: 32
            };

            User.create(user, function(err, user) {
                should.exist(err);
                should.exist(err.details);
                should.exist(err.details.codes);
                should.exist(err.details.codes.email);
                err.details.codes.email[0].should.be.eql('presence');
                err.statusCode.should.be.eql(422);

                done();
            });
        });

        it('User with string AGE should return NaN on AGE field', function(done) {
            let user = {
                firstName: 'Without',
                lastName: 'Email',
                email: 'test@test.com',
                age: 'twenty one'
            };

            User.create(user, function(err, user) {
                should.not.exist(err);
                user.age.should.be.eql(NaN);

                done();
            });
        });

    });

    describe('Employee: Order filters', function() {

        var data;

        it('find instances in descending order', function(done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function(err, result) {
                Employee.all({order: 'key DESC'}, function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result[0].key.should.eql('c');
                    result[1].key.should.eql('b');
                    result[2].key.should.eql('a');
                    done();
                });
            });
        });

        it('find instances in ascending order', function(done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function(err, result) {
                Employee.all({order: 'key ASC'}, function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result[0].key.should.eql('a');
                    result[1].key.should.eql('b');
                    result[2].key.should.eql('c');
                    done();
                });
            });
        });
    });

    describe('Employee: Where filters', function() {

        var data;

        it('find instances by id', function(done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function(err, result) {
                Employee.findById('a', function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result.key.should.eql('a');
                    Employee.findById('b', function (err, result) {
                        should.not.exist(err);
                        should.exist(result);
                        result.key.should.eql('b');
                        Employee.findById('c', function (err, result) {
                            should.not.exist(err);
                            should.exist(result);
                            result.key.should.eql('c');
                            done();
                        });
                    });
                });
            });
        });

        it('find instances by field name', function(done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function(err, result) {
                Employee.find({ where: { name: 'Foo' } }, function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result[0].key.should.eql('a');
                    done();
                });
            });
        });

        it('find one instance by field age', function(done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function(err, result) {
                Employee.findOne({ where: { age: 23 } }, function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result.key.should.eql('b');
                    done();
                });
            });
        });

        it('find instances by field age greater than', function(done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function(err, result) {
                Employee.find({ where: { age: { gt: 88 } } }, function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result[0].key.should.eql('c');
                    result.length.should.eql(1);
                    done();
                });
            });
        });

        it('find instances by field age greater or equal than', function(done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function(err, result) {
                Employee.find({ where: { age: { gte: 89 } } }, function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result[0].key.should.eql('c');
                    result.length.should.eql(1);
                    done();
                });
            });
        });

        it('find instances by field age smaller than', function(done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function(err, result) {
                Employee.find({ where: { age: { lt: 23 } } }, function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result[0].key.should.eql('a');
                    result.length.should.eql(1);
                    done();
                });
            });
        });

        it('find instances by field age smaller or equal than', function(done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function(err, result) {
                Employee.find({ where: { age: { lte: 23 } } }, function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result.length.should.eql(2);
                    done();
                });
            });
        });

        it('find instances by field age between than', function(done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function(err, result) {
                Employee.find({ where: { age: { between: [22,88] } } }, function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result[0].key.should.eql('b');
                    result.length.should.eql(1);
                    done();
                });
            });
        });

        it('find instances by field name IN array', function(done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function(err, result) {
                Employee.find({ where: { name: { inq: ['Foo','Bar'] } } }, function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result.length.should.eql(2);
                    done();
                });
            });
        });

        it('find instances by field name NOT IN array', function(done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function(err, result) {
                Employee.find({ where: { name: { nin: ['Foo','Bar'] } } }, function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result[0].key.should.eql('b');
                    result.length.should.eql(1);
                    done();
                });
            });
        });

        it('find instances by field name NOT EQUAL', function(done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function(err, result) {
                Employee.find({ where: { name: { neq: 'Baz' } } }, function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result.length.should.eql(2);
                    done();
                });
            });
        });

        it('find instances by field name LIKE', function(done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function(err, result) {
                Employee.find({ where: { name: { like: 'B%' } } }, function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result.length.should.eql(2);
                    done();
                });
            });
        });

        it('find instances by field name NOT LIKE', function(done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function(err, result) {
                Employee.find({ where: { name: { nlike: 'B%' } } }, function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result[0].key.should.eql('a');
                    result.length.should.eql(1);
                    done();
                });
            });
        });

        it('find instances by field title REGEXP', function(done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function(err, result) {
                Employee.find({ where: { title: { regexp: new RegExp(/.+Software.+/) } } }, function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result[0].key.should.eql('a');
                    result.length.should.eql(1);
                    done();
                });
            });
        });

        it('find instances using operator AND', function(done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function(err, result) {
                Employee.find({ where: { and: [ { age: { gt: 20 } }, { name: 'Bar' } ] } }, function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result[0].key.should.eql('c');
                    result.length.should.eql(1);
                    done();
                });
            });
        });

        it('find instances using operator OR', function(done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function(err, result) {
                Employee.find({ where: { or: [ { age: { gte: 89 } }, { name: 'Baz' } ] } }, function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result.length.should.eql(2);
                    done();
                });
            });
        });

        it('count instances using ID', function (done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function (err, result) {
                Employee.count({ key: 'a' }, function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result.should.eql(1);
                    done();
                });
            });
        });

        it('exists instances using ID', function (done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function (err, result) {
                Employee.exists('a', function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    done();
                });
            });
        });

        /*it('find instances using GEO location', function(done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function(err, result) {

                var userLocation = new GeoPoint({
                    lat: 42.266271,
                    lng: -72.6700016
                });

                let geo = {
                    where: {
                        location: {
                            near: userLocation,
                            maxDistance: 2,
                            unit: 'kilometers'
                        }
                    }
                };

                Employee.find(geo, function (err, result) {

                    console.log(result);

                    should.not.exist(err);
                    should.exist(result);
                    result.length.should.eql(2);
                    done();
                });
            });
        });*/

        it('Query by Array Params', function (done) {

            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function (err, result) {

                var ds = Employee.dataSource;

                let query = 'FOR e IN employee FILTER e._key == ? RETURN e';
                let params = ['a'];

                ds.connector.executeAQL(query, params, null, function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result.length.should.eql(1);
                    result[0]._key.should.eql('a');
                    done();
                });

            });

        });

        it('Query by Object Params', function (done) {

            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function (err, result) {

                var ds = Employee.dataSource;

                let query = 'FOR e IN employee FILTER e.age > @age && e.name == @name RETURN e';
                let params = { age: 25, name: 'Bar' };

                ds.connector.executeAQL(query, params, null, function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result.length.should.eql(1);
                    result[0]._key.should.eql('c');
                    done();
                });

            });

        });

        it('Query returning cursor', function (done) {

            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function (err, result) {

                var ds = Employee.dataSource;

                let query = 'FOR e IN employee RETURN e';

                ds.connector.executeAQL(query, null, { return: 'cursor' }, function (err, cursor) {
                    should.not.exist(err);
                    should.exist(result);

                    cursor.all(function(err, result) {
                        should.not.exist(err);
                        should.exist(result);
                        result.length.should.eql(3);
                        done();

                    });

                });

            });

        });

    });

    describe('Edges: Insert', function() {

        var data;

        it('Edge UserLikePostAutoId', function (done) {
            data = require(__dirname + '/fixtures/posts.json');
            Post.create(data, function (err, result) {

                data = require(__dirname + '/fixtures/users.json');
                User.create(data, function (err, result) {

                    data = require(__dirname + '/fixtures/user-like-post.json');
                    UserLikePostAutoId.create(data, function (err, result) {

                        UserLikePostAutoId.findOne({ where: { from: 'User/1', to: 'Post/1' } }, function(err, edge) {
                            should.not.exist(err);
                            should.exist(result);
                            edge.key.should.not.eql('1');
                            done();

                        });

                    });

                });

            });

        });

        it('Edge UserLikePostManualID', function (done) {
            data = require(__dirname + '/fixtures/posts.json');
            Post.create(data, function (err, result) {

                data = require(__dirname + '/fixtures/users.json');
                User.create(data, function (err, result) {

                    data = require(__dirname + '/fixtures/user-like-post.json');
                    UserLikePostManualID.create(data, function (err, result) {

                        UserLikePostManualID.findOne({ where: { from: 'User/1', to: 'Post/1' } }, function(err, edge) {
                            should.not.exist(err);
                            should.exist(result);
                            edge.key.should.eql('1');
                            done();

                        });

                    });

                });

            });

        });

        it('Edge UserLikePostAutoUniqueID', function (done) {
            data = require(__dirname + '/fixtures/posts.json');
            Post.create(data, function (err, result) {

                data = require(__dirname + '/fixtures/users.json');
                User.create(data, function (err, result) {

                    data = require(__dirname + '/fixtures/user-like-post.json');
                    UserLikePostAutoUniqueID.create(data, function (err, result) {

                        UserLikePostAutoUniqueID.findOne({ where: { from: 'User/1', to: 'Post/1' } }, function(err, edge) {
                            should.not.exist(err);
                            should.exist(result);
                            edge.key.length.should.eql(64);
                            done();

                        });

                    });

                });

            });

        });

        it('Edge UserLikePostAutoId', function (done) {
            data = require(__dirname + '/fixtures/posts.json');
            Post.create(data, function (err, result) {

                data = require(__dirname + '/fixtures/users.json');
                User.create(data, function (err, result) {

                    data = require(__dirname + '/fixtures/user-like-post.json');
                    UserLikePostAutoId.create(data, function (err, result) {

                        var ds = UserLikePostAutoId.dataSource;

                        let query = 'FOR e IN employee FILTER e._key == ? RETURN e';
                        let params = ['a'];

                        ds.connector.executeAQL(query, params, null, function (err, result) {
                            should.not.exist(err);
                            should.exist(result);
                            result.length.should.eql(1);
                            result[0]._key.should.eql('a');
                            done();
                        });

                    });

                });

            });

        });

        /*it('Edge build in fields', function (done) {
            data = require(__dirname + '/fixtures/posts.json');
            Post.create(data, function (err, result) {
                Post.all(function (err, result) {

                    console.log('Result: %j', result);
                    done();

                });

            });
        });*/

    });

    /*describe('Employee: Update', function() {

        var data;

        it('update instances by where', function (done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function (err, result) {
                Employee.update({ age: { lt: 25 } }, { name: 'updated' }, function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result.should.eql(2);
                    Employee.find({ where: { name: 'updated' } }, function (err, result) {
                        should.not.exist(err);
                        should.exist(result);
                        result.length.should.eql(2);
                        done();
                    });
                });

            });
        });

        it('updateAttributes from instances', function (done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function (err, result) {
                Employee.findById('a', function (err, result) {
                    result.updateAttributes({name: 'byId'}, function (err, result) {
                        should.not.exist(err);
                        should.exist(result);
                        result.key.should.eql('a');
                        should.exist(result.title); // Other attributes should exists after updateAttributes
                        Employee.find({where: {name: 'byId'}}, function (err, result) {
                            should.not.exist(err);
                            should.exist(result);
                            result.length.should.eql(1);
                            done();
                        });
                    });
                });

            });
        });

        it('update instances using save', function (done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function (err, result) {
                Employee.findById('a', function (err, result) {
                    result.name = 'saved';
                    result.title = null;
                    result.save(function (err, result) {
                        should.not.exist(err);
                        should.exist(result);
                        result.key.should.eql('a');
                        should.not.exist(result.title);  // Title attribute should not exists after save
                        Employee.find({where: {name: 'saved'}}, function (err, result) {
                            should.not.exist(err);
                            should.exist(result);
                            result.length.should.eql(1);
                            done();
                        });
                    });
                });

            });
        });

        it('update instances using save', function (done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function (err, result) {
                Employee.findById('a', function (err, result) {
                    result.name = 'saved';
                    result.title = null;
                    result.save(function (err, result) {
                        should.not.exist(err);
                        should.exist(result);
                        result.key.should.eql('a');
                        should.not.exist(result.title);  // Title attribute should not exists after save
                        Employee.find({where: {name: 'saved'}}, function (err, result) {
                            should.not.exist(err);
                            should.exist(result);
                            result.length.should.eql(1);
                            done();
                        });
                    });
                });

            });
        });

        it('replaceOrCreate instances using existent data', function (done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function (err, result) {
                Employee.findById('a', function (err, result) {
                    result = result.toJSON();
                    result.name = 'replaceOrCreate';
                    Employee.replaceOrCreate(result, function (err, result) {
                        should.not.exist(err);
                        should.exist(result);
                        result.key.should.eql('a');
                        should.not.exist(result.title);  // Title attribute should not exists after save
                        Employee.find({where: {name: 'replaceOrCreate'}}, function (err, result) {
                            should.not.exist(err);
                            should.exist(result);
                            result.length.should.eql(1);
                            done();
                        });
                    });
                });

            });
        });

        it('replaceOrCreate instances using new data', function (done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function (err, result) {
                Employee.findById('a', function (err, result) {
                    result = result.toJSON();
                    result.name = 'replaceOrCreate';
                    result.key = 'z';
                    Employee.replaceOrCreate(result, function (err, result) {
                        should.not.exist(err);
                        should.exist(result);
                        result.key.should.eql('z');
                        Employee.find({where: {name: 'replaceOrCreate'}}, function (err, result) {
                            should.not.exist(err);
                            should.exist(result);
                            result.length.should.eql(1);
                            done();
                        });
                    });
                });

            });
        });

        it('replaceById instances', function (done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function (err, result) {
                Employee.findById('b', function (err, result) {
                    result = result.toJSON();
                    result.name = 'replaceById';
                    Employee.replaceById(result.key, result, function (err, result) {
                        should.not.exist(err);
                        should.exist(result);
                        result.key.should.eql('b');
                        Employee.find({where: {name: 'replaceById'}}, function (err, result) {
                            should.not.exist(err);
                            should.exist(result);
                            result.length.should.eql(1);
                            done();
                        });
                    });
                });

            });
        });

        it('replaceById instances', function (done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function (err, result) {
                Employee.findById('b', function (err, result) {
                    result = result.toJSON();
                    result.name = 'replaceById';
                    Employee.replaceById(result.key, result, function (err, result) {
                        should.not.exist(err);
                        should.exist(result);
                        result.key.should.eql('b');
                        Employee.find({where: {name: 'replaceById'}}, function (err, result) {
                            should.not.exist(err);
                            should.exist(result);
                            result.length.should.eql(1);
                            done();
                        });
                    });
                });

            });
        });

        it('updateOrCreate instances using existent data', function (done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function (err, result) {
                Employee.findById('a', function (err, result) {
                    result = result.toJSON();
                    result.name = 'updateOrCreate';
                    Employee.updateOrCreate(result, function (err, result) {
                        should.not.exist(err);
                        should.exist(result);
                        result.key.should.eql('a');
                        result.name.should.eql('updateOrCreate');
                        Employee.find({where: {name: 'updateOrCreate'}}, function (err, result) {
                            should.not.exist(err);
                            should.exist(result);
                            result.length.should.eql(1);
                            done();
                        });
                    });
                });

            });
        });

        it('updateOrCreate instances using new data', function (done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function (err, result) {
                Employee.findById('a', function (err, result) {
                    result = result.toJSON();
                    result.name = 'updateOrCreate';
                    result.key = 'z';
                    Employee.replaceOrCreate(result, function (err, result) {
                        should.not.exist(err);
                        should.exist(result);
                        result.key.should.eql('z');
                        Employee.find({where: {name: 'updateOrCreate'}}, function (err, result) {
                            should.not.exist(err);
                            should.exist(result);
                            result.length.should.eql(1);
                            done();
                        });
                    });
                });

            });
        });

        it('destroyById instances', function (done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function (err, result) {
                Employee.destroyById('a', function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result.should.eql(1);
                    Employee.findById('a', function (err, result) {
                        should.not.exist(err);
                        should.not.exist(result);
                        done();
                    });
                });

            });
        });

        it('findOrCreate instances', function (done) {
            data = require(__dirname + '/fixtures/employee.json');
            Employee.create(data, function (err, result) {

                let filter = { where: { key: 'a' } };
                let data = {
                    "key": "a",
                    "title": "findOrCreate",
                    "name": "findOrCreate",
                    "age": 21,
                    "contact": "foo@foo.com"
                };

                Employee.findOrCreate(filter, data, function (err, result) {
                    should.not.exist(err);
                    should.exist(result);
                    result.name.should.eql('Foo');

                    filter = { where: { key: 'y' } };
                    data.key = 'y';

                    Employee.findOrCreate(filter, data, function (err, result) {
                        should.not.exist(err);
                        should.exist(result);
                        result.name.should.eql('findOrCreate');
                        done();
                    });
                });

            });
        });

    });*/

    //describe('Order filters', function() {
    //
    //    var data;
    //
    //    it('Load data fixtures', function(done) {
    //        data = require(__dirname + '/fixtures/employee.json');
    //        Employee.create(data, function(err, result) {
    //            should.not.exist(err);
    //            should.exist(result);
    //            result[0].toObject().should.deepEqual(data[0]);
    //            result[1].toObject().should.deepEqual(data[1]);
    //            result[2].toObject().should.deepEqual(data[2]);
    //            done();
    //        });
    //    });
    //
    //    it('find instances in descending order', function(done) {
    //        Employee.all({ order: 'id DESC' }, function(err, result) {
    //            should.not.exist(err);
    //            should.exist(result);
    //            result.length.should.equal(data.length);
    //            result[0].toObject().should.deepEqual(data[2]);
    //            result[1].toObject().should.deepEqual(data[1]);
    //            result[2].toObject().should.deepEqual(data[0]);
    //            done();
    //        });
    //    });
    //
    //    it('find instances in ascending order', function(done) {
    //        Employee.all({ order: 'id ASC' }, function(err, result) {
    //            should.not.exist(err);
    //            should.exist(result);
    //            result.length.should.equal(data.length);
    //            result[0].toObject().should.deepEqual(data[0]);
    //            result[1].toObject().should.deepEqual(data[1]);
    //            result[2].toObject().should.deepEqual(data[2]);
    //            done();
    //        });
    //    });
    //});

    //it('find with `id` as defined id should return an object with id instanceof ObjectID', function(done) {
    //    PostWithUUID.create(function(err, post) {
    //        PostWithUUID.findById(post.id, function(err, post) {
    //            should.not.exist(err);
    //            post.id.should.be.an.instanceOf(db.ObjectID);
    //
    //            done();
    //        });
    //    });
    //});
    //
    //it('should update the instance with `id` as defined id', function(done) {
    //    PostWithUUID.create({ title: 'a', content: 'AAA' }, function(err, post) {
    //        post.title = 'b';
    //        PostWithUUID.updateOrCreate(post, function(err, p) {
    //            should.not.exist(err);
    //            p.id.should.be.equal(post.id);
    //
    //            PostWithUUID.findById(post.id, function(err, p) {
    //                should.not.exist(err);
    //                p.id.should.be.eql(post.id);
    //                p.content.should.be.equal(post.content);
    //                p.title.should.be.equal('b');
    //            });
    //
    //            PostWithUUID.find({ where: { title: 'b' }}, function(err, posts) {
    //                should.not.exist(err);
    //                p = posts[0];
    //                p.id.should.be.eql(post.id);
    //                p.content.should.be.equal(post.content);
    //                p.title.should.be.equal('b');
    //                posts.should.have.lengthOf(1);
    //                done();
    //            });
    //        });
    //    });
    //});
    //
    //it('all should return object (with `id` as defined id) with an id instanceof ObjectID', function(done) {
    //    var post = new PostWithUUID({ title: 'a', content: 'AAA' });
    //    post.save(function(err, post) {
    //        PostWithUUID.all({ where: { title: 'a' }}, function(err, posts) {
    //            should.not.exist(err);
    //            posts.should.have.lengthOf(1);
    //            post = posts[0];
    //            post.should.have.property('title', 'a');
    //            post.should.have.property('content', 'AAA');
    //            post.id.should.be.an.instanceOf(db.ObjectID);
    //
    //            done();
    //        });
    //    });
    //});
    //
    //it('all return should honor filter.fields, with `id` as defined id', function(done) {
    //    var post = new PostWithUUID({ title: 'a', content: 'AAA' });
    //    post.save(function(err, post) {
    //        PostWithUUID.all({ fields: ['title'], where: { title: 'a' }}, function(err, posts) {
    //            should.not.exist(err);
    //            posts.should.have.lengthOf(1);
    //            post = posts[0];
    //            post.should.have.property('title', 'a');
    //            post.should.have.property('content', undefined);
    //            should.not.exist(post.id);
    //
    //            done();
    //        });
    //    });
    //});
    //
    //it('should support Buffer type', function(done) {
    //    User.create({ name: 'John', icon: new Buffer('1a2') }, function(e, u) {
    //        User.findById(u.id, function(e, user) {
    //            user.icon.should.be.an.instanceOf(Buffer);
    //            done();
    //        });
    //    });
    //});
    //
    //it('hasMany should support additional conditions', function(done) {
    //    User.create(function(e, u) {
    //        u.posts.create({}, function(e, p) {
    //            u.posts({ where: { id: p.id }}, function(err, posts) {
    //                should.not.exist(err);
    //                posts.should.have.lengthOf(1);
    //
    //                done();
    //            });
    //        });
    //    });
    //});
    //
    //it('create should return id field but not arangodb id', function(done) {
    //    Post.create({ title: 'Post1', content: 'Post content' }, function(err, post) {
    //        //console.log('create should', err, post);
    //        should.not.exist(err);
    //        should.exist(post.id);
    //        should.not.exist(post.id);
    //
    //        done();
    //    });
    //});
    //
    //it('should allow to find by id string', function(done) {
    //    Post.create({ title: 'Post1', content: 'Post content' }, function(err, post) {
    //        Post.findById(post.id.toString(), function(err, p) {
    //            should.not.exist(err);
    //            should.exist(p);
    //            done();
    //        });
    //    });
    //});
    //
    //it('should allow custom collection name', function(done) {
    //    Post.create({ title: 'Post1', content: 'Post content' }, function(err, post) {
    //        Post.dataSource.connector.db.collection('PostCollection').findOne({ id: post.id }, function(err, p) {
    //            should.not.exist(err);
    //            should.exist(p);
    //            done();
    //        });
    //    });
    //});
    //
    //it('should allow to find by id using where', function(done) {
    //    Post.create({ title: 'Post1', content: 'Post1 content' }, function(err, p1) {
    //        Post.create({ title: 'Post2', content: 'Post2 content' }, function(err, p2) {
    //            Post.find({ where: { id: p1.id }}, function(err, p) {
    //                should.not.exist(err);
    //                should.exist(p && p[0]);
    //                p.length.should.be.equal(1);
    //                // Not strict equal
    //                p[0].id.should.be.eql(p1.id);
    //                done();
    //            });
    //        });
    //    });
    //});
    //
    //it('should allow to find by id using where inq', function(done) {
    //    Post.create({ title: 'Post1', content: 'Post1 content' }, function(err, p1) {
    //        Post.create({ title: 'Post2', content: 'Post2 content' }, function(err, p2) {
    //            Post.find({ where: { id: { inq: [p1.id] }}}, function(err, p) {
    //                should.not.exist(err);
    //                should.exist(p && p[0]);
    //                p.length.should.be.equal(1);
    //                // Not strict equal
    //                p[0].id.should.be.eql(p1.id);
    //                done();
    //            });
    //        });
    //    });
    //});
    //
    //it('should invoke hooks', function(done) {
    //    var events = [];
    //    var connector = Post.getDataSource().connector;
    //    connector.observe('before execute', function(ctx, next) {
    //        ctx.req.command.should.be.string;
    //        ctx.req.params.should.be.array;
    //        events.push('before execute ' + ctx.req.command);
    //        next();
    //    });
    //    connector.observe('after execute', function(ctx, next) {
    //        ctx.res.should.be.object;
    //        events.push('after execute ' + ctx.req.command);
    //        next();
    //    });
    //    Post.create({ title: 'Post1', content: 'Post1 content' }, function(err, p1) {
    //        Post.find(function(err, results) {
    //            events.should.eql(['before execute insert', 'after execute insert',
    //                'before execute find', 'after execute find']);
    //            connector.clearObservers('before execute');
    //            connector.clearObservers('after execute');
    //            done(err, results);
    //        });
    //    });
    //});
    //
    //it('should allow to find by number id using where', function(done) {
    //    PostWithNumberId.create({ id: 1, title: 'Post1', content: 'Post1 content' }, function(err, p1) {
    //        PostWithNumberId.create({ id: 2, title: 'Post2', content: 'Post2 content' }, function(err, p2) {
    //            PostWithNumberId.find({ where: { id: p1.id }}, function(err, p) {
    //                should.not.exist(err);
    //                should.exist(p && p[0]);
    //                p.length.should.be.equal(1);
    //                p[0].id.should.be.eql(p1.id);
    //                done();
    //            });
    //        });
    //    });
    //});
    //
    //it('should allow to find by number id using where inq', function(done) {
    //    PostWithNumberId.create({ id: 1, title: 'Post1', content: 'Post1 content' }, function(err, p1) {
    //        PostWithNumberId.create({ id: 2, title: 'Post2', content: 'Post2 content' }, function(err, p2) {
    //            PostWithNumberId.find({ where: { id: { inq: [1] }}}, function(err, p) {
    //                should.not.exist(err);
    //                should.exist(p && p[0]);
    //                p.length.should.be.equal(1);
    //                p[0].id.should.be.eql(p1.id);
    //                PostWithNumberId.find({ where: { id: { inq: [1, 2] }}}, function(err, p) {
    //                    should.not.exist(err);
    //                    p.length.should.be.equal(2);
    //                    p[0].id.should.be.eql(p1.id);
    //                    p[1].id.should.be.eql(p2.id);
    //                    PostWithNumberId.find({ where: { id: { inq: [0] }}}, function(err, p) {
    //                        should.not.exist(err);
    //                        p.length.should.be.equal(0);
    //                        done();
    //                    });
    //                });
    //            });
    //        });
    //    });
    //});
    //
    //it('save should not return arangodb id', function(done) {
    //    Post.create({ title: 'Post1', content: 'Post content' }, function(err, post) {
    //        post.content = 'AAA';
    //        post.save(function(err, p) {
    //            should.not.exist(err);
    //            should.not.exist(p.id);
    //            p.id.should.be.equal(post.id);
    //            p.content.should.be.equal('AAA');
    //
    //            done();
    //        });
    //    });
    //});
    //
    //it('find should return an object with an id, which is instanceof ObjectID, but not arangodb id', function(done) {
    //    Post.create({ title: 'Post1', content: 'Post content' }, function(err, post) {
    //        Post.findById(post.id, function(err, post) {
    //            should.not.exist(err);
    //            post.id.should.be.an.instanceOf(db.ObjectID);
    //            should.not.exist(post.id);
    //
    //            done();
    //        });
    //    });
    //});
    //
    //describe('updateAll', function() {
    //    it('should update the instance matching criteria', function(done) {
    //        User.create({ name: 'Al', age: 31, email: 'al@strongloop' }, function(err1, createdusers1) {
    //            should.not.exist(err1);
    //            User.create({ name: 'Simon', age: 32,  email: 'simon@strongloop' }, function(err2, createdusers2) {
    //                should.not.exist(err2);
    //                User.create({ name: 'Ray', age: 31,  email: 'ray@strongloop' }, function(err3, createdusers3) {
    //                    should.not.exist(err3);
    //
    //                    User.updateAll({ age: 31 }, { company: 'strongloop.com' }, function(err, updatedusers) {
    //                        should.not.exist(err);
    //                        updatedusers.should.have.property('count', 2);
    //
    //                        User.find({ where: { age: 31 }}, function(err2, foundusers) {
    //                            should.not.exist(err2);
    //                            foundusers[0].company.should.be.equal('strongloop.com');
    //                            foundusers[1].company.should.be.equal('strongloop.com');
    //
    //                            done();
    //                        });
    //                    });
    //                });
    //            });
    //        });
    //    });
    //
    //    it('should clean the data object', function(done) {
    //        User.dataSource.settings.allowExtendedOperators = true;
    //
    //        User.create({ name: 'Al', age: 31, email: 'al@strongloop' }, function(err1, createdusers1) {
    //            should.not.exist(err1);
    //            User.create({ name: 'Simon', age: 32,  email: 'simon@strongloop' }, function(err2, createdusers2) {
    //                should.not.exist(err2);
    //                User.create({ name: 'Ray', age: 31,  email: 'ray@strongloop' }, function(err3, createdusers3) {
    //                    should.not.exist(err3);
    //                    User.updateAll({}, { age: 40, '$set': { age: 39 }}, function(err, updatedusers) {
    //                        should.not.exist(err);
    //                        updatedusers.should.have.property('count', 3);
    //
    //                        User.find({ where: { age: 40 }}, function(err2, foundusers) {
    //                            should.not.exist(err2);
    //                            foundusers.length.should.be.equal(0);
    //
    //                            User.find({ where: { age: 39 }}, function(err3, foundusers) {
    //                                should.not.exist(err3);
    //                                foundusers.length.should.be.equal(3);
    //
    //                                User.updateAll({}, { '$set': { age: 40 }, age: 39 }, function(err, updatedusers) {
    //                                    should.not.exist(err);
    //                                    updatedusers.should.have.property('count', 3);
    //                                    User.find({ where: { age: 40 }}, function(err2, foundusers) {
    //                                        should.not.exist(err2);
    //                                        foundusers.length.should.be.equal(3);
    //                                        User.find({ where: { age: 39 }}, function(err3, foundusers) {
    //                                            should.not.exist(err3);
    //                                            foundusers.length.should.be.equal(0);
    //
    //                                            done();
    //                                        });
    //                                    });
    //                                });
    //                            });
    //                        });
    //                    });
    //                });
    //            });
    //        });
    //    });
    //
    //    var describeMongo26 = describe;
    //    if (process.env.ArangoDB_VERSION &&
    //        !semver.satisfies(process.env.ArangoDB_VERSION, '~2.6.0')) {
    //        describeMongo26 = describe.skip;
    //    }
    //
    //    describeMongo26('extended operators', function() {
    //        it('should use $set by default if no operator is supplied', function(done) {
    //            User.create({ name: 'Al', age: 31, email: 'al@strongloop' }, function(err1, createdusers1) {
    //                should.not.exist(err1);
    //                User.create({ name: 'Simon', age: 32, email: 'simon@strongloop' }, function(err2, createdusers2) {
    //                    should.not.exist(err2);
    //                    User.create({ name: 'Ray', age: 31, email: 'ray@strongloop' }, function(err3, createdusers3) {
    //                        should.not.exist(err3);
    //
    //                        User.updateAll({ name: 'Simon' }, { name: 'Alex' }, function(err, updatedusers) {
    //                            should.not.exist(err);
    //                            updatedusers.should.have.property('count', 1);
    //
    //                            User.find({ where: { name: 'Alex' }}, function(err, founduser) {
    //                                should.not.exist(err);
    //                                founduser.length.should.be.equal(1);
    //                                founduser[0].name.should.be.equal('Alex');
    //
    //                                done();
    //                            });
    //                        });
    //                    });
    //                });
    //            });
    //        });
    //
    //        it('should use $set by default if no operator is supplied (using renamed columns)', function(done) {
    //            User.create({ name: 'Al', age: 31, email: 'al@strongloop' }, function(err1, createdusers1) {
    //                should.not.exist(err1);
    //                User.create({ name: 'Simon', age: 32, email: 'simon@strongloop' }, function(err2, createdusers2) {
    //                    should.not.exist(err2);
    //                    User.create({ name: 'Ray', age: 31, email: 'ray@strongloop' }, function(err3, createdusers3) {
    //                        should.not.exist(err3);
    //
    //                        UserWithRenamedColumns.updateAll({ name: 'Simon' }, { renamedName: 'Alex' }, function(err, updatedusers) {
    //                            should.not.exist(err);
    //                            updatedusers.should.have.property('count', 1);
    //
    //                            User.find({ where: { name: 'Alex' }}, function(err, founduser) {
    //                                should.not.exist(err);
    //                                founduser.length.should.be.equal(1);
    //                                founduser[0].name.should.be.equal('Alex');
    //
    //                                done();
    //                            });
    //                        });
    //                    });
    //                });
    //            });
    //        });
    //
    //        it('should be possible to enable per model settings', function(done) {
    //            User.dataSource.settings.allowExtendedOperators = null;
    //            User.settings.arangodb = { allowExtendedOperators: true };
    //            User.create({ name: 'Al', age: 31, email: 'al@strongloop' }, function(err1, createdusers1) {
    //                should.not.exist(err1);
    //
    //                User.updateAll({ name: 'Al' }, { '$rename': { name: 'firstname' }}, function(err, updatedusers) {
    //                    should.not.exist(err);
    //                    updatedusers.should.have.property('count', 1);
    //
    //                    User.find({ where: { firstname: 'Al' }}, function(err, foundusers) {
    //                        should.not.exist(err);
    //                        foundusers.length.should.be.equal(1);
    //
    //                        done();
    //                    });
    //                });
    //            });
    //        });
    //
    //        it('should not be possible to enable per model settings when globally disabled', function(done) {
    //            User.dataSource.settings.allowExtendedOperators = false;
    //            User.settings.arangodb = { allowExtendedOperators: true };
    //            User.create({ name: 'Al', age: 31, email: 'al@strongloop' }, function(err1, createdusers1) {
    //                should.not.exist(err1);
    //
    //                User.updateAll({ name: 'Al' }, { '$rename': { name: 'firstname' }}, function(err, updatedusers) {
    //                    should.exist(err);
    //                    err.name.should.equal('ArangoError');
    //                    err.errmsg.should.equal('The dollar ($) prefixed ' +
    //                        'field \'$rename\' in \'$rename\' is not valid for storage.');
    //                    done();
    //                });
    //            });
    //        });
    //
    //        it('should not be possible to use when disabled per model settings', function(done) {
    //            User.dataSource.settings.allowExtendedOperators = true;
    //            User.settings.arangodb = { allowExtendedOperators: false };
    //            User.create({ name: 'Al', age: 31, email: 'al@strongloop' }, function(err1, createdusers1) {
    //                should.not.exist(err1);
    //
    //                User.updateAll({ name: 'Al' }, { '$rename': { name: 'firstname' }}, function(err, updatedusers) {
    //                    should.exist(err);
    //                    err.name.should.equal('ArangoError');
    //                    err.errmsg.should.equal('The dollar ($) prefixed ' +
    //                        'field \'$rename\' in \'$rename\' is not valid for storage.');
    //                    done();
    //                });
    //            });
    //        });
    //
    //        it('should be possible to enable using options - even if globally disabled', function(done) {
    //            User.dataSource.settings.allowExtendedOperators = false;
    //            var options = { allowExtendedOperators: true };
    //            User.create({ name: 'Al', age: 31, email: 'al@strongloop' }, function(err1, createdusers1) {
    //                should.not.exist(err1);
    //
    //                User.updateAll({ name: 'Al' }, { '$rename': { name: 'firstname' }}, options, function(err, updatedusers) {
    //                    should.not.exist(err);
    //                    updatedusers.should.have.property('count', 1);
    //
    //                    User.find({ where: { firstname: 'Al' }}, function(err, foundusers) {
    //                        should.not.exist(err);
    //                        foundusers.length.should.be.equal(1);
    //
    //                        done();
    //                    });
    //                });
    //            });
    //        });
    //
    //        it('should be possible to disable using options - even if globally disabled', function(done) {
    //            User.dataSource.settings.allowExtendedOperators = true;
    //            var options = { allowExtendedOperators: false };
    //            User.create({ name: 'Al', age: 31, email: 'al@strongloop' }, function(err1, createdusers1) {
    //                should.not.exist(err1);
    //
    //                User.updateAll({ name: 'Al' }, { '$rename': { name: 'firstname' }}, options, function(err, updatedusers) {
    //                    should.exist(err);
    //                    err.name.should.equal('ArangoError');
    //                    err.errmsg.should.equal('The dollar ($) prefixed ' +
    //                        'field \'$rename\' in \'$rename\' is not valid for storage.');
    //                    done();
    //                });
    //            });
    //        });
    //
    //        it('should be possible to use the $inc operator', function(done) {
    //            User.dataSource.settings.allowExtendedOperators = true;
    //            User.create({ name: 'Al', age: 31, email: 'al@strongloop' }, function(err1, createdusers1) {
    //                should.not.exist(err1);
    //                User.create({ name: 'Simon', age: 32, email: 'simon@strongloop' }, function(err2, createdusers2) {
    //                    should.not.exist(err2);
    //                    User.create({ name: 'Ray', age: 31, email: 'ray@strongloop' }, function(err3, createdusers3) {
    //                        should.not.exist(err3);
    //
    //                        User.updateAll({ name: 'Ray' }, { '$inc': { age: 2 }}, function(err, updatedusers) {
    //                            should.not.exist(err);
    //                            updatedusers.should.have.property('count', 1);
    //
    //                            User.find({ where: { name: 'Ray' }}, function(err, foundusers) {
    //                                should.not.exist(err);
    //                                foundusers.length.should.be.equal(1);
    //                                foundusers[0].age.should.be.equal(33);
    //
    //                                done();
    //                            });
    //                        });
    //                    });
    //                });
    //            });
    //        });
    //
    //        it('should be possible to use the $min and $max operators', function(done) {
    //            User.dataSource.settings.allowExtendedOperators = true;
    //            User.create({ name: 'Simon', age: 32, email: 'simon@strongloop' }, function(err2, createdusers2) {
    //                should.not.exist(err2);
    //
    //                User.updateAll({ name: 'Simon' }, { '$max': { age: 33 }}, function(err, updatedusers) {
    //                    should.not.exist(err);
    //                    updatedusers.should.have.property('count', 1);
    //
    //                    User.updateAll({ name: 'Simon' }, { '$min': { age: 31 }}, function(err, updatedusers) {
    //                        should.not.exist(err);
    //                        updatedusers.should.have.property('count', 1);
    //
    //                        User.find({ where: { name: 'Simon' }}, function(err, foundusers) {
    //                            should.not.exist(err);
    //                            foundusers.length.should.be.equal(1);
    //                            foundusers[0].age.should.be.equal(31);
    //
    //                            done();
    //                        });
    //                    });
    //                });
    //            });
    //        });
    //
    //        it('should be possible to use the $mul operator', function(done) {
    //            User.dataSource.settings.allowExtendedOperators = true;
    //            User.create({ name: 'Al', age: 31, email: 'al@strongloop' }, function(err1, createdusers1) {
    //                should.not.exist(err1);
    //
    //                User.updateAll({ name: 'Al' }, { '$mul': { age: 2 }}, function(err, updatedusers) {
    //                    should.not.exist(err);
    //                    updatedusers.should.have.property('count', 1);
    //
    //                    User.find({ where: { name: 'Al' }}, function(err, foundusers) {
    //                        should.not.exist(err);
    //                        foundusers.length.should.be.equal(1);
    //                        foundusers[0].age.should.be.equal(62);
    //
    //                        done();
    //                    });
    //                });
    //            });
    //        });
    //
    //        it('should be possible to use the $rename operator', function(done) {
    //            User.dataSource.settings.allowExtendedOperators = true;
    //            User.create({ name: 'Al', age: 31, email: 'al@strongloop' }, function(err1, createdusers1) {
    //                should.not.exist(err1);
    //
    //                User.updateAll({ name: 'Al' }, { '$rename': { name: 'firstname' }}, function(err, updatedusers) {
    //                    should.not.exist(err);
    //                    updatedusers.should.have.property('count', 1);
    //
    //                    User.find({ where: { firstname: 'Al' }}, function(err, foundusers) {
    //                        should.not.exist(err);
    //                        foundusers.length.should.be.equal(1);
    //
    //                        done();
    //                    });
    //                });
    //            });
    //        });
    //        it('should be possible to use the $unset operator', function(done) {
    //            User.dataSource.settings.allowExtendedOperators = true;
    //            User.create({ name: 'Al', age: 31, email: 'al@strongloop' }, function(err1, createdusers1) {
    //                should.not.exist(err1);
    //
    //                User.updateAll({ name: 'Al' }, { '$unset': { email: '' }}, function(err, updatedusers) {
    //                    should.not.exist(err);
    //                    updatedusers.should.have.property('count', 1);
    //
    //                    User.find({ where: { name: 'Al' }}, function(err, foundusers) {
    //                        should.not.exist(err);
    //                        foundusers.length.should.be.equal(1);
    //                        should.not.exist(foundusers[0].email);
    //
    //                        done();
    //                    });
    //                });
    //            });
    //        });
    //    });
    //});
    //
    //it('updateOrCreate should update the instance', function(done) {
    //    Post.create({ title: 'a', content: 'AAA' }, function(err, post) {
    //        post.title = 'b';
    //        Post.updateOrCreate(post, function(err, p) {
    //            should.not.exist(err);
    //            p.id.should.be.equal(post.id);
    //            p.content.should.be.equal(post.content);
    //            should.not.exist(p.id);
    //
    //            Post.findById(post.id, function(err, p) {
    //                p.id.should.be.eql(post.id);
    //                should.not.exist(p.id);
    //                p.content.should.be.equal(post.content);
    //                p.title.should.be.equal('b');
    //
    //                done();
    //            });
    //        });
    //    });
    //});
    //
    //it('updateAttributes should update the instance', function(done) {
    //    Post.create({ title: 'a', content: 'AAA' }, function(err, post) {
    //        post.updateAttributes({ title: 'b' }, function(err, p) {
    //            should.not.exist(err);
    //            p.id.should.be.equal(post.id);
    //            p.title.should.be.equal('b');
    //
    //            Post.findById(post.id, function(err, p) {
    //                p.id.should.be.eql(post.id);
    //                p.title.should.be.equal('b');
    //
    //                done();
    //            });
    //        });
    //    });
    //});
    //
    //it('updateAttributes should not throw an error when no attributes are given', function(done) {
    //    Post.create({ title: 'a', content: 'AAA' }, function(err, post) {
    //        post.updateAttributes({}, function(err, p) {
    //            should.not.exist(err);
    //            p.id.should.be.equal(post.id);
    //            p.title.should.be.equal('a');
    //
    //            done();
    //        });
    //    });
    //});
    //
    //it('updateAttributes: $addToSet should append item to an Array if it doesn\'t already exist', function(done) {
    //    Product.dataSource.settings.allowExtendedOperators = true;
    //    Product.create({ name: 'bread', price: 100, pricehistory: [{ '2014-11-11': 90 }] },
    //        function(err, product) {
    //            var newattributes = { $set: { description: 'goes well with butter' },
    //                $addToSet: { pricehistory: { '2014-12-12': 110 }}};
    //            product.updateAttributes(newattributes, function(err1, inst) {
    //                should.not.exist(err1);
    //
    //                Product.findById(product.id, function(err2, updatedproduct) {
    //                    should.not.exist(err2);
    //                    should.not.exist(updatedproduct.id);
    //                    updatedproduct.id.should.be.eql(product.id);
    //                    updatedproduct.name.should.be.equal(product.name);
    //                    updatedproduct.description.should.be.equal('goes well with butter');
    //                    updatedproduct.pricehistory[0]['2014-11-11'].should.be.equal(90);
    //                    updatedproduct.pricehistory[1]['2014-12-12'].should.be.equal(110);
    //                    done();
    //                });
    //            });
    //        });
    //});
    //
    //it('updateOrCreate: $addToSet should append item to an Array if it doesn\'t already exist', function(done) {
    //    Product.dataSource.settings.allowExtendedOperators = true;
    //    Product.create({ name: 'bread', price: 100, pricehistory: [{ '2014-11-11': 90 }] }, function(err, product) {
    //        product.$set = { description: 'goes well with butter' };
    //        product.$addToSet = { pricehistory: { '2014-12-12': 110 }};
    //
    //        Product.updateOrCreate(product, function(err, updatedproduct) {
    //            should.not.exist(err);
    //            should.not.exist(updatedproduct.id);
    //            updatedproduct.id.should.be.eql(product.id);
    //            updatedproduct.name.should.be.equal(product.name);
    //            updatedproduct.description.should.be.equal('goes well with butter');
    //            updatedproduct.pricehistory[0]['2014-11-11'].should.be.equal(90);
    //            updatedproduct.pricehistory[1]['2014-12-12'].should.be.equal(110);
    //            done();
    //        });
    //    });
    //});
    //
    //it('updateOrCreate: $addToSet should not append item to an Array if it does already exist', function(done) {
    //    Product.dataSource.settings.allowExtendedOperators = true;
    //    Product.create({ name: 'bread', price: 100, pricehistory: [{ '2014-11-11': 90 }, { '2014-10-10': 80 }] },
    //        function(err, product) {
    //            product.$set = { description: 'goes well with butter' };
    //            product.$addToSet = { pricehistory: { '2014-10-10': 80 }};
    //
    //            Product.updateOrCreate(product, function(err, updatedproduct) {
    //                should.not.exist(err);
    //                should.not.exist(updatedproduct.id);
    //                updatedproduct.id.should.be.eql(product.id);
    //                updatedproduct.name.should.be.equal(product.name);
    //                updatedproduct.description.should.be.equal('goes well with butter');
    //                updatedproduct.pricehistory[0]['2014-11-11'].should.be.equal(90);
    //                updatedproduct.pricehistory[1]['2014-10-10'].should.be.equal(80);
    //                done();
    //            });
    //        });
    //});
    //
    //it('updateAttributes: $addToSet should not append item to an Array if it does already exist', function(done) {
    //    Product.dataSource.settings.allowExtendedOperators = true;
    //    Product.create({ name: 'bread', price: 100, pricehistory: [{ '2014-11-11': 90 }, { '2014-10-10': 80 }] },
    //        function(err, product) {
    //            var newattributes = { $set: { description: 'goes well with butter' },
    //                $addToSet: { pricehistory: { '2014-12-12': 110 }}};
    //            product.updateAttributes(newattributes, function(err1, inst) {
    //                should.not.exist(err1);
    //
    //                Product.findById(product.id, function(err2, updatedproduct) {
    //                    should.not.exist(err2);
    //                    should.not.exist(updatedproduct.id);
    //                    updatedproduct.id.should.be.eql(product.id);
    //                    updatedproduct.name.should.be.equal(product.name);
    //                    updatedproduct.description.should.be.equal('goes well with butter');
    //                    updatedproduct.pricehistory[0]['2014-11-11'].should.be.equal(90);
    //                    updatedproduct.pricehistory[1]['2014-10-10'].should.be.equal(80);
    //                    done();
    //                });
    //            });
    //        });
    //});
    //
    //
    //it('updateAttributes: $pop should remove first or last item from an Array', function(done) {
    //    Product.dataSource.settings.allowExtendedOperators = true;
    //    Product.create({ name: 'bread', price: 100, pricehistory:
    //        [{ '2014-11-11': 90 }, { '2014-10-10': 80 }, { '2014-09-09': 70 }] }, function(err, product) {
    //        var newattributes = { $set: { description: 'goes well with butter' }, $addToSet: { pricehistory: 1 }};
    //        product.updateAttributes(newattributes, function(err1, inst) {
    //            should.not.exist(err1);
    //
    //            Product.findById(product.id, function(err2, updatedproduct) {
    //                should.not.exist(err2);
    //                should.not.exist(updatedproduct.id);
    //                updatedproduct.id.should.be.eql(product.id);
    //                updatedproduct.name.should.be.equal(product.name);
    //                updatedproduct.description.should.be.equal('goes well with butter');
    //                updatedproduct.pricehistory[0]['2014-11-11'].should.be.equal(90);
    //                updatedproduct.pricehistory[1]['2014-10-10'].should.be.equal(80);
    //                done();
    //            });
    //        });
    //    });
    //});
    //
    //it('updateOrCreate: $pop should remove first or last item from an Array', function(done) {
    //    Product.dataSource.settings.allowExtendedOperators = true;
    //    Product.create({ name: 'bread', price: 100,
    //        pricehistory: [{ '2014-11-11': 90 }, { '2014-10-10': 80 }, { '2014-09-09': 70 }] }, function(err, product) {
    //        product.$set = { description: 'goes well with butter' };
    //        product.$pop = { pricehistory: 1 };
    //
    //        Product.updateOrCreate(product, function(err, updatedproduct) {
    //            should.not.exist(err);
    //            should.not.exist(updatedproduct.id);
    //            updatedproduct.id.should.be.eql(product.id);
    //            updatedproduct.name.should.be.equal(product.name);
    //            updatedproduct.description.should.be.equal('goes well with butter');
    //            updatedproduct.pricehistory[0]['2014-11-11'].should.be.equal(90);
    //            updatedproduct.pricehistory[1]['2014-10-10'].should.be.equal(80);
    //
    //            updatedproduct.$pop = { pricehistory: -1 };
    //            Product.updateOrCreate(product, function(err, p) {
    //                should.not.exist(err);
    //                should.not.exist(p.id);
    //                updatedproduct.pricehistory[0]['2014-10-10'].should.be.equal(80);
    //                done();
    //            });
    //        });
    //    });
    //});
    //
    //it('updateAttributes: $pull should remove items from an Array if they match a criteria', function(done) {
    //    Product.dataSource.settings.allowExtendedOperators = true;
    //    Product.create({ name: 'bread', price: 100, pricehistory: [70, 80, 90, 100] }, function(err, product) {
    //        var newattributes = { $set: { description: 'goes well with butter' },
    //            $pull: { pricehistory: { $gte: 90 }}};
    //        product.updateAttributes(newattributes, function(err1, updatedproduct) {
    //            should.not.exist(err1);
    //            Product.findById(product.id, function(err2, updatedproduct) {
    //                should.not.exist(err1);
    //                should.not.exist(updatedproduct.id);
    //                updatedproduct.id.should.be.eql(product.id);
    //                updatedproduct.name.should.be.equal(product.name);
    //                updatedproduct.description.should.be.equal('goes well with butter');
    //                updatedproduct.pricehistory[0].should.be.equal(70);
    //                updatedproduct.pricehistory[1].should.be.equal(80);
    //
    //                done();
    //            });
    //        });
    //    });
    //});
    //
    //it('updateOrCreate: $pull should remove items from an Array if they match a criteria', function(done) {
    //    Product.dataSource.settings.allowExtendedOperators = true;
    //    Product.create({ name: 'bread', price: 100, pricehistory: [70, 80, 90, 100] },
    //        function(err, product) {
    //            product.$set = { description: 'goes well with butter' };
    //            product.$pull = { pricehistory: { $gte: 90 }};
    //
    //            Product.updateOrCreate(product, function(err, updatedproduct) {
    //                should.not.exist(err);
    //                should.not.exist(updatedproduct.id);
    //                updatedproduct.id.should.be.eql(product.id);
    //                updatedproduct.name.should.be.equal(product.name);
    //                updatedproduct.description.should.be.equal('goes well with butter');
    //                updatedproduct.pricehistory[0].should.be.equal(70);
    //                updatedproduct.pricehistory[1].should.be.equal(80);
    //
    //                done();
    //            });
    //        });
    //});
    //
    //it('updateAttributes: $pullAll should remove items from an Array if they match a value from a list', function(done) {
    //    Product.dataSource.settings.allowExtendedOperators = true;
    //    Product.create({ name: 'bread', price: 100, pricehistory: [70, 80, 90, 100] }, function(err, product) {
    //        var newattributes = { $set: { description: 'goes well with butter' },
    //            $pullAll: { pricehistory: [80, 100] }};
    //        product.updateAttributes(newattributes, function(err1, inst) {
    //            should.not.exist(err1);
    //
    //            Product.findById(product.id, function(err2, updatedproduct) {
    //                should.not.exist(err2);
    //                should.not.exist(updatedproduct.id);
    //                updatedproduct.id.should.be.eql(product.id);
    //                updatedproduct.name.should.be.equal(product.name);
    //                updatedproduct.description.should.be.equal('goes well with butter');
    //                updatedproduct.pricehistory[0].should.be.equal(70);
    //                updatedproduct.pricehistory[1].should.be.equal(90);
    //
    //                done();
    //            });
    //        });
    //    });
    //});
    //
    //it('updateOrCreate: $pullAll should remove items from an Array if they match a value from a list', function(done) {
    //    Product.dataSource.settings.allowExtendedOperators = true;
    //    Product.create({ name: 'bread', price: 100, pricehistory: [70, 80, 90, 100] },
    //        function(err, product) {
    //            product.$set = { description: 'goes well with butter' };
    //            product.$pullAll = { pricehistory: [80, 100] };
    //
    //            Product.updateOrCreate(product, function(err, updatedproduct) {
    //                should.not.exist(err);
    //                should.not.exist(updatedproduct.id);
    //                updatedproduct.id.should.be.eql(product.id);
    //                updatedproduct.name.should.be.equal(product.name);
    //                updatedproduct.description.should.be.equal('goes well with butter');
    //                updatedproduct.pricehistory[0].should.be.equal(70);
    //                updatedproduct.pricehistory[1].should.be.equal(90);
    //
    //                done();
    //            });
    //        });
    //});
    //
    //
    //it('updateAttributes: $push should append item to an Array even if it does already exist', function(done) {
    //    Product.dataSource.settings.allowExtendedOperators = true;
    //    Product.create({ name: 'bread', price: 100, pricehistory:
    //        [{ '2014-11-11': 90 }, { '2014-10-10': 80 }] }, function(err, product) {
    //        var newattributes = { $set: { description: 'goes well with butter' },
    //            $push: { pricehistory: { '2014-10-10': 80 }}};
    //
    //        product.updateAttributes(newattributes, function(err1, inst) {
    //            should.not.exist(err1);
    //
    //            Product.findById(product.id, function(err2, updatedproduct) {
    //                should.not.exist(err2);
    //                should.not.exist(updatedproduct.id);
    //                updatedproduct.id.should.be.eql(product.id);
    //                updatedproduct.name.should.be.equal(product.name);
    //                updatedproduct.description.should.be.equal('goes well with butter');
    //                updatedproduct.pricehistory[0]['2014-11-11'].should.be.equal(90);
    //                updatedproduct.pricehistory[1]['2014-10-10'].should.be.equal(80);
    //                updatedproduct.pricehistory[2]['2014-10-10'].should.be.equal(80);
    //
    //                done();
    //            });
    //        });
    //    });
    //});
    //
    //it('updateOrCreate: $push should append item to an Array even if it does already exist', function(done) {
    //    Product.dataSource.settings.allowExtendedOperators = true;
    //    Product.create({ name: 'bread', price: 100, pricehistory: [{ '2014-11-11': 90 },
    //        { '2014-10-10': 80 }] }, function(err, product) {
    //        product.$set = { description: 'goes well with butter' };
    //        product.$push = { pricehistory: { '2014-10-10': 80 }};
    //
    //        Product.updateOrCreate(product, function(err, updatedproduct) {
    //            should.not.exist(err);
    //            should.not.exist(updatedproduct.id);
    //            updatedproduct.id.should.be.eql(product.id);
    //            updatedproduct.name.should.be.equal(product.name);
    //            updatedproduct.description.should.be.equal('goes well with butter');
    //            updatedproduct.pricehistory[0]['2014-11-11'].should.be.equal(90);
    //            updatedproduct.pricehistory[1]['2014-10-10'].should.be.equal(80);
    //            updatedproduct.pricehistory[2]['2014-10-10'].should.be.equal(80);
    //            done();
    //        });
    //    });
    //});
    //
    //describe('replaceOrCreate', function() {
    //    it('should create a model instance even if it already exists', function(done) {
    //        Product.replaceOrCreate({ name: 'newFoo' }, function(err, updatedProduct) {
    //            if (err)  return done(err);
    //            should.not.exist(updatedProduct.id);
    //            should.exist(updatedProduct.id);
    //            verifyData(updatedProduct.id);
    //        });
    //        function verifyData(id) {
    //            Product.findById(id, function(err, data) {
    //                data.name.should.be.equal('newFoo');
    //                done(err);
    //            });
    //        };
    //    });
    //
    //    it('should replace a model instance if the passing key already exists', function(done) {
    //        Product.create({ name: 'bread', price: 100 }, function(err, product) {
    //            if (err)  return done(err);
    //            replaceOrCreate({ id: product.id, name: 'milk' });
    //        });
    //        function replaceOrCreate(data) {
    //            Product.replaceOrCreate(data, function(err, updatedProduct) {
    //                if (err)  return done(err);
    //                should.not.exist(updatedProduct.id);
    //                updatedProduct.name.should.be.equal('milk');
    //                should.exist(updatedProduct.id);
    //                verify(data.id);
    //            });
    //        }
    //        function verify(id) {
    //            Product.findById(id, function(err, data) {
    //                data.name.should.be.equal('milk');
    //                should.not.exist(data.price);
    //                done(err);
    //            });
    //        }
    //    });
    //
    //    it('should remove extraneous properties that are not defined in the model', function(done) {
    //        Product.create({ name: 'bread', price: 100, bar: 'baz' }, function(err, product) {
    //            if (err)  return done(err);
    //            replaceOrCreate({ id: product.id, name: 'milk' });
    //        });
    //        function replaceOrCreate(data) {
    //            Product.replaceOrCreate(data, function(err, updatedProduct) {
    //                if (err)  return done(err);
    //                should.not.exist(updatedProduct.bar);
    //                verify(data.id);
    //            });
    //        }
    //        function verify(id) {
    //            Product.findById(id, function(err, data) {
    //                should.not.exist(data.bar);
    //                done(err);
    //            });
    //        }
    //    });
    //});
    //
    //describe('replace', function() {
    //    it('should replace the model instance if the provided key already exists', function(done) {
    //        Product.create({ name: 'bread', price: 100 }, function(err, product) {
    //            if (err)  return done(err);
    //            replace(product, { name: 'milk' }, product.id);
    //        });
    //        function replace(product, data, id) {
    //            product.replaceAttributes(data, function(err, updatedProduct) {
    //                if (err)  return done(err);
    //                should.not.exist(updatedProduct.id);
    //                updatedProduct.name.should.be.equal('milk');
    //                should.exist(updatedProduct.id);
    //                verify(id);
    //            });
    //        }
    //        function verify(id) {
    //            Product.findById(id, function(err, data) {
    //                data.name.should.be.equal('milk');
    //                should.not.exist(data.price);
    //                done(err);
    //            });
    //        }
    //    });
    //
    //    it('should remove extraneous properties that are not defined in the model', function(done) {
    //        Product.create({ name: 'bread', price: 100, bar: 'baz' }, function(err, product) {
    //            if (err)  return done(err);
    //            replace(product, { name: 'milk' }, product.id);
    //        });
    //        function replace(product, data, id) {
    //            product.replaceAttributes(data, function(err, updatedProduct) {
    //                if (err)  return done(err);
    //                should.not.exist(updatedProduct.bar);
    //                verify(id);
    //            });
    //        }
    //        function verify(id) {
    //            Product.findById(id, function(err, data) {
    //                data.name.should.be.equal('milk');
    //                should.not.exist(data.bar);
    //                done(err);
    //            });
    //        }
    //    });
    //});
    //
    //it('updateOrCreate: should handle combination of operators and top level properties without errors', function(done) {
    //    Product.dataSource.settings.allowExtendedOperators = true;
    //    Product.create({ name: 'bread', price: 100, ingredients: ['flour'],
    //        pricehistory: [{ '2014-11-11': 90 }, { '2014-10-10': 80 }] }, function(err, product) {
    //        product.$set = { description: 'goes well with butter' };
    //        product.$push = { ingredients: 'water' };
    //        product.$addToSet = { pricehistory: { '2014-09-09': 70 }};
    //        product.description = 'alternative description';
    //        Product.updateOrCreate(product, function(err, updatedproduct) {
    //            should.not.exist(err);
    //            should.not.exist(updatedproduct.id);
    //            updatedproduct.id.should.be.eql(product.id);
    //            updatedproduct.name.should.be.equal(product.name);
    //            updatedproduct.description.should.be.equal('goes well with butter');
    //            updatedproduct.ingredients[0].should.be.equal('flour');
    //            updatedproduct.ingredients[1].should.be.equal('water');
    //            updatedproduct.pricehistory[0]['2014-11-11'].should.be.equal(90);
    //            updatedproduct.pricehistory[1]['2014-10-10'].should.be.equal(80);
    //            updatedproduct.pricehistory[2]['2014-09-09'].should.be.equal(70);
    //
    //            done();
    //        });
    //    });
    //});
    //
    //
    //it('updateOrCreate should update the instance without removing existing properties', function(done) {
    //    Post.create({ title: 'a', content: 'AAA', comments: ['Comment1'] }, function(err, post) {
    //        post = post.toObject();
    //        delete post.title;
    //        delete post.comments;
    //        Post.updateOrCreate(post, function(err, p) {
    //            should.not.exist(err);
    //            p.id.should.be.equal(post.id);
    //            p.content.should.be.equal(post.content);
    //            should.not.exist(p.id);
    //
    //            Post.findById(post.id, function(err, p) {
    //                p.id.should.be.eql(post.id);
    //                should.not.exist(p.id);
    //                p.content.should.be.equal(post.content);
    //                p.title.should.be.equal('a');
    //                p.comments[0].should.be.equal('Comment1');
    //
    //                done();
    //            });
    //        });
    //    });
    //});
    //
    //it('updateOrCreate should create a new instance if it does not exist', function(done) {
    //    var post = { id: '123', title: 'a', content: 'AAA' };
    //    Post.updateOrCreate(post, function(err, p) {
    //        should.not.exist(err);
    //        p.title.should.be.equal(post.title);
    //        p.content.should.be.equal(post.content);
    //        p.id.should.be.eql(post.id);
    //
    //        Post.findById(p.id, function(err, p) {
    //            p.id.should.be.equal(post.id);
    //            should.not.exist(p.id);
    //            p.content.should.be.equal(post.content);
    //            p.title.should.be.equal(post.title);
    //            p.id.should.be.equal(post.id);
    //
    //            done();
    //        });
    //    });
    //});
    //
    //it('save should update the instance with the same id', function(done) {
    //    Post.create({ title: 'a', content: 'AAA' }, function(err, post) {
    //        post.title = 'b';
    //        post.save(function(err, p) {
    //            should.not.exist(err);
    //            p.id.should.be.equal(post.id);
    //            p.content.should.be.equal(post.content);
    //            should.not.exist(p.id);
    //
    //            Post.findById(post.id, function(err, p) {
    //                p.id.should.be.eql(post.id);
    //                should.not.exist(p.id);
    //                p.content.should.be.equal(post.content);
    //                p.title.should.be.equal('b');
    //
    //                done();
    //            });
    //        });
    //    });
    //});
    //
    //it('save should update the instance without removing existing properties', function(done) {
    //    Post.create({ title: 'a', content: 'AAA' }, function(err, post) {
    //        delete post.title;
    //        post.save(function(err, p) {
    //            should.not.exist(err);
    //            p.id.should.be.equal(post.id);
    //            p.content.should.be.equal(post.content);
    //            should.not.exist(p.id);
    //
    //            Post.findById(post.id, function(err, p) {
    //                p.id.should.be.eql(post.id);
    //                should.not.exist(p.id);
    //                p.content.should.be.equal(post.content);
    //                p.title.should.be.equal('a');
    //
    //                done();
    //            });
    //        });
    //    });
    //});
    //
    //it('save should create a new instance if it does not exist', function(done) {
    //    var post = new Post({ id: '123', title: 'a', content: 'AAA' });
    //    post.save(post, function(err, p) {
    //        should.not.exist(err);
    //        p.title.should.be.equal(post.title);
    //        p.content.should.be.equal(post.content);
    //        p.id.should.be.equal(post.id);
    //
    //        Post.findById(p.id, function(err, p) {
    //            p.id.should.be.equal(post.id);
    //            should.not.exist(p.id);
    //            p.content.should.be.equal(post.content);
    //            p.title.should.be.equal(post.title);
    //            p.id.should.be.equal(post.id);
    //
    //            done();
    //        });
    //    });
    //});
    //it('all should return object with an id, which is instanceof ObjectID, but not arangodb id', function(done) {
    //    var post = new Post({ title: 'a', content: 'AAA' });
    //    post.save(function(err, post) {
    //        Post.all({ where: { title: 'a' }}, function(err, posts) {
    //            should.not.exist(err);
    //            posts.should.have.lengthOf(1);
    //            post = posts[0];
    //            post.should.have.property('title', 'a');
    //            post.should.have.property('content', 'AAA');
    //            post.id.should.be.an.instanceOf(db.ObjectID);
    //            should.not.exist(post.id);
    //
    //            done();
    //        });
    //    });
    //});
    //
    //it('all return should honor filter.fields', function(done) {
    //    var post = new Post({ title: 'b', content: 'BBB' });
    //    post.save(function(err, post) {
    //        Post.all({ fields: ['title'], where: { title: 'b' }}, function(err, posts) {
    //            should.not.exist(err);
    //            posts.should.have.lengthOf(1);
    //            post = posts[0];
    //            post.should.have.property('title', 'b');
    //            post.should.have.property('content', undefined);
    //            should.not.exist(post.id);
    //            should.not.exist(post.id);
    //
    //            done();
    //        });
    //    });
    //});
    //
    //it('create should convert id from ObjectID to string', function(done) {
    //    var oid = new db.ObjectID();
    //    var sid = oid.toString();
    //    PostWithStringId.create({ id: oid, title: 'c', content: 'CCC' }, function(err, post) {
    //        post.id.should.be.a.string;
    //        PostWithStringId.findById(oid, function(err, post) {
    //            should.not.exist(err);
    //            should.not.exist(post.id);
    //            post.id.should.be.a.string;
    //            post.id.should.be.equal(sid);
    //
    //            done();
    //        });
    //    });
    //});
    //
    //it('create should convert id from string to ObjectID', function(done) {
    //    var oid = new db.ObjectID();
    //    var sid = oid.toString();
    //    Post.create({ id: sid, title: 'c', content: 'CCC' }, function(err, post) {
    //        post.id.should.be.an.instanceOf(db.ObjectID);
    //        Post.findById(sid, function(err, post) {
    //            should.not.exist(err);
    //            should.not.exist(post.id);
    //            post.id.should.be.an.instanceOf(db.ObjectID);
    //            post.id.should.be.eql(oid);
    //
    //            done();
    //        });
    //    });
    //});
    //
    //it('create should convert id from string to ObjectID - Array property', function(done) {
    //    Post.create({ title: 'c', content: 'CCC' }, function(err, post) {
    //        Category.create({ title: 'a', posts: [String(post.id)] }, function(err, category) {
    //            category.id.should.be.an.instanceOf(db.ObjectID);
    //            category.posts[0].should.be.an.instanceOf(db.ObjectID);
    //            Category.findOne({ where: { posts: post.id }}, function(err, c) {
    //                should.not.exist(err);
    //                c.id.should.be.an.instanceOf(db.ObjectID);
    //                c.posts[0].should.be.an.instanceOf(db.ObjectID);
    //                c.id.should.be.eql(category.id);
    //
    //                done();
    //            });
    //        });
    //    });
    //});
    //
    //it('create should support renamed column names (using property syntax first)',
    //    function(done) {
    //        var oid = new db.ObjectID().toString();
    //        PostWithStringId.create({ id: oid, title: 'c', content: 'CCC' }, function(err, post) {
    //            PostWithStringIdAndRenamedColumns.findById(oid, function(err, post) {
    //                should.not.exist(err);
    //                should.not.exist(post.id);
    //                post.id.should.be.equal(oid);
    //
    //                should.exist(post.renamedTitle);
    //                should.exist(post.renamedContent);
    //                post.renamedTitle.should.be.equal('c');
    //                post.renamedContent.should.be.equal('CCC');
    //
    //                done();
    //            });
    //        });
    //    });
    //
    //it('create should support renamed column names (using db syntax first)',
    //    function(done) {
    //        var oid = new db.ObjectID().toString();
    //        PostWithStringIdAndRenamedColumns.create({ id: oid, renamedTitle: 'c',
    //            renamedContent: 'CCC' }, function(err, post) {
    //            PostWithStringId.findById(oid, function(err, post) {
    //                should.not.exist(err);
    //                should.not.exist(post.id);
    //                post.id.should.be.equal(oid);
    //
    //                should.exist(post.title);
    //                should.exist(post.content);
    //                post.title.should.be.equal('c');
    //                post.content.should.be.equal('CCC');
    //
    //                done();
    //            });
    //        });
    //    });
    //
    //describe('geo queries', function() {
    //    var geoDb, PostWithLocation, createLocationPost;
    //
    //    before(function() {
    //        var config = JSON.parse(JSON.stringify(global.config)); // clone config
    //        config.enableGeoIndexing = true;
    //
    //        geoDb = getDataSource(config);
    //
    //        PostWithLocation = geoDb.define('PostWithLocation', {
    //            id: { type: geoDb.ObjectID, id: true },
    //            location: { type: GeoPoint },
    //        });
    //        createLocationPost = function(far) {
    //            var point;
    //            if (far) {
    //                point = new GeoPoint({
    //                    lat: 31.230416,
    //                    lng: 121.473701,
    //                });
    //            } else {
    //                point = new GeoPoint({
    //                    lat: 30.27167 + Math.random() * 0.01,
    //                    lng: 120.13469600000008 + Math.random() * 0.01,
    //                });
    //            }
    //            return function(callback) {
    //                PostWithLocation.create({ location: point }, callback);
    //            };
    //        };
    //    });
    //
    //    beforeEach(function(done) {
    //        PostWithLocation.destroyAll(done);
    //    });
    //
    //    it('create should convert geopoint to geojson', function(done) {
    //        var point = new GeoPoint({ lat: 1.243, lng: 20.40 });
    //
    //        PostWithLocation.create({ location: point }, function(err, post) {
    //            should.not.exist(err);
    //            point.lat.should.be.equal(post.location.lat);
    //            point.lng.should.be.equal(post.location.lng);
    //
    //            done();
    //        });
    //    });
    //
    //    it('find should be able to query by location', function(done) {
    //        var coords = { lat: 1.25, lng: 20.20 };
    //
    //        geoDb.autoupdate(function(err) {
    //            var createPost = function(callback) {
    //                var point = new GeoPoint({
    //                    lat: (Math.random() * 180) - 90,
    //                    lng: (Math.random() * 360) - 180,
    //                });
    //
    //                PostWithLocation.create({ location: point }, callback);
    //            };
    //
    //            async.parallel([
    //                createPost.bind(null),
    //                createPost.bind(null),
    //                createPost.bind(null),
    //                createPost.bind(null),
    //            ], function(err) {
    //                should.not.exist(err);
    //
    //                PostWithLocation.find({
    //                    where: {
    //                        location: {
    //                            near: new GeoPoint(coords),
    //                        },
    //                    },
    //                }, function(err, results) {
    //                    should.not.exist(err);
    //                    should.exist(results);
    //
    //                    var dist = 0;
    //                    results.forEach(function(result) {
    //                        var currentDist = testUtils.getDistanceBetweenPoints(coords, result.location);
    //                        currentDist.should.be.aboveOrEqual(dist);
    //                        dist = currentDist;
    //                    });
    //
    //                    done();
    //                });
    //            });
    //        });
    //    });
    //
    //    it('find should be queryable using locations with deep/multiple keys', function(done) {
    //        var coords = { lat: 1.25, lng: 20.20 };
    //
    //        geoDb.autoupdate(function(err) {
    //            var heroNumber = 0;
    //            var powers = ['fly', 'lasers', 'strength', 'drink'];
    //
    //            function createSuperheroWithLocation(callback) {
    //                heroNumber++;
    //
    //                Superhero.create({
    //                    name: 'Hero #' + heroNumber,
    //                    power: powers[heroNumber - 1],
    //                    location: {
    //                        type: 'Feature',
    //                        geometry: {
    //                            type: 'Point',
    //                            coordinates: [
    //                                coords.lng,
    //                                coords.lat,
    //                            ],
    //                        },
    //                    },
    //                }, callback);
    //            };
    //
    //            async.parallel([
    //                createSuperheroWithLocation,
    //                createSuperheroWithLocation,
    //                createSuperheroWithLocation,
    //            ], function(err) {
    //                if (err) return done(err);
    //
    //                Superhero.find({
    //                    where: {
    //                        and: [
    //                            {
    //                                'location.geometry': {
    //                                    near: [
    //                                        coords.lng,
    //                                        coords.lat,
    //                                    ],
    //                                    maxDistance: 50,
    //                                },
    //                            },
    //                            {
    //                                power: 'strength',
    //                            },
    //                        ],
    //                    },
    //                }, function(err, results) {
    //                    if (err) return done(err);
    //
    //                    results.should.have.length(1);
    //
    //                    var dist = 0;
    //                    results.forEach(function(result) {
    //                        var currentDist = testUtils.getDistanceBetweenPoints(coords, {
    //                            lng: result.location.geometry.coordinates[0],
    //                            lat: result.location.geometry.coordinates[1],
    //                        });
    //                        currentDist.should.be.aboveOrEqual(dist);
    //                        dist = currentDist;
    //                    });
    //
    //                    done();
    //                });
    //            });
    //        });
    //    });
    //
    //    it('find should be able to query by location via near with maxDistance', function(done) {
    //        var coords = { lat: 30.274085, lng: 120.15507000000002 };
    //
    //        geoDb.autoupdate(function(err) {
    //            async.parallel([
    //                createLocationPost(false),
    //                createLocationPost(false),
    //                createLocationPost(false),
    //                createLocationPost(true),
    //            ], function(err) {
    //                if (err) return done(err);
    //                PostWithLocation.find({
    //                    where: {
    //                        location: {
    //                            near: new GeoPoint(coords),
    //                            maxDistance: 17000,
    //                            unit: 'meters',
    //                        },
    //                    },
    //                }, function(err, results) {
    //                    if (err) return done(err);
    //                    results.length.should.be.equal(3);
    //                    var dist = 0;
    //                    results.forEach(function(result) {
    //                        var currentDist = testUtils.getDistanceBetweenPoints(coords, result.location);
    //                        currentDist.should.be.aboveOrEqual(dist);
    //                        currentDist.should.be.belowOrEqual(17);
    //                        dist = currentDist;
    //                    });
    //                    done();
    //                });
    //            });
    //        });
    //    });
    //
    //    it('find should be able to query by location via near with minDistance set', function(done) {
    //        var coords = { lat: 30.274085, lng: 120.15507000000002 };
    //        geoDb.autoupdate(function(err) {
    //            async.parallel([
    //                createLocationPost(false),
    //                createLocationPost(false),
    //                createLocationPost(false),
    //                createLocationPost(true),
    //            ], function(err) {
    //                if (err) return done(err);
    //                PostWithLocation.find({
    //                    where: {
    //                        location: {
    //                            near: new GeoPoint(coords),
    //                            minDistance: 17000,
    //                            unit: 'meters',
    //                        },
    //                    },
    //                }, function(err, results) {
    //                    if (err) return done(err);
    //                    results.length.should.be.equal(1);
    //                    var dist = 0;
    //                    results.forEach(function(result) {
    //                        var currentDist = testUtils.getDistanceBetweenPoints(coords, result.location);
    //                        currentDist.should.be.aboveOrEqual(dist);
    //                        dist = currentDist;
    //                    });
    //                    done();
    //                });
    //            });
    //        });
    //    });
    //
    //    it('find should be able to set unit when query location via near', function(done) {
    //        var coords = { lat: 30.274085, lng: 120.15507000000002 };
    //
    //        geoDb.autoupdate(function(err) {
    //            var queryLocation = function(distance, unit, distanceInMeter, numOfResult) {
    //                return function(callback) {
    //                    PostWithLocation.find({
    //                        where: {
    //                            location: {
    //                                near: new GeoPoint(coords),
    //                                maxDistance: distance,
    //                                unit: unit,
    //                            },
    //                        },
    //                    }, function(err, results) {
    //                        if (err) return done(err);
    //                        results.length.should.be.equal(numOfResult);
    //                        results.forEach(function(result) {
    //                            var currentDist = testUtils.getDistanceBetweenPoints(coords, result.location);
    //                            currentDist.should.be.belowOrEqual(distanceInMeter / 1000);
    //                        });
    //                        callback();
    //                    });
    //                };
    //            };
    //
    //
    //            async.parallel([
    //                createLocationPost(false),
    //                createLocationPost(false),
    //                createLocationPost(false),
    //                createLocationPost(true),
    //            ], function(err) {
    //                if (err) return done(err);
    //                async.parallel([
    //                    queryLocation(10000, undefined, 10000, 3),
    //                    queryLocation(10, 'miles', 16000, 3),
    //                    queryLocation(10, 'kilometers', 10000, 3),
    //                    queryLocation(20000, 'feet', 6096, 3),
    //                    queryLocation(10000, 'radians', 10000, 3),
    //                    queryLocation(10000, 'degrees', 10000, 3),
    //                ], done);
    //            });
    //        });
    //    });
    //
    //    afterEach(function(done) {
    //        PostWithLocation.destroyAll(done);
    //    });
    //});
    //
    //it('find should order by id if the order is not set for the query filter',
    //    function(done) {
    //        PostWithStringId.create({ id: '2', title: 'c', content: 'CCC' }, function(err, post) {
    //            PostWithStringId.create({ id: '1', title: 'd', content: 'DDD' }, function(err, post) {
    //                PostWithStringId.find(function(err, posts) {
    //                    should.not.exist(err);
    //                    posts.length.should.be.equal(2);
    //                    posts[0].id.should.be.equal('1');
    //
    //                    PostWithStringId.find({ limit: 1, offset: 0 }, function(err, posts) {
    //                        should.not.exist(err);
    //                        posts.length.should.be.equal(1);
    //                        posts[0].id.should.be.equal('1');
    //
    //                        PostWithStringId.find({ limit: 1, offset: 1 }, function(err, posts) {
    //                            should.not.exist(err);
    //                            posts.length.should.be.equal(1);
    //                            posts[0].id.should.be.equal('2');
    //                            done();
    //                        });
    //                    });
    //                });
    //            });
    //        });
    //    });
    //
    //it('should report error on duplicate keys', function(done) {
    //    Post.create({ title: 'd', content: 'DDD' }, function(err, post) {
    //        Post.create({ id: post.id, title: 'd', content: 'DDD' }, function(err, post) {
    //            should.exist(err);
    //            done();
    //        });
    //    });
    //});
    //
    //it('should allow to find using like', function(done) {
    //    Post.create({ title: 'My Post', content: 'Hello' }, function(err, post) {
    //        Post.find({ where: { title: { like: 'M.+st' }}}, function(err, posts) {
    //            should.not.exist(err);
    //            posts.should.have.property('length', 1);
    //            done();
    //        });
    //    });
    //});
    //
    //it('should allow to find using case insensitive like', function(done) {
    //    Post.create({ title: 'My Post', content: 'Hello' }, function(err, post) {
    //        Post.find({ where: { title: { like: 'm.+st', options: 'i' }}}, function(err, posts) {
    //            should.not.exist(err);
    //            posts.should.have.property('length', 1);
    //            done();
    //        });
    //    });
    //});
    //
    //it('should allow to find using like with renamed columns', function(done) {
    //    PostWithStringId.create({ title: 'My Post', content: 'Hello' }, function(err, post) {
    //        PostWithStringIdAndRenamedColumns.find({ where: { renamedTitle: { like: 'M.+st' }}}, function(err, posts) {
    //            should.not.exist(err);
    //            posts.should.have.property('length', 1);
    //            done();
    //        });
    //    });
    //});
    //
    //it('should allow to find using like with renamed columns (inverse create order)', function(done) {
    //    PostWithStringIdAndRenamedColumns.create({ renamedTitle: 'My Post', renamedContent: 'Hello' }, function(err, post) {
    //        PostWithStringId.find({ where: { title: { like: 'M.+st' }}}, function(err, posts) {
    //            should.not.exist(err);
    //            posts.should.have.property('length', 1);
    //            done();
    //        });
    //    });
    //});
    //
    //it('should allow to find using case insensitive like', function(done) {
    //    Post.create({ title: 'My Post', content: 'Hello' }, function(err, post) {
    //        Post.find({ where: { content: { like: 'HELLO', options: 'i' }}}, function(err, posts) {
    //            should.not.exist(err);
    //            posts.should.have.property('length', 1);
    //            done();
    //        });
    //    });
    //});
    //
    //it('should support like for no match', function(done) {
    //    Post.create({ title: 'My Post', content: 'Hello' }, function(err, post) {
    //        Post.find({ where: { title: { like: 'M.+XY' }}}, function(err, posts) {
    //            should.not.exist(err);
    //            posts.should.have.property('length', 0);
    //            done();
    //        });
    //    });
    //});
    //
    //it('should allow to find using nlike', function(done) {
    //    Post.create({ title: 'My Post', content: 'Hello' }, function(err, post) {
    //        Post.find({ where: { title: { nlike: 'M.+st' }}}, function(err, posts) {
    //            should.not.exist(err);
    //            posts.should.have.property('length', 0);
    //            done();
    //        });
    //    });
    //});
    //
    //it('should allow to find using case insensitive nlike', function(done) {
    //    Post.create({ title: 'My Post', content: 'Hello' }, function(err, post) {
    //        Post.find({ where: { title: { nlike: 'm.+st', options: 'i' }}}, function(err, posts) {
    //            should.not.exist(err);
    //            posts.should.have.property('length', 0);
    //            done();
    //        });
    //    });
    //});
    //
    //it('should support nlike for no match', function(done) {
    //    Post.create({ title: 'My Post', content: 'Hello' }, function(err, post) {
    //        Post.find({ where: { title: { nlike: 'M.+XY' }}}, function(err, posts) {
    //            should.not.exist(err);
    //            posts.should.have.property('length', 1);
    //            done();
    //        });
    //    });
    //});
    //
    //it('should support "and" operator that is satisfied', function(done) {
    //    Post.create({ title: 'My Post', content: 'Hello' }, function(err, post) {
    //        Post.find({ where: { and: [{ title: 'My Post' }, { content: 'Hello' }] }}, function(err, posts) {
    //            should.not.exist(err);
    //            posts.should.have.property('length', 1);
    //            done();
    //        });
    //    });
    //});
    //
    //it('should support "and" operator that is not satisfied', function(done) {
    //    Post.create({ title: 'My Post', content: 'Hello' }, function(err, post) {
    //        Post.find({ where: { and: [{ title: 'My Post' }, { content: 'Hello1' }] }}, function(err, posts) {
    //            should.not.exist(err);
    //            posts.should.have.property('length', 0);
    //            done();
    //        });
    //    });
    //});
    //
    //it('should support "or" that is satisfied', function(done) {
    //    Post.create({ title: 'My Post', content: 'Hello' }, function(err, post) {
    //        Post.find({ where: { or: [{ title: 'My Post' }, { content: 'Hello1' }] }}, function(err, posts) {
    //            should.not.exist(err);
    //            posts.should.have.property('length', 1);
    //            done();
    //        });
    //    });
    //});
    //
    //it('should support "or" operator that is not satisfied', function(done) {
    //    Post.create({ title: 'My Post', content: 'Hello' }, function(err, post) {
    //        Post.find({ where: { or: [{ title: 'My Post1' }, { content: 'Hello1' }] }}, function(err, posts) {
    //            should.not.exist(err);
    //            posts.should.have.property('length', 0);
    //            done();
    //        });
    //    });
    //});
    //
    //it('should support "nor" operator that is satisfied', function(done) {
    //    Post.create({ title: 'My Post', content: 'Hello' }, function(err, post) {
    //        Post.find({ where: { nor: [{ title: 'My Post1' }, { content: 'Hello1' }] }}, function(err, posts) {
    //            should.not.exist(err);
    //            posts.should.have.property('length', 1);
    //            done();
    //        });
    //    });
    //});
    //
    //it('should support "nor" operator that is not satisfied', function(done) {
    //    Post.create({ title: 'My Post', content: 'Hello' }, function(err, post) {
    //        Post.find({ where: { nor: [{ title: 'My Post' }, { content: 'Hello1' }] }}, function(err, posts) {
    //            should.not.exist(err);
    //            posts.should.have.property('length', 0);
    //            done();
    //        });
    //    });
    //});
    //
    //it('should support neq for match', function(done) {
    //    Post.create({ title: 'My Post', content: 'Hello' }, function(err, post) {
    //        Post.find({ where: { title: { neq: 'XY' }}}, function(err, posts) {
    //            should.not.exist(err);
    //            posts.should.have.property('length', 1);
    //            done();
    //        });
    //    });
    //});
    //
    //it('should support neq for no match', function(done) {
    //    Post.create({ title: 'My Post', content: 'Hello' }, function(err, post) {
    //        Post.find({ where: { title: { neq: 'My Post' }}}, function(err, posts) {
    //            should.not.exist(err);
    //            posts.should.have.property('length', 0);
    //            done();
    //        });
    //    });
    //});
    //
    //// The where object should be parsed by the connector
    //it('should support where for count', function(done) {
    //    Post.create({ title: 'My Post', content: 'Hello' }, function(err, post) {
    //        Post.count({ and: [{ title: 'My Post' }, { content: 'Hello' }] }, function(err, count) {
    //            should.not.exist(err);
    //            count.should.be.equal(1);
    //            Post.count({ and: [{ title: 'My Post1' }, { content: 'Hello' }] }, function(err, count) {
    //                should.not.exist(err);
    //                count.should.be.equal(0);
    //                done();
    //            });
    //        });
    //    });
    //});
    //
    //// The where object should be parsed by the connector
    //it('should support where for destroyAll', function(done) {
    //    Post.create({ title: 'My Post1', content: 'Hello' }, function(err, post) {
    //        Post.create({ title: 'My Post2', content: 'Hello' }, function(err, post) {
    //            Post.destroyAll({ and: [
    //                { title: 'My Post1' },
    //                { content: 'Hello' },
    //            ] }, function(err) {
    //                should.not.exist(err);
    //                Post.count(function(err, count) {
    //                    should.not.exist(err);
    //                    count.should.be.equal(1);
    //                    done();
    //                });
    //            });
    //        });
    //    });
    //});
    //
    //it('should support where for count (using renamed columns in deep filter ' +
    //    'criteria)', function(done) {
    //    PostWithStringId.create({ title: 'My Post', content: 'Hello' },
    //        function(err, post) {
    //            PostWithStringIdAndRenamedColumns.count({
    //                and: [{
    //                    renamedTitle: 'My Post',
    //                }, { renamedContent: 'Hello' }],
    //            }, function(err, count) {
    //                should.not.exist(err);
    //                count.should.be.equal(1);
    //                PostWithStringIdAndRenamedColumns.count({
    //                    and: [{
    //                        renamedTitle: 'My Post1',
    //                    }, { renamedContent: 'Hello' }],
    //                }, function(err, count) {
    //                    should.not.exist(err);
    //                    count.should.be.equal(0);
    //                    done();
    //                });
    //            });
    //        });
    //});
    //
    //it('should return info for destroy', function(done) {
    //    Post.create({ title: 'My Post', content: 'Hello' }, function(err, post) {
    //        post.destroy(function(err, info) {
    //            should.not.exist(err);
    //            info.should.be.eql({ count: 1 });
    //            done();
    //        });
    //    });
    //});
    //
    //it('should export the ArangoDB function', function() {
    //    var module = require('../');
    //    module.ArangoDB.should.be.an.instanceOf(Function);
    //});
    //
    //it('should export the ObjectID function', function() {
    //    var module = require('../');
    //    module.ObjectID.should.be.an.instanceOf(Function);
    //});
    //
    //it('should export the generateArangoDBURL function', function() {
    //    var module = require('../');
    //    module.generateArangoDBURL.should.be.an.instanceOf(Function);
    //});
    //
    //context('regexp operator', function() {
    //    before(function deleteExistingTestFixtures(done) {
    //        Post.destroyAll(done);
    //    });
    //    beforeEach(function createTestFixtures(done) {
    //        Post.create([
    //            { title: 'a', content: 'AAA' },
    //            { title: 'b', content: 'BBB' },
    //        ], done);
    //    });
    //    after(function deleteTestFixtures(done) {
    //        Post.destroyAll(done);
    //    });
    //
    //    context('with regex strings', function() {
    //        context('using no flags', function() {
    //            it('should work', function(done) {
    //                Post.find({ where: { content: { regexp: '^A' }}}, function(err, posts) {
    //                    should.not.exist(err);
    //                    posts.length.should.equal(1);
    //                    posts[0].content.should.equal('AAA');
    //                    done();
    //                });
    //            });
    //        });
    //
    //        context('using flags', function() {
    //            beforeEach(function addSpy() {
    //                sinon.stub(console, 'warn');
    //            });
    //            afterEach(function removeSpy() {
    //                console.warn.restore();
    //            });
    //
    //            it('should work', function(done) {
    //                Post.find({ where: { content: { regexp: '^a/i' }}}, function(err, posts) {
    //                    should.not.exist(err);
    //                    posts.length.should.equal(1);
    //                    posts[0].content.should.equal('AAA');
    //                    done();
    //                });
    //            });
    //
    //            it('should print a warning when the global flag is set',
    //                function(done) {
    //                    Post.find({ where: { content: { regexp: '^a/g' }}}, function(err, posts) {
    //                        console.warn.calledOnce.should.be.ok;
    //                        done();
    //                    });
    //                });
    //        });
    //    });
    //
    //    context('with regex literals', function() {
    //        context('using no flags', function() {
    //            it('should work', function(done) {
    //                Post.find({ where: { content: { regexp: /^A/ }}}, function(err, posts) {
    //                    should.not.exist(err);
    //                    posts.length.should.equal(1);
    //                    posts[0].content.should.equal('AAA');
    //                    done();
    //                });
    //            });
    //        });
    //
    //
    //        context('using flags', function() {
    //            beforeEach(function addSpy() {
    //                sinon.stub(console, 'warn');
    //            });
    //            afterEach(function removeSpy() {
    //                console.warn.restore();
    //            });
    //
    //            it('should work', function(done) {
    //                Post.find({ where: { content: { regexp: /^a/i }}}, function(err, posts) {
    //                    should.not.exist(err);
    //                    posts.length.should.equal(1);
    //                    posts[0].content.should.equal('AAA');
    //                    done();
    //                });
    //            });
    //
    //            it('should print a warning when the global flag is set',
    //                function(done) {
    //                    Post.find({ where: { content: { regexp: /^a/g }}}, function(err, posts) {
    //                        console.warn.calledOnce.should.be.ok;
    //                        done();
    //                    });
    //                });
    //        });
    //    });
    //
    //    context('with regex object', function() {
    //        context('using no flags', function() {
    //            it('should work', function(done) {
    //                Post.find({ where: { content: { regexp: new RegExp(/^A/) }}}, function(err, posts) {
    //                    should.not.exist(err);
    //                    posts.length.should.equal(1);
    //                    posts[0].content.should.equal('AAA');
    //                    done();
    //                });
    //            });
    //        });
    //
    //
    //        context('using flags', function() {
    //            beforeEach(function addSpy() {
    //                sinon.stub(console, 'warn');
    //            });
    //            afterEach(function removeSpy() {
    //                console.warn.restore();
    //            });
    //
    //            it('should work', function(done) {
    //                Post.find({ where: { content: { regexp: new RegExp(/^a/i) }}}, function(err, posts) {
    //                    should.not.exist(err);
    //                    posts.length.should.equal(1);
    //                    posts[0].content.should.equal('AAA');
    //                    done();
    //                });
    //            });
    //
    //            it('should print a warning when the global flag is set',
    //                function(done) {
    //                    Post.find({ where: { content: { regexp: new RegExp(/^a/g) }}}, function(err, posts) {
    //                        console.warn.calledOnce.should.be.ok;
    //                        done();
    //                    });
    //                });
    //        });
    //    });
    //});
    //
    //context('like and nlike operator', function() {
    //    before(function deleteExistingTestFixtures(done) {
    //        Post.destroyAll(done);
    //    });
    //    beforeEach(function createTestFixtures(done) {
    //        Post.create([
    //            { title: 'a', content: 'AAA' },
    //            { title: 'b', content: 'BBB' },
    //        ], done);
    //    });
    //    after(function deleteTestFixtures(done) {
    //        Post.destroyAll(done);
    //    });
    //
    //    context('like operator', function() {
    //        context('with regex strings', function() {
    //            context('using no flags', function() {
    //                it('should work', function(done) {
    //                    Post.find({ where: { content: { like: '^A' }}}, function(err, posts) {
    //                        should.not.exist(err);
    //                        posts.length.should.equal(1);
    //                        posts[0].content.should.equal('AAA');
    //                        done();
    //                    });
    //                });
    //            });
    //
    //            context('using flags', function() {
    //                it('should work', function(done) {
    //                    Post.find({ where: { content: { like: '^a', options: 'i' }}}, function(err, posts) {
    //                        should.not.exist(err);
    //                        posts.length.should.equal(1);
    //                        posts[0].content.should.equal('AAA');
    //                        done();
    //                    });
    //                });
    //            });
    //        });
    //
    //        context('with regex literals', function() {
    //            context('using no flags', function() {
    //                it('should work', function(done) {
    //                    Post.find({ where: { content: { like: /^A/ }}}, function(err, posts) {
    //                        should.not.exist(err);
    //                        posts.length.should.equal(1);
    //                        posts[0].content.should.equal('AAA');
    //                        done();
    //                    });
    //                });
    //            });
    //
    //            context('using flags', function() {
    //                it('should work', function(done) {
    //                    Post.find({ where: { content: { like: /^a/i }}}, function(err, posts) {
    //                        should.not.exist(err);
    //                        posts.length.should.equal(1);
    //                        posts[0].content.should.equal('AAA');
    //                        done();
    //                    });
    //                });
    //            });
    //        });
    //
    //        context('with regex object', function() {
    //            context('using no flags', function() {
    //                it('should work', function(done) {
    //                    Post.find({ where: { content: { like: new RegExp(/^A/) }}}, function(err, posts) {
    //                        should.not.exist(err);
    //                        posts.length.should.equal(1);
    //                        posts[0].content.should.equal('AAA');
    //                        done();
    //                    });
    //                });
    //            });
    //
    //            context('using flags', function() {
    //                it('should work', function(done) {
    //                    Post.find({ where: { content: { like: new RegExp(/^a/i) }}}, function(err, posts) {
    //                        should.not.exist(err);
    //                        posts.length.should.equal(1);
    //                        posts[0].content.should.equal('AAA');
    //                        done();
    //                    });
    //                });
    //            });
    //        });
    //    });
    //
    //    context('nlike operator', function() {
    //        context('with regex strings', function() {
    //            context('using no flags', function() {
    //                it('should work', function(done) {
    //                    Post.find({ where: { content: { nlike: '^A' }}}, function(err, posts) {
    //                        should.not.exist(err);
    //                        posts.length.should.equal(1);
    //                        posts[0].content.should.equal('BBB');
    //                        done();
    //                    });
    //                });
    //            });
    //
    //            context('using flags', function() {
    //                it('should work', function(done) {
    //                    Post.find({ where: { content: { nlike: '^a', options: 'i' }}}, function(err, posts) {
    //                        should.not.exist(err);
    //                        posts.length.should.equal(1);
    //                        posts[0].content.should.equal('BBB');
    //                        done();
    //                    });
    //                });
    //            });
    //        });
    //
    //        context('with regex literals', function() {
    //            context('using no flags', function() {
    //                it('should work', function(done) {
    //                    Post.find({ where: { content: { nlike: /^A/ }}}, function(err, posts) {
    //                        should.not.exist(err);
    //                        posts.length.should.equal(1);
    //                        posts[0].content.should.equal('BBB');
    //                        done();
    //                    });
    //                });
    //            });
    //
    //            context('using flags', function() {
    //                it('should work', function(done) {
    //                    Post.find({ where: { content: { nlike: /^a/i }}}, function(err, posts) {
    //                        should.not.exist(err);
    //                        posts.length.should.equal(1);
    //                        posts[0].content.should.equal('BBB');
    //                        done();
    //                    });
    //                });
    //            });
    //        });
    //
    //        context('with regex object', function() {
    //            context('using no flags', function() {
    //                it('should work', function(done) {
    //                    Post.find({ where: { content: { nlike: new RegExp(/^A/) }}}, function(err, posts) {
    //                        should.not.exist(err);
    //                        posts.length.should.equal(1);
    //                        posts[0].content.should.equal('BBB');
    //                        done();
    //                    });
    //                });
    //            });
    //
    //            context('using flags', function() {
    //                it('should work', function(done) {
    //                    Post.find({ where: { content: { nlike: new RegExp(/^a/i) }}}, function(err, posts) {
    //                        should.not.exist(err);
    //                        posts.length.should.equal(1);
    //                        posts[0].content.should.equal('BBB');
    //                        done();
    //                    });
    //                });
    //            });
    //        });
    //    });
    //});
    //
    //after(function(done) {
    //    User.destroyAll(function() {
    //        Post.destroyAll(function() {
    //            PostWithUUID.destroyAll(function() {
    //                PostWithNumberId.destroyAll(done);
    //            });
    //        });
    //    });
    //});
});
