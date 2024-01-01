const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;

const S3Mixin = require("../mixins/s3-store.mixin");

const fs = require("fs").promises;
const tls = require("tls");
const os = require("os");
const packageData = require("../package.json");

const SMTPServer = require('smtp-server').SMTPServer;


/**
 * This is a in bound smtp agent.  It is used to receive emails from the internet
 * and store them in the s3 bucket for processing. 
 * 
 * For every new connection, a emails.smtp session is created. 
 * Session details will be used by other services for processing.
 * 
 */

module.exports = {
    // name of service
    name: "emails.smtp",
    // version of service
    version: 2,

    /**
     * Service Mixins
     * 
     * @type {Array}
     * @property {DbService} DbService - Database mixin
     * @property {ConfigLoader} ConfigLoader - Config loader mixin
     */
    mixins: [
        ConfigLoader([
            'emails.**'
        ]),
        S3Mixin,
    ],

    /**
     * Service dependencies
     */
    dependencies: [],

    /**
     * Service settings
     * 
     * @type {Object}
     */
    settings: {
        rest: true,

        // default init config settings
        config: {
            "emails.smtp.logging": false,
            "emails.smtp.hostname": "loon.usa.one-host.ca",
            "emails.smtp.disableVersionString": false,
            "emails.smtp.maxSize": 1024 * 1024 * 10,
            "emails.smtp.authentication": true,
            "emails.smtp.starttls": true,
            "emails.smtp.secure": true,
            "emails.smtp.secured": false,
            "emails.smtp.socketTimeout": 60 * 1000,
            "emails.smtp.maxRecipients": 100,
            "emails.s3.bucket": "emails",
        }
    },

    /**
     * service actions
     */
    actions: {

    },

    /**
     * service events
     */
    events: {

    },

    /**
     * service methods
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
            const [key, ca, cert] = await this.resolveKeyCert(this.config["emails.smtp.hostname"]);

            // resolve server options
            const options = await this.resolveServerOptions(ctx);

            const port = [
                25,
                //465,
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
                    needsUpgrade: portNumber === 465 && !this.config["emails.smtp.secured"],
                    port: portNumber,

                    onMailFrom: (address, session, callback) => this.onMailFrom(address.address, session, callback),
                    onRcptTo: (address, session, callback) => this.onRcptTo(address.address, session, callback),
                    onAuth: (auth, session, callback) => this.onAuth(auth, session, callback),
                    onData: (stream, session, callback) => this.onData(stream, session, callback),
                    onClose: (session) => this.onClose(session),
                    onConnect: (session, callback) => this.onConnect(session, callback),
                    onSecure: (socket, session, callback) => this.onSecure(socket, session, callback),
                });

                server.on('error', err => {
                    this.logger.error(err);
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
         * server stop
         * 
         * @returns {Promise}
         */
        async stop() {
            for (let [portNumber, server] of this.serverMap) {
                await new Promise((resolve, reject) => {
                    server.close((err) => {
                        if (err) {
                            reject(err);
                        } else {
                            this.logger.info(`stopped listening on port ${portNumber}`);
                            resolve();
                        }
                    });
                });
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
                logger: this.config["emails.smtp.logging"] ? defaultLogger : false,

                name: this.config["emails.smtp.hostname"] || os.hostname(),

                banner: 'Welcome to ' + this.name + (!this.config["emails.smtp.disableVersionString"] ? '! [' + packageData.name + '/' + packageData.version + ']' : ''),

                size: this.config["emails.smtp.maxSize"],

                // No authentication at this point
                disabledCommands: [].concat(!this.config["emails.smtp.authentication"] ? 'AUTH' : []).concat(!this.config["emails.smtp.starttls"] ? 'STARTTLS' : []),

                // secure: this.config["emails.smtp.secure"],
                // needsUpgrade: this.config["emails.smtp.secure"] && !this.config["emails.smtp.secured"],

                // Socket timeout is set to 10 minutes. This is needed to give enought time
                // for the server to process large recipients lists
                socketTimeout: this.config["emails.smtp.socketTimeout"] || 10 * 60 * 1000,

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
                key = `emails.smtp.${key}`;
                if (this.config[key]) {
                    serverConfig[key] = this.config[key];
                }
            }

            // sni callback
            serverConfig.SNICallback = (servername, callback) => this.SNICallback(servername, callback);

            // return server config
            return serverConfig;
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
            let result = await this.broker.call("v1.certificates.resolveDomain", {
                domain: hostname
            });

            // check result
            if (!result) {
                await this.broker.call("v1.certificates.letsencrypt.dns", {
                    domain: hostname
                });
                result = await this.broker.call("v1.certificates.resolveDomain", {
                    domain: hostname
                });
            }

            if (!result) {
                throw new Error('failed to resolve key and cert');
            }

            this.logger.info(`resolved key and cert for ${hostname}`);

            const { privkey, chain, cert } = result;

            // return key and cert
            return [privkey, chain, cert];
        },

        /**
         * sni callback
         * 
         * @param {String} servername - server name
         * @param {Function} callback - callback function
         * 
         * @returns {Promise}
         */
        async SNICallback(servername, callback) {
            // check servername
            if (!servername) {
                return callback(new Error('invalid servername'));
            }

            // check sni map cache
            if (this.sniMap.has(servername)) {
                console.log(servername, this.sniMap.get(servername))
                return callback(null, this.sniMap.get(servername));
            }

            // resolve key and cert
            const [key, ca, cert] = await this.resolveKeyCert(servername);

            // create tls context
            const context = tls.createSecureContext({
                key,
                ca,
                cert,
            });

            // add context to sni map
            this.sniMap.set(servername, context);

            // callback with context
            callback(null, context);
        },


        /**
         * on mail from event handler
         * If address is invalid, callback with an error. Otherwise, return null.
         * Lookup address in the addressess service. If address is not found, cerate a new address.
         * 
         * @param {String} address - email address
         * @param {Object} session - session object
         * @param {Function} callback - callback function
         * 
         * @returns {Promise}
         */
        async onMailFrom(address, session, callback) {
            // validate address
            if (!address) {
                return callback(new Error('invalid address'));
            }

            // lookup address
            const addressObject = await this.broker.call("v2.emails.addresses.lookup", {
                address,
            });

            // add address to session
            await this.broker.call("v2.emails.sessions.addFrom", {
                id: session.sessionID,
                address: addressObject.id,
            });

            this.logger.info(`from: ${addressObject.id}`);

            // add address to session 
            session.from = addressObject.id;

            // check blacklist is enabled
            if (this.config["emails.smtp.blacklist"]) {
                //
            }

            // callback with null
            callback(null);
        },

        /**
         * on rcpt to event handler. check if address is valid and active
         * 
         * 
         * @param {String} address - email address
         * @param {Object} session - session object
         * @param {Function} callback - callback function
         * 
         * @returns {Promise}
         */
        async onRcptTo(address, session, callback) {
            // validate address
            if (!address) {
                return callback(new Error('invalid address'));
            }

            // lookup address
            const addressObject = await this.broker.call("v2.emails.addresses.lookup", {
                address,
            });

            // add address to session
            await this.broker.call("v2.emails.sessions.addTo", {
                id: session.sessionID,
                address: addressObject.id,
            });

            this.logger.info(`to: ${addressObject.id}`);

            // add address to session
            session.to.push(addressObject.id);

            // check blacklist is enabled
            if (this.config["emails.smtp.blacklist"]) {
                //
            }

            // callback with null
            callback(null);
        },

        /**
         * on auth event handler
         * 
         * @param {Object} auth - auth object
         * @param {Object} session - session object
         * @param {Function} callback - callback function
         * 
         * @returns {Promise}
         */
        async onAuth(auth, session, callback) {

        },

        /**
         * on data event handler. 
         * store stream to file and then upload to s3 bucket
         * 
         * @param {Object} stream - stream object
         * @param {Object} session - session object
         * @param {Function} callback - callback function
         * 
         * @returns {Promise}
         */
        async onData(stream, session, callback) {
            // upload stream to s3
            const s3Object = await this.storeMessageStream(stream);

            this.logger.info(`uploaded stream to s3://${s3Object.bucket}/${s3Object.name}`);

            // from address
            const from = session.from;
            // to addresses
            const to = session.to;

            // create envelope
            const envelope = await this.broker.call("v2.emails.envelopes.create", {
                session: session.sessionID,
                from,
                to,
                bucket: s3Object.bucket,
                key: s3Object.name,
                size: s3Object.size,
            });

            // add envelope to session
            await this.broker.call("v2.emails.sessions.addEnvelope", {
                id: session.sessionID,
                envelope: envelope.id,
            });

            this.logger.info(`created envelope ${envelope.id}`);

            // clear session from and to
            session.from = null;
            session.to = [];

            // check blacklist is enabled
            if (this.config["emails.smtp.blacklist"]) {
                // TODO: check envelope is valid
            }


            // callback with null
            callback(null);
        },

        /**
         * on close event handler, called when client disconnects
         * close out the session
         * 
         * @param {Object} session - session object
         * 
         * @returns {Promise}
         */
        async onClose(session) {
            // remove session from session map
            this.sessionMap.delete(session.sessionID);

            // close session
            await this.broker.call("v2.emails.sessions.close", {
                id: session.sessionID,
            });
        },

        /** 
         * on connect event handler, called when client connects
         * create a new session object through the emails.sessions service
         * 
         * @param {Object} session - session object
         * @param {Function} callback - callback function
         * 
         * @returns {Promise}
         */
        async onConnect(session, callback) {

            const sessionObject = await this.broker.call("v2.emails.sessions.create", {
                localAddress: session.localAddress,
                localPort: session.localPort,
                remoteAddress: session.remoteAddress,
                remotePort: session.remotePort,
                clientHostname: session.clientHostname,
                hostNameAppearsAs: session.hostNameAppearsAs,
                openingCommand: session.openingCommand,
            });

            this.logger.info(`created session ${sessionObject.id}`);

            // add sessionID to session object
            session.sessionID = sessionObject.id;

            // session from address
            session.from = null;
            session.to = [];

            // add session to session map
            this.sessionMap.set(session.sessionID, session);

            if (this.config["emails.smtp.blacklist"]) {
                // TODO: check sessionObject is valid
            }

            // callback with null
            callback(null);
        },

        /**
         * on secure event handler, called when client connects using tls
         * 
         * @param {Object} socket - socket object
         * @param {Object} session - session object
         * @param {Function} callback - callback function
         * 
         * @returns {Promise}
         */
        async onSecure(socket, session, callback) {

        },
    },

    /**
     * service created lifecycle event handler
     */
    created() {
        // create server map
        this.serverMap = new Map();

        // create sni map
        this.sniMap = new Map();

        // create session map
        this.sessionMap = new Map();
    },

    /**
     * service started lifecycle event handler
     */
    async started() {
        // setup server
        await this.setup();
    },

    /**
     * service stopped lifecycle event handler
     */
    async stopped() {
        await this.stop();
    }
}


