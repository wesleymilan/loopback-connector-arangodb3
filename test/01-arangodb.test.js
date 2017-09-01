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
            id: {
                id: true,
                arangodb: { column: "_key" }
            },
            user_id: { arangodb: { column: "_from" } },
            post_id: { arangodb: { column: "_to" } },
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
            id: {
                id: true,
                arangodb: { column: "_key" }
            },
            user_id: { arangodb: { column: "_from" } },
            post_id: { arangodb: { column: "_to" } },
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
            id: {
                id: true,
                arangodb: { column: "_key" }
            },
            user_id: { arangodb: { column: "_from" } },
            post_id: { arangodb: { column: "_to" } },
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
            key: {
                id: true,
                arangodb: { column: "_key" }
            },
            title: { type: String, length: 255 },
            content: { type: String }
        }, {
            forceId: false,
            strict: false
        });

        PostWithUUID = db.define('PostWithUUID', {
            key: {
                id: true,
                defaultFn: 'uuid'
            },
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
        //User.hasMany(Post, {through: UserLikePostAutoId, foreignKey: 'to', keyThrough: 'from', primaryKey: 'id'});
        //Post.hasMany(User, {through: UserLikePostAutoId, foreignKey: 'from', keyThrough: 'to', primaryKey: 'id'});
        //UserLikePostAutoId.belongsTo(User, { foreignKey: 'from', primaryKey: 'id' });
        //UserLikePostAutoId.belongsTo(Post, { foreignKey: 'to', primaryKey: 'id' });

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
                should.not.exist(err);

                PostWithUUID.find({ where: { key: post.key }}, function(err, p) {
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
                PostWithStringId.find({ where: { key: post.id }}, function(err, p) {
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
                should.not.exist(err);

                data = require(__dirname + '/fixtures/users.json');
                User.create(data, function (err, result) {
                    should.not.exist(err);

                    data = require(__dirname + '/fixtures/user-like-post-noid.json');
                    UserLikePostAutoId.create(data, function (err, result) {
                        should.not.exist(err);

                        UserLikePostAutoId.findOne({ where: { user_id: 'User/1', post_id: 'Post/1' } }, function(err, edge) {
                            should.not.exist(err);
                            should.exist(edge);
                            should.exist(edge.id);
                            edge.id.should.not.eql('1');
                            done();

                        });

                    });

                });

            });

        });

        it('Edge UserLikePostManualID', function (done) {
            data = require(__dirname + '/fixtures/posts.json');
            Post.create(data, function (err, result) {
                should.not.exist(err);

                data = require(__dirname + '/fixtures/users.json');
                User.create(data, function (err, result) {
                    should.not.exist(err);

                    data = require(__dirname + '/fixtures/user-like-post.json');
                    UserLikePostManualID.create(data, function (err, result) {
                        should.not.exist(err);

                        UserLikePostManualID.findOne({ where: { user_id: 'User/1', post_id: 'Post/1' } }, function(err, edge) {
                            should.not.exist(err);
                            should.exist(result);
                            edge.id.should.eql('1');
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
                    should.not.exist(err);

                    data = require(__dirname + '/fixtures/user-like-post-noid.json');
                    UserLikePostAutoUniqueID.create(data, function (err, result) {
                        should.not.exist(err);

                        UserLikePostAutoUniqueID.findOne({ where: { user_id: 'User/1', post_id: 'Post/1' } }, function(err, edge) {
                            should.not.exist(err);
                            should.exist(edge);
                            edge.id.length.should.eql(64);
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
                            result.length.should.eql(0);
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

    describe('Employee: Update', function() {

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

    });

});
