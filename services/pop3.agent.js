"use strict";

const { Context } = require("moleculer");
const DbService = require("db-mixin");
const ConfigLoader = require("config-mixin");
const { MoleculerClientError } = require("moleculer").Errors;

const S3Mixin = require("../mixins/s3-store.mixin");
const FSMixin = require("../mixins/fs-store.mixin");

/**
 * this is the pop3 agent service
 * 
 * Source: https://github.com/nodemailer/wildduck/tree/master/lib/pop3
 * and https://github.com/nodemailer/wildduck/blob/master/pop3.js
 * 
 * this is a convertion of ../lib/pop3-server.js to a moleculer service
 */

const SMTPServer = require('smtp-server').SMTPServer;
const fs = require('fs');
const tls = require('tls');
const os = require('os');
const net = require('net');
const path = require('path');
const crypto = require('crypto');
const isemail = require('isemail');


const addressTools = require('../lib/address-tools');
const StreamHash = require('../lib/stream-hash');

const POP3Connection = require('../lib/pop3-connection');

const packageData = {
    name: 'pop3',
    version: '1.22.344'
}

module.exports = {
    name: "emails.pop3",
    version: 1,

    mixins: [
        ConfigLoader([
            "emails.**",
            "s3.**",
        ]),
        S3Mixin
    ],

    /**
     * Service dependencies
     */
    dependencies: [],

    /**
     * Service settings
     */
    settings: {
        rest: true,// enable rest api



        // default init config settings
        config: {
            "emails.pop3.logging": false,
            "emails.pop3.secure": false,
            "emails.pop3.needsUpgrade": false,
            "emails.pop3.port": 110,
            "emails.pop3.host": "mail.example.com",
            "emails.pop3.hostname": "mail.example.com",
            "emails.pop3.name": "POP3 Server",
            "emails.pop3.disableVersionString": false,
            "emails.pop3.size": 1024 * 1024 * 1024,
            "emails.pop3.authMethods": ['PLAIN', 'LOGIN'],
            "emails.pop3.secure": false,
            "emails.pop3.socketTimeout": 10 * 60 * 1000,
        }
    },

    /**
     * Actions
     */
    actions: {
        /**
         * CAPA command
         * 
         * @actions
         * @param {Array} args - the arguments
         * @param {String} command - the command
         * @param {String} line - the data
         * @param {String} session - the session id
         * 
         * @returns {Promise}
         */
        capa: {
            params: {
                args: { type: "string", optional: true },
                command: { type: "string", optional: true },
                line: { type: "string", optional: true },
                session: { type: "string", optional: true },
            },
            async handler(ctx) {
                const { args, command, line, session: id } = ctx.params;
                // check args
                if (args.length) {
                    throw new MoleculerClientError('Too many arguments for CAPA command', 501, 'ERR_INVALID_ARG_VALUE');
                }

                // get session
                const session = this.getSession(id);
                // check session
                if (!session) {
                    throw new MoleculerClientError('Invalid session', 501, 'ERR_INVALID_ARG_VALUE');
                }

                // extensions to advertise
                const extensions = [
                    'TOP',
                    'PIPELINING',
                    'UIDL',
                    'RESP-CODES',
                ];

                // check auth
                if (!session.user) {
                    extensions.push(...[
                        'USER',
                        'SASL',
                        'PLAIN'
                    ]);
                }

                // STLS
                if (!session.secure) {
                    extensions.push('STLS');
                }

                // IMPLEMENTATION
                extensions.push(`IMPLEMENTATION ${this.config['emails.pop3.name']} v${packageData.version}`);

                // return extensions
                return ['+OK Capability list follows'].concat(extensions);
            }
        },

        /**
         * USER command
         * 
         * @actions
         * @param {Array} args - the arguments
         * @param {String} command - the command
         * @param {String} line - the data
         * @param {string} session - the session id
         * 
         * @returns {Promise}
         */
        user: {
            params: {
                args: { type: "string", optional: true },
                command: { type: "string", optional: true },
                line: { type: "string", optional: true },
                session: { type: "string", optional: true },
            },
            async handler(ctx) {
                const { args, command, line, session: id } = ctx.params;

                // get session
                const session = this.getSession(id);
                // check session
                if (!session) {
                    throw new MoleculerClientError('Invalid session', 501, 'ERR_INVALID_ARG_VALUE');
                }

                // AUTHORIZATION
                if (session.state = 'AUTHORIZATION') {
                    throw new MoleculerClientError('Invalid command', 501, 'ERR_INVALID_ARG_VALUE');
                }

                // check args
                if (!args.length) {
                    throw new MoleculerClientError('Missing argument for USER command', 501, 'ERR_INVALID_ARG_VALUE');
                }

                // check auth
                if (session.username) {
                    throw new MoleculerClientError('Already authenticated', 501, 'ERR_INVALID_ARG_VALUE');
                }

                // set user
                session.username = args.toLowerCase();

                // return ok
                return '+OK send PASS';
            }
        },

        /**
         * PASS command
         * 
         * @actions
         * @param {Array} args - the arguments
         * @param {String} command - the command
         * @param {String} line - the data
         * @param {string} session - the session id
         * 
         * @returns {Promise}
         */
        pass: {
            params: {
                args: { type: "string", optional: true },
                command: { type: "string", optional: true },
                line: { type: "string", optional: true },
                session: { type: "string", optional: true },
            },
            async handler(ctx) {
                const { args, command, line, session: id } = ctx.params;

                // check args
                if (!args.length) {
                    throw new MoleculerClientError('Missing argument for PASS command', 501, 'ERR_INVALID_ARG_VALUE');
                }

                // get session
                const session = this.getSession(id);
                // check session
                if (!session) {
                    throw new MoleculerClientError('Invalid session', 501, 'ERR_INVALID_ARG_VALUE');
                }


                // check auth
                if (!session.username) {
                    throw new MoleculerClientError('Missing USER command', 501, 'ERR_INVALID_ARG_VALUE');
                }

                // set password
                session.password = args;

                // auth user
                const user = await ctx.call('v1.emails.accounts.auth', {
                    method: 'PLAIN',
                    username: session.username,
                    password: session.password,
                });

                // check user
                if (!user) {
                    throw new MoleculerClientError('Invalid username or password', 501, 'ERR_INVALID_ARG_VALUE');
                }

                // set user
                session.user = user;

                // return ok
                return '+OK Logged in';
            }
        },
    },

    /**
     * Events
     */
    events: {},

    /**
     * Methods
     */
    methods: {

        /**
        * Start the POP3 server
        * @param {Context} ctx - Moleculer's Context
        * 
        * @returns {Promise}
        */
        async start(ctx) {
            if (this.server) {
                return;
            }

            this.logger.info('Starting POP3 server');

            // resolve key and cert
            const [key, ca, cert] = await this.resolveKeyCert(this.config["emails.pop3.hostname"]);

            // create secure context
            this.secureContext.set(this.config["emails.pop3.hostname"], tls.createSecureContext({ key, cert, ca }));

            // net server options
            const options = {
                port: this.config['emails.pop3.port'],
                host: this.config['emails.pop3.host'],

            }

            this.server = net.createServer(options, socket => {
                this.onConnection(socket).catch(err => {
                    this.logger.error(err);
                    socket.end();
                });
            });

            // server error handler
            this.server.on('error', err => {
                this.onError(err);
            });

            // server close handler
            this.server.on('close', () => {
                this.onClose();
            });

            // server timeout handler
            this.server.on('timeout', () => {
                this.onTimeout();
            });

            // server listening handler
            this.server.on('listening', () => {
                this.onListening();
            });

            // start server
            return this.server.listen(options);
        },

        /**
         * Stop the POP3 server
         * @param {Context} ctx - Moleculer's Context
         *
         * @returns {Promise}
         */
        async stop(ctx) {
            if (!this.server) {
                return;
            }

            this.logger.info('Stopping POP3 server');

            // close server
            this.server.close();

            // close all connections
            for (let connection of this.connections) {
                connection.close();
            }

            // clear server
            this.server = null;
        },

        /**
         * on new connection
         * 
         * @param {Socket} socket - the socket to connect
         * 
         * @returns {Promise}
         */
        async onConnection(socket) {

            const socketOptions = {};

            if (this.config['emails.pop3.secure']) {
                return this.connect(socket, socketOptions);
            }

            if (this.config['emails.pop3.secure'] && !this.config['emails.pop3.needsUpgrade']) {
                const tlsSocket = await this.upgrade(socket);
                return this.connect(tlsSocket, socketOptions);
            } else {
                return this.connect(socket, socketOptions);
            }
        },

        /**
         * on server listening
         */
        onListening() {
            this.logger.info(`POP3 server listening on port ${this.config['emails.pop3.port']}`);
        },

        /**
         * upgrade connection to TLS
         * 
         * @param {Context} ctx - Moleculer's Context
         * @param {Socket} socket - the socket to upgrade
         * 
         * @returns {Promise}
         */
        upgrade(ctx, socket) {

            return new Promise((resolve, reject) => {
                let socketOptions = {
                    secureContext: this.secureContext.get(this.config['emails.pop3.hostname']),
                    isServer: true,
                    server: this.server,
                    SNICallback: async (servername, cb) => {

                        // look in cache first
                        let ctx = this.secureContext.get(servername);
                        if (ctx) {
                            return cb(null, ctx);
                        }

                        // resolve key and cert
                        const [key, ca, cert] = await this.resolveKeyCert(servername);

                        // create secure context
                        ctx = tls.createSecureContext({ key, cert, ca });

                        // cache context
                        this.secureContext.set(servername, ctx);

                        // return context
                        return cb(null, ctx);
                    }
                };


                let remoteAddress = socket.remoteAddress;

                let returned = false;
                let onError = err => {
                    if (returned) {
                        return;
                    }
                    returned = true;

                    if (err && /SSL[23]*_GET_CLIENT_HELLO|ssl[23]*_read_bytes|ssl_bytes_to_cipher_list/i.test(err.message)) {
                        let message = err.message;
                        err.message = 'Failed to establish TLS session';
                        err.code = err.code || 'TLSError';
                        err.meta = {
                            protocol: 'pop3',
                            stage: 'connect',
                            message,
                            remoteAddress
                        };
                    }

                    if (!err || !err.message) {
                        err = new Error('Socket closed while initiating TLS');
                        err.code = 'SocketError';
                        err.meta = {
                            protocol: 'pop3',
                            stage: 'connect',
                            remoteAddress
                        };
                    }
                    reject(err);
                };

                // remove all listeners from the original socket besides the error handler
                socket.once('error', onError);

                // upgrade connection
                let tlsSocket = new tls.TLSSocket(socket, socketOptions);

                let onCloseError = hadError => {
                    if (hadError) {
                        return onError();
                    }
                };

                tlsSocket.once('close', onCloseError);
                tlsSocket.once('error', onError);
                tlsSocket.once('_tlsError', onError);
                tlsSocket.once('clientError', onError);
                tlsSocket.once('tlsClientError', onError);

                tlsSocket.on('secure', () => {
                    socket.removeListener('error', onError);
                    tlsSocket.removeListener('close', onCloseError);
                    tlsSocket.removeListener('error', onError);
                    tlsSocket.removeListener('_tlsError', onError);
                    tlsSocket.removeListener('clientError', onError);
                    tlsSocket.removeListener('tlsClientError', onError);
                    if (returned) {
                        try {
                            tlsSocket.end();
                        } catch (E) {
                            //
                        }
                        return;
                    }
                    returned = true;
                    resolve(tlsSocket);
                });
            });
        },

        /**
         * normalize hostname
         * 
         * @param {String} hostname - the hostname to normalize
         * 
         * @returns {String}
         */
        normalizeHostname(hostname) {
            if (hostname && hostname[0] === '[' && hostname[hostname.length - 1] === ']') {
                hostname = hostname.slice(1, -1);
            }
            return hostname && hostname.toLowerCase();
        },

        /**
         * resolve key and cert from v1.certificates service
         * 
         * @param {String} hostname - hostname to resolve
         * 
         * @returns {Promise} 
         */
        async resolveKeyCert(hostname) {
            // resolve key and cert

            const ctx = new Context(this.broker);

            let result = await ctx.call("v1.certificates.resolveDomain", {
                domain: hostname
            });

            // check result
            if (!result) {
                await ctx.call("v1.certificates.letsencrypt.dns", {
                    domain: hostname
                });
                result = await ctx.call("v1.certificates.resolveDomain", {
                    domain: hostname
                });
            }

            if (!result) {
                throw new Error('failed to resolve key and cert');
            }

            const { privkey, chain, cert } = result;

            // return key and cert
            return [privkey, chain, cert];
        },

        /**
         * create new pop3 connection
         * 
         * @param {Socket} socket - the socket to connect
         * @param {Object} socketOptions - socket options
         * 
         * @returns {Promise}
         */
        async connect(socket, socketOptions) {
            let connection = new POP3Connection(this, socket, socketOptions);
            this.connections.add(connection);
            connection.once('error', err => {
                this.connections.delete(connection);
                this.onError(err);
            });
            connection.once('close', () => {
                this.connections.delete(connection);
            });
            connection.init();
        },

        /**
         * get session by connections id
         * 
         * @param {String} id - the connection id
         * 
         * @returns {Object}
         */
        getSession(id) {
            // loop over connections
            for (let connection of this.connections) {
                if (connection.id === id) {
                    return connection.session;
                }
            }
        },


        /**
         * on error
         * 
         * @param {Error} err - the error to handle
         * 
         * @returns {Promise}
         */
        async onError(err) {
            this.logger.error(err);
        },

        /**
         * on close
         * 
         * @param {Context} ctx - Moleculer's Context
         * 
         * @returns {Promise}
         */
        async onClose(ctx) {
            if (this.server) {
                this.server.close();
            }
        },

    },

    /**
     * Service created lifecycle event handler
     */
    created() {

        /**
         * Timeout after close has been called until pending connections are forcibly closed
         */
        this._closeTimeout = false;

        /**
         * A set of all currently open connections
         */
        this.connections = new Set();

        /**
         * A map of secure contexts for SNI
         */
        this.secureContext = new Map();
    },
    /**
     * Service started lifecycle event handler
     */
    async started() {
        await this.start();
    },
    /**
     * Service stopped lifecycle event handler
     */
    async stopped() {
        await this.stop();
    },
};