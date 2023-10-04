"use strict";

const { Context } = require("moleculer");
const DbService = require("db-mixin");
const ConfigLoader = require("config-mixin");
const { MoleculerClientError } = require("moleculer").Errors;

const S3Mixin = require("../mixins/s3-store.mixin");

/**
 * this is a inbound smtp server
 */

const SMTPServer = require('smtp-server').SMTPServer;
const fs = require('fs');
const os = require('os');
const isemail = require('isemail');


const addressTools = require('../lib/address-tools');
const StreamHash = require('../lib/stream-hash');

const packageData = {
    name: 'smtp',
    version: '1.22.344'
}

module.exports = {
    name: "emails.inbound",
    version: 1,

    mixins: [
        DbService({
            permissions: "emails.inbound"
        }),
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


        fields: {
            //DB fields that fit the mailparser schema

            // envelope mail from
            from: {
                type: 'string',
                required: false,
                empty: false,
            },

            // envelope rcpt to
            to: {
                type: 'array',
                required: false,
                default: [],
                items: {
                    type: 'string',
                    required: true,
                    empty: false,
                }
            },

            sourceSize: {
                type: 'number',
                required: false,
                default: null
            },

            // envelope sourceMd5
            sourceMd5: {
                type: 'string',
                required: false,
                default: null,
            },


            // envelope s3 object
            s3: {
                type: 'object',
                props: {
                    // bucket
                    bucket: {
                        type: 'string',
                        required: true,
                        empty: false,
                    },
                    // object name
                    name: {
                        type: 'string',
                        required: true,
                        empty: false,
                    },
                    // etag
                    etag: {
                        type: 'string',
                        required: true,
                        empty: false,
                    },
                },
                required: false,
            },


            // session client object
            session: {
                type: 'object',
                props: {
                    // session id
                    sessionID: {
                        type: 'string',
                        required: true,
                        empty: false,
                    },
                    // local IP address for the connected client
                    localAddress: {
                        type: 'string',
                        required: true,
                        empty: false,
                    },
                    // local port number for the connected client
                    localPort: {
                        type: 'number',
                        required: true,
                    },
                    // remote IP address for the connected client
                    remoteAddress: {
                        type: 'string',
                        required: true,
                        empty: false,
                    },
                    // remote port number for the connected client
                    remotePort: {
                        type: 'number',
                        required: true,
                    },
                    // reverse resolved hostname for remoteAddress
                    clientHostname: {
                        type: 'string',
                        required: true,
                        empty: false,
                    },
                    // the opening SMTP command (HELO/EHLO/LHLO)
                    openingCommand: {
                        type: 'string',
                        required: false,
                    },
                    // hostname the client provided with HELO/EHLO call
                    hostNameAppearsAs: {
                        type: 'string',
                        required: true,
                        empty: false,
                    },
                    // transmissionType
                    transmissionType: {
                        type: 'string',
                        required: true,
                        empty: false,
                    },
                }
            },

            // server object
            server: {
                type: 'object',
                props: {
                    // server hostname
                    hostName: {
                        type: 'string',
                        required: true,
                        empty: false,
                    },
                    // server IP address
                    address: {
                        type: 'string',
                        required: true,
                        empty: false,
                    },
                    // server port number
                    port: {
                        type: 'number',
                        required: true,
                    },
                    // server TLS enabled
                    tls: {
                        type: 'boolean',
                        required: true,
                    },
                    // server authMethod
                    authMethod: {
                        type: 'string',
                        required: false,
                        default: null,
                    },
                }
            },

            ...DbService.FIELDS,// inject dbservice fields
        },

        // default database populates
        defaultPopulates: [],

        // database scopes
        scopes: {
            ...DbService.SCOPE,// inject dbservice scope
        },

        // default database scope
        defaultScopes: [...DbService.DSCOPE],// inject dbservice dscope

        // default init config settings
        config: {
            "emails.inbound.logging": false,
            "emails.inbound.hostname": "loon.usa.one-host.ca",
            "emails.inbound.disableVersionString": false,
            "emails.inbound.maxSize": 1024 * 1024 * 10,
            "emails.inbound.authentication": true,
            "emails.inbound.starttls": true,
            "emails.inbound.secure": true,
            "emails.inbound.secured": false,
            "emails.inbound.socketTimeout": 60 * 1000,
            "emails.inbound.maxRecipients": 100,
            "emails.s3.bucket": "emails",
        }
    },

    /**
     * Actions
     */
    actions: {
        // clean db
        clean: {
            async handler(ctx) {

                const entities = await this.findEntities(null, {});
                this.logger.info(`cleaning ${entities.length} entities`);
                // loop entities
                for (let index = 0; index < entities.length; index++) {
                    const entity = entities[index];

                    await this.removeEntity(ctx, {
                        id: entity.id
                    });
                }

            },
        },
    },

    /**
     * Events
     */
    events: {

    },

    /**
     * Methods
     */
    methods: {
        /**
         * server setup
         * 
         * @param {Context} ctx 
         * 
         * @returns {Promise} 
         */
        async setup(ctx) {

            // resolve key and cert
            const [key, ca, cert] = await this.resolveKeyCert(ctx);

            // resolve server options
            const options = await this.resolveServerOptions(ctx);

            const port = [
                25,
                465,
                587,
            ]
            for (let index = 0; index < port.length; index++) {
                const portNumber = port[index];
                // create server
                const server = new SMTPServer({
                    ...options,
                    key,
                    ca,
                    cert,
                    secure: portNumber === 465,
                    port: portNumber,

                    onMailFrom: (address, session, callback) => {
                        this.logger.info(`MAIL FROM:<${address.address}> id=${session.id}`);
                        this.onMailFrom(address, session, server).then(() => {
                            callback();
                        }).catch(err => {
                            this.logger.error(err);
                            callback(err);
                        });
                    },

                    onRcptTo: (address, session, callback) => {
                        this.logger.info(`RCPT TO:<${address.address}> id=${session.id}`);
                        this.onRcptTo(address, session, server).then(() => {
                            callback();
                        }).catch(err => {
                            this.logger.error(err);
                            callback(err);
                        });
                    },

                    onAuth: (auth, session, callback) => {
                        this.logger.info(`AUTH ${auth.method} id=${session.id}`);
                        this.onAuth(auth, session, server).then((user) => {
                            callback(null, {
                                user: user.email
                            });
                        }).catch(err => {
                            this.logger.error(err);
                            callback(err);
                        });
                    },

                    onData: (stream, session, callback) => {
                        this.logger.info(`DATA id=${session.id}`);
                        this.onData(stream, session, server).then(() => {
                            callback();
                        }).catch(err => {
                            this.logger.error(err);
                            callback(err);
                        });
                    },

                    onClose: (session) => {
                        this.logger.info(`CLOSE id=${session.id}`);
                        this.onClose(session, server).then(() => {

                        }).catch(err => {
                            this.logger.error(err);
                        });
                    },

                    onConnect: (session, callback) => {
                        this.logger.info(`CONNECT id=${session.id}`);
                        this.onConnect(session, server).then(() => {
                            callback();
                        }).catch(err => {
                            this.logger.error(err);
                            callback(err);
                        });
                    },
                });

                // start server
                await new Promise((resolve, reject) => {
                    server.listen(portNumber, (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });

                // add server to map
                this.serverMap.set(portNumber, server);

                // log
                this.logger.info(`listening on port ${portNumber}`);

            }
        },

        /**
         * resolve server options
         * 
         * @param {Context} ctx 
         * 
         * @returns {Promise} 
         */
        async resolveServerOptions(ctx) {
            const defaultLogger = {
                debug: this.logger.debug.bind(this.logger),
                info: this.logger.info.bind(this.logger),
                warn: this.logger.warn.bind(this.logger),
                error: this.logger.error.bind(this.logger)
            };

            let serverConfig = {
                // log to console
                logger: this.config["emails.inbound.logging"] ? defaultLogger : false,

                name: this.config["emails.inbound.hostname"] || os.hostname(),

                banner: 'Welcome to ' + this.name + (!this.config["emails.inbound.disableVersionString"] ? '! [' + packageData.name + '/' + packageData.version + ']' : ''),

                size: this.config["emails.inbound.maxSize"],

                // No authentication at this point
                disabledCommands: [].concat(!this.config["emails.inbound.authentication"] ? 'AUTH' : []).concat(!this.config["emails.inbound.starttls"] ? 'STARTTLS' : []),

                // secure: this.config["emails.inbound.secure"],
                // needsUpgrade: this.config["emails.inbound.secure"] && !this.config["emails.inbound.secured"],

                // Socket timeout is set to 10 minutes. This is needed to give enought time
                // for the server to process large recipients lists
                socketTimeout: this.config["emails.inbound.socketTimeout"] || 10 * 60 * 1000,

            };

            // apply additional config options (if set)
            for (let key of [
                'hideSize',
                'authMethods',
                'authOptional',
                'disabledCommands',
                'hideSTARTTLS',
                'hidePIPELINING',
                'hide8BITMIME',
                'hideSMTPUTF8',
                'allowInsecureAuth',
                'disableReverseLookup',
                'sniOptions',
                'maxClients',
                'useProxy',
                'useXClient',
                'useXForward',
                'lmtp',
                'closeTimeout',
                //'secured',
                'banner'
            ]) {
                key = `emails.inbound.${key}`;
                if (this.config[key]) {
                    serverConfig[key] = this.config[key];
                }
            }

            // sni callback
            serverConfig.SNICallback = (servername, callback) => {
                this.logger.info(`SNI id=${servername}`);
                this.SNICallback(servername).then(context => {
                    callback(null, context);
                }).catch(err => {
                    callback(err);
                });
            }

            // return server config
            return serverConfig;
        },

        /**
         * resolve key and cert from v1.certificates service
         * 
         * @param {Context} ctx
         * 
         * @returns {Promise}
         */
        async resolveKeyCert(ctx = this.broker) {
            // resolve key and cert
            let result = await ctx.call("v1.certificates.resolveDomain", {
                domain: this.config["emails.inbound.hostname"]
            });

            // check result
            if (!result) {
                await ctx.call("v1.certificates.letsencrypt.dns", {
                    domain: this.config["emails.inbound.hostname"]
                });
                result = await ctx.call("v1.certificates.resolveDomain", {
                    domain: this.config["emails.inbound.hostname"]
                });
            }
            const { privkey, chain, cert } = result;

            // return key and cert
            return [privkey, chain, cert];
        },

        /**
         * on mail from
         * 
         * @param {String} address
         * @param {Object} session
         * @param {Object} server
         * 
         * @returns {Promise}
         */
        async onMailFrom(address, session, server) {

            if (!session.envelopeID) {
                await this.createEnvelope(session, server);
            }

            // update from
            await this.broker.call("v1.emails.inbound.update", {
                id: session.envelopeID,
                from: addressTools.normalizeAddress(address.address),
            });

            return true;
        },

        /**
         * on rcpt to
         * 
         * @param {String} address
         * @param {Object} session
         * @param {Object} server
         * 
         * @returns {Promise}
         */
        async onRcptTo(address, session, server) {
            if (this.closing) {
                throw new Error('Server shutdown in progress')
            }

            if (!session.envelopeID) {
                await this.createEnvelope(session, server);
            }

            if (session.envelope.rcptTo && session.envelope.rcptTo.length >= this.config['emails.inbound.maxRecipients']) {
                let err = new Error('Too many recipients');
                err.responseCode = 452;
                throw err;
            }

            let validation = isemail.validate(
                // monkey patch unicode character support by replacing non ascii chars with 'x'
                // we do not use the built in DNS resolving by isemail, so it should
                // not break anything but it allows us to use unicode usernames
                (address.address || '').replace(/[\u0080-\uFFFF]/g, 'x'),
                {
                    // method returns 0 if the error level is lower than 17
                    // below 17: address is valid for SMTP but has unusual elements
                    errorLevel: 17
                }
            );

            // 66: rfc5322TooLong
            // 67: rfc5322LocalTooLong
            if (validation && ![66, 67].includes(validation)) {
                let err = new Error('The recipient address <' + address.address + '> is not a valid RFC-5321 address.');
                err.responseCode = 553;
                throw err;
            }

            // add recipient to envelope
            session.envelope.rcptTo.push(address)

            // update envelope with recipient
            await this.broker.call("v1.emails.inbound.update", {
                id: session.envelopeID,
                to: session.envelope.rcptTo.map(item => addressTools.normalizeAddress(item.address)),
            });

            return true;
        },

        /**
         * on auth
         * 
         * @param {Object} auth
         * @param {Object} session
         * @param {Object} server
         * 
         * @returns {Promise}
         */
        async onAuth(auth, session, server) {
            if (this.closing) {
                throw new Error('Server shutdown in progress');
            }

            if (!session.envelopeID) {
                await this.createEnvelope(session, server);
            }


            if (
                // username is always required
                !auth.username ||
                // password is required unless it is XCLIENT
                (!auth.password && auth.method !== 'XCLIENT') ||
                auth.username.length > 1024 ||
                (auth.password && auth.password.length > 1024)
            ) {
                throw new Error('Invalid username or password');
            }

            let user = await this.broker.call("v1.emails.accounts.auth", {
                method: auth.method,
                username: auth.username,
                password: auth.password,
            });

            if (!user) {
                throw new Error('Invalid username or password');
            }

            session.user = user.address;

            // update envelope with user id
            await this.broker.call("v1.emails.inbound.update", {
                id: session.envelopeID,
                user: user.id,
                'server.authMethod': auth.method,
            });

            return user;
        },

        /**
         * on data
         * 
         * @param {Object} stream
         * @param {Object} session
         * @param {Object} server
         * 
         * @returns {Promise}
         */
        async onData(stream, session, server) {
            if (this.closing) {
                throw new Error('Server shutdown in progress');
            }

            return this.handleMessage(stream, session, server)
        },

        /**
         * on close
         * 
         * @param {Object} session
         * @param {Object} server
         * 
         * @returns {Promise}
         */
        async onClose(session, server) {

        },

        /**
         * on connect
         * 
         * @param {Object} session
         * @param {Object} server
         * 
         * @returns {Promise}
         */
        async onConnect(session, server) {

        },

        async handleMessage(stream, session, server) {
            let envelope = await this.broker.call("v1.emails.inbound.get", {
                id: session.envelopeID
            });

            let messageHashStream = new StreamHash({
                algo: 'md5'
            });

            messageHashStream.on('hash', async (data) => {
                await this.broker.call('v1.emails.inbound.update', {
                    id: envelope.id,
                    sourceMd5: data.hash,
                    sourceSize: data.bytes
                });
            });

            stream.on('error', err => messageHashStream.emit('error', err));


            stream.pipe(messageHashStream)

            // store stream to s3
            const s3 = await this.storeMessageStream(envelope, stream);

            // update envelope with source
            await this.broker.call("v1.emails.inbound.update", {
                id: envelope.id,
                s3
            });
        },

        /**
         * close server
         * 
         * @returns {Promise}
         */
        async closeServer() {
            this.closing = true;
            for (let [portNumber, server] of this.serverMap) {
                this.logger.info(`closing server on port ${portNumber}`);
                await new Promise((resolve, reject) => {
                    server.close((err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            }
        },

        /**
         * sni callback
         * 
         * @param {String} servername
         * 
         * @returns {Promise}
         */
        async SNICallback(servername) {

            if (this.sniCache.has(servername)) {
                return this.sniCache.get(servername);
            }

            const [key, ca, cert] = await this.resolveKeyCert(ctx);

            const context = tls.createSecureContext({
                key,
                ca,
                cert
            });

            this.sniCache.set(servername, context);

            return context;
        },

        async createEnvelope(session, server) {

            const envelope = await this.broker.call("v1.emails.inbound.create", {
                session: {
                    sessionID: session.id,
                    localAddress: session.localAddress,
                    localPort: session.localPort,
                    remoteAddress: session.remoteAddress,
                    remotePort: session.remotePort,
                    clientHostname: session.clientHostname,
                    hostNameAppearsAs: session.hostNameAppearsAs,
                    openingCommand: session.openingCommand,
                    transmissionType: session.transmissionType
                },
                server: {
                    hostName: process.env.AGENT_HOSTNAME || this.config['emails.inbound.hostname'],
                    address: process.env.AGENT_HOST || server.server.address().address,
                    port: server.server.address().port,
                    tls: this.config["emails.inbound.secure"],
                    authMethod: 'none',
                },
            });
            session.envelopeID = envelope.id;
            this.logger.info(`created envelope id=${envelope.id}`);
        },
    },

    /**
     * Service created lifecycle event handler
     */
    created() {
        this.closing = false;
        this.sniCache = new Map();
        this.serverMap = new Map();
    },

    /**
     * Service started lifecycle event handler
     */
    async started() {

        await this.setup();
    },

    /**
     * Service stopped lifecycle event handler
     */
    async stopped() {
        await this.closeServer()
    }
};