const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;

const net = require('net');
const tls = require('tls');
const { Context } = require("moleculer");


/**
 * Building an IMAP server from scratch is a substantial task involving adherence to the IMAP protocol (RFC 3501),
 * handling socket connections, authentication, command parsing, and much more.
 */


module.exports = {
    // name of service
    name: "emails.imap",
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
            "emails.imap.port": 143,
            "emails.imap.tls": false,
            "emails.imap.tlsPort": 993,
            "emails.imap.hostname": "example.com",
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
         * create net server on port 143
         * 
         * @param {Context} ctx - moleculer context
         * 
         * @returns {Promise}
         */
        async createServer(ctx) {

            const port = this.config["emails.imap.port"];

            // create tcp server
            const server = net.createServer((socket) => {
                // handle socket connection
                this.handleSocketConnection(socket);
            });

            // set server
            this.server = server;

            // error handler
            server.on('error', (err) => {
                this.logger.error(`IMAP server error: ${err.message}`);
            });


            // listen on port 143
            server.listen(port, () => {
                this.logger.info(`IMAP server listening on port ${port}`);
            });

            return server;
        },

        /**
         * create tls server on port 993
         * 
         * @param {Context} ctx - moleculer context
         * 
         * @returns {Promise}
         */
        async createTlsServer(ctx) {

            const port = this.config["emails.imap.tlsPort"];

            const [key, ca, cert] = await this.resolveKeyCert(this.config["emails.imap.hostname"]);

            // create tls server
            const server = tls.createServer({
                key,
                ca,
                cert,
                requestCert: true,
                rejectUnauthorized: false
            }, (socket) => {
                // handle socket connection
                this.handleSocketConnection(socket);
            });

            // set server
            this.tls = server;

            // error handler
            server.on('error', (err) => {
                this.logger.error(`IMAP server error: ${err.message}`);
            });

            // listen on port 993
            server.listen(port, () => {
                this.logger.info(`IMAP server listening on port ${port}`);
            });

            return server;
        },

        /**
         * handle socket connection
         * 
         * @param {Socket} socket - socket connection
         * 
         * @returns {Promise}
         */
        async handleSocketConnection(socket) {

        },

        /**
         * upgrade socket connection to tls
         * 
         * @param {Socket} socket - socket connection
         * 
         * @returns {Promise} tls socket
         */
        async upgradeSocketToTls(socket) {
            // upgrade socket to tls
            const tlsSocket = new tls.TLSSocket(socket, {
                secureContext: tls.createSecureContext({
                    key: this.key,
                    cert: this.cert,
                    ca: this.ca
                }),
                isServer: true,
                requestCert: true,
                rejectUnauthorized: false
            });
            return tlsSocket;
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
    },

    /**
     * Service created lifecycle event handler
     */
    created() {
        this.server = null;
        this.tls = null;
    },

    /**
     * Service started lifecycle event handler
     */
    async started() { },

    /**
     * Service stopped lifecycle event handler
     */
    async stopped() { }
}


