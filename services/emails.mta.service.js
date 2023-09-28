const nodemailer = require("nodemailer");
const SMTPConnection = require("nodemailer/lib/smtp-connection");
const { MoleculerClientError } = require("moleculer").Errors;



/**
 * MTA Service 
 * This service is responsible for sending emails using SMTP transport npm modules as it base.
 * emails to be sent will be pulled from the v1.emails.queue service.
 * TLS keys will pulled from the v1.certificates service.
 * Mailbox credentials will be pulled from the v1.emails.mailboxes service.
 * DNS lookup will be performed using the v1.resolver service.
 * 
 * 
 * @see {@link https://github.com/nodemailer/smtp-transport|Nodemailer-SMTP-Transport}
 * 
 * @version 1.0.0
 */
module.exports = {
    name: "emails.mta",

    version: 1,

    mixins: [

    ],

    /**
     * Service dependencies
     */
    dependencies: [
        "v1.emails.queue",
        "v1.certificates",
        //"v1.emails.mailboxes",
        "v1.resolver"
    ],

    /**
     * Service settings
     */
    settings: {
        clientHostname: process.env.CLIENT_HOSTNAME || "my-client-hostname",
    },

    /**
     * Actions
     */
    actions: {


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
         * Setup connection pools for outbound SMTP connections
         * 
         * @returns {Promise}
         */
        async setupConnectionPools() {
            // create a connection pool for each transport
            this.connectionPools = new Map();

        },

        /**
         * Close all connections
         * 
         * @returns {Promise}
         */
        async closeAllConnections() {
            // close all connections in all connection pools

            for (let connectionPool of this.connectionPools.values()) {
                await this.closeConnectionPoolConnections(connectionPool);
            }
        },

        /**
         * Close all connections in a connection pool
         * 
         * @param {Object} connectionPool - connection pool object
         * 
         * @returns {Promise}
         */
        async closeConnectionPoolConnections(connectionPool) {
            // close all connections in a connection pool

            for (let connection of connectionPool.pool.values()) {
                await this.closeConnection(connection);
            }
        },

        /**
         * Close a connection
         * 
         * @param {Object} connection - SMTP connection object
         * 
         * @returns {Promise}
         */
        async closeConnection(connection) {
            // close a connection

            if (connection) {
                connection.close();
            }
        },

        /**
         * create new connection pool
         * 
         * @param {String} transportName
         * @param {Object} transportConfig
         * 
         * @returns {Promise}
         */
        async createConnectionPool(transportName) {
            // create a new connection pool
            // add it to the connection pools
            // return the connection pool

            // lookup the transport config
            const transportConfig = await this.broker.call("v1.emails.mta.transports.lookup", {
                name: transportName
            });

            // get the client hostname
            const clientHostname = this.settings.clientHostname;



            this.connectionPools.set(transportName, {
                transport: {
                    name: transportName,
                    config: {
                        port: 587, // Defaults to 25 or 465
                        //host: 'localhost', // Defaults to 'localhost'
                        secure: false, // Defaults to false (not using SSL)
                        ignoreTLS: false, // Defaults to false (STARTTLS support is enabled)
                        requireTLS: true, // Defaults to false (client can use STARTTLS but doesn't force it)
                        opportunisticTLS: true, // Defaults to false (client tries STARTTLS but continues if it fails)
                        name: 'mail.one-host.ca', // Optional client hostname for identifying to the server
                        localAddress: '0.0.0.0', // Local interface to bind to for network connections
                        connectionTimeout: 10000, // Milliseconds to wait for the connection to establish
                        greetingTimeout: 5000, // Milliseconds to wait for the greeting after the connection is established
                        socketTimeout: 30000, // Milliseconds of inactivity to allow
                        dnsTimeout: 30000, // Time to wait in ms for DNS requests to be resolved (defaults to 30 seconds)
                        logger: true, // Set to true to log to console or provide a bunyan compatible logger instance
                        transactionLog: false, // Set to true to log SMTP traffic without message content
                        debug: false, // Set to true to log SMTP traffic and message content
                        authMethod: 'PLAIN', // Preferred authentication method, e.g., 'PLAIN'
                        tls: { rejectUnauthorized: true }, // Additional options for the socket constructor, e.g., {rejectUnauthorized: true}
                    },

                },
                exchanges: new Map(),
                pool: new Map()
            });

            await this.updateConnectionPoolExchanges(transportName);

            return this.connectionPools.get(transportName);
        },

        /**
         * get a connection pool
         * 
         * @param {String} transportName
         * 
         * @returns {Promise}
         */
        async getConnectionPool(transportName) {
            // get a connection pool
            // if the connection pool does not exist create it
            // return the connection pool

            if (!this.connectionPools.has(transportName)) {
                return this.createConnectionPool(transportName);
            }

            return this.connectionPools.get(transportName);
        },

        /**
         * Create a new connection
         * 
         * @param {String} transportName
         * @param {String} connectionPoolName
         * @param {Object} connectionConfig
         * 
         * @returns {Promise}
         */
        async createConnection(transportName) {
            // get the connection pool
            const connectionPool = this.getConnectionPool(transportName);

            const exchange = connectionPool.exchanges.get("default");

            // create the connection config
            const connectionConfig = {
                host: exchange.exchange,
                port: 465,
                secure: true,
                dkim: {
                    domainName: "example.com",
                    keySelector: "2017",
                    privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg..."
                }
            };

            // create the connection
            const connection = nodemailer.createTransport(connectionConfig);


            connectionPool.pool.set(exchange.exchange, connection);

            return connection;
        },

        /**
         * Get a connection from a connection pool
         * 
         * @param {String} transportName
         * @param {String} connectionPoolName
         * 
         *  @returns {Promise}
         */
        async getConnection(transportName) {
            // get a connection pool
            const connectionPool = this.getConnectionPool(transportName);

            // get the default exchange
            const exchange = connectionPool.exchanges.get("default");

            // get the connection from the connection pool
            let connection = connectionPool.pool.get(exchange.exchange);

            // if the connection does not exist create it
            if (!connection) {
                connection = await this.createConnection(transportName);
            }

            // return the connection
            return connection;
        },


        /**
         * Update connection pool exchanges
         * 
         * @param {String} transportName
         * 
         * @returns {Promise}
         */
        async updateConnectionPoolExchanges(transportName) {
            // get the connection pool
            const connectionPool = this.getConnectionPool(transportName);

            // get the connection pool transport config
            const transportConfig = connectionPool.transport.config;

            // resolve MX records for the connection pool host
            const exchanges = await this.resolveMX(transportConfig.host);

            // set the default exchange
            let defaultExchange = {
                priority: 0,
                exchange: transportConfig.host
            };

            for (let exchange of exchanges) {
                if (exchange.priority < defaultExchange.priority) {
                    defaultExchange = exchange;
                }
                // add the exchange to the connection pool
                connectionPool.exchanges.set(exchange.exchange, exchange);
            }

            // set the default exchange
            connectionPool.exchanges.set("default", defaultExchange);

            // return the connection pool
            return connectionPool;
        },


        /**
         * Resolve MX records for a domain
         * 
         * @param {String} domain
         * 
         * @returns {Promise}
         */
        async resolveMX(domain) {
            // use the resolver service to resolve MX records for a domain
            // return the MX records array [{priority, exchange}, ...]
            return this.broker.call("v1.resolver.resolve", { domain, type: "MX" });
        },

        /**
         * Get the dkim keys for sender domain 
         * 
         * @param {String} sender
         * 
         * @returns {Promise}
         */
        async getDKIMKeys(sender) {
            // get domain from sender
            const domain = sender.split("@")[1];

            // get the dkim keys for sender domain
            return this.broker.call("v1.certificates.resolveDKIM", { domain });
        }

    },

    /**
     * Service created lifecycle event handler
     */
    created() {
        this.setupConnectionPools();
    },

    /**
     * Service started lifecycle event handler
     */
    async started() {

    },

    /**
     * Service stopped lifecycle event handler
     */
    async stopped() {
        await this.closeAllConnections();
    }
};