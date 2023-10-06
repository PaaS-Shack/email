const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");
const { MoleculerClientError } = require("moleculer").Errors;

const nodemailer = require("nodemailer");
const SMTPServer = require('smtp-server').SMTPServer;

/**
 * this is a outbound email service
 */

module.exports = {
    // name of service
    name: "emails.outbound",
    // version of service
    version: 1,

    /**
     * Service Mixins
     * 
     * @type {Array}
     * @property {DbService} DbService - Database mixin
     * @property {ConfigLoader} ConfigLoader - Config loader mixin
     */
    mixins: [
        DbService({
            permissions: 'emails.outbound'
        }),
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

        fields: {

            // to email address
            to: {
                type: "string",
                required: true,
            },

            // from email address
            from: {
                type: "string",
                required: true,
            },

            // email subject
            subject: {
                type: "string",
                required: true,
            },

            // email text
            text: {
                type: "string",
                required: true,
            },

            // email info
            info: {
                type: "object",
                required: true,
            },

            ...DbService.FIELDS,// inject dbservice fields
        },
        defaultPopulates: [],

        scopes: {
            ...DbService.SCOPE,
        },

        defaultScopes: [
            ...DbService.DSCOPE,
        ],

        // default init config settings
        config: {
            'emails.outbound.dkim.domainName': 'example.com',
            'emails.outbound.dkim.keySelector': '2017',
        }
    },

    /**
     * service actions
     */
    actions: {
        /**
         * send email
         * 
         * @actions
         * @param {String} to - email address to send to
         * @param {String} from - email address to send from
         * @param {String} subject - email subject
         * @param {String} text - email text
         * 
         * @returns {Object} email - email object
         */
        send: {
            params: {
                to: {
                    type: "email",
                    required: true,
                },
                from: {
                    type: "email",
                    required: true,
                },
                subject: {
                    type: "string",
                    required: true,
                },
                text: {
                    type: "string",
                    required: true,
                },
            },
            async handler(ctx) {
                const { to, from, subject, text } = ctx.params;

                const email = await this.sendEmail(ctx, {
                    to,
                    from,
                    subject,
                    text,
                });

                return email;
            },
        },

        /**
         * create transport pool
         * 
         * @actions
         * @param {String} mxHost - mx host
         * 
         * @returns {Object} pool - pool object
         */
        createPool: {
            params: {
                mxHost: {
                    type: "string",
                    required: true,
                },
            },
            async handler(ctx) {
                const { mxHost } = ctx.params;

                const pool = await this.createPool(ctx, mxHost);

                return pool;

            }
        },

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
     * service events
     */
    events: {
        /**
         * emails.messages.queued event handler
         */
        "emails.messages.queued": {
            async handler(ctx) {
                const message = ctx.params;

                this.logger.info(`queued ${message.id} now sending`);

                const pool = await this.getPool(ctx, message.to[0]);

                if (!pool) {
                    throw new Error('no pool');
                }

                // resolve dkim
                const dkim = await ctx.call('v1.certificates.resolveDKIM', {
                    domain: message.from.split('@')[1],
                });

                // send email
                const info = await pool.sendMail({
                    ...message,
                    dkim: {
                        domainName: this.config['emails.outbound.dkim.domainName'],
                        keySelector: this.config['emails.outbound.dkim.keySelector'],
                        privateKey: dkim.privkey,
                    }
                });

                // update message status and info
                await ctx.call('v1.emails.messages.update', {
                    id: message.id,
                    state: info.accepted.length > 0 ? 'delivered' : info.rejected.length > 0 ? 'rejected' : 'failed',
                    ...info
                });
                console.log(info)
            },
        },
    },

    /**
     * service methods
     */
    methods: {
        /**
         * send email
         * 
         * @param {Object} ctx - context
         * @param {Object} params - params
         * 
         * @returns {Object} email - email object
         */
        async sendEmail(ctx, params) {
            const { to, from, subject, text } = params;

            const pool = await this.getPool(ctx, to);

            // resolve dkim
            const dkim = await ctx.call('v1.certificates.resolveDKIM', {
                domain: from.split('@')[1],
            });

            // send email
            const info = await pool.sendMail({
                from,
                to,
                subject,
                text,
                dkim: {
                    domainName: this.config['emails.outbound.dkim.domainName'],
                    keySelector: this.config['emails.outbound.dkim.keySelector'],
                    privateKey: dkim.privkey,
                }
            });

            // create email
            const email = await this.createEntity(ctx, {
                to,
                from,
                subject,
                text,
                info,
            });

            return email;
        },

        /**
         * create pool
         * try 465, 587, 25
         * 
         * @param {Object} ctx - context
         * @param {String} mxHost - mx host
         * 
         * @returns {Object} pool - pool object
         */
        async createPool(ctx, mxHost) {
            // create pool
            let pool = null;
            // try 465, 587, 25

            const ports = [25, 587, 465];

            // loop ports
            for (let index = 0; index < ports.length; index++) {
                const port = ports[index];

                // create pool
                await this.createTransport(ctx, mxHost, port, port == 465, port != 465)
                    .then(transport => {
                        pool = transport;
                        this.logger.info(`createPool ${mxHost} ${port} success`);
                    }).catch(err => {
                        this.logger.error(`createPool ${mxHost} ${port} ${err.message}`);
                    });
                if (pool) {
                    break;
                }
            }

            return pool;
        },

        /**
         * create transport
         * 
         * @param {Object} ctx - context
         * @param {String} mxHost - mx host
         * @param {Number} port - port number
         * @param {Boolean} secure - secure flag
         * @param {Boolean} starttls - starttls flag
         * 
         * @returns {Object} transport - transport object
         */
        async createTransport(ctx, mxHost, port, secure, starttls) {

            this.logger.info(`createTransport ${mxHost} ${port} ${secure} ${starttls}`);

            // create transport
            const transport = nodemailer.createTransport({
                pool: true,
                host: mxHost,
                port,
                secure, // use TLS
                name: this.config["emails.outbound.hostname"],
            });

            //watch error
            transport.on('error', err => {
                this.logger.error(`createTransport ${mxHost} ${port} ${err.message}`);
            });


            // watch close
            transport.on('close', () => {
                this.logger.info(`createTransport ${mxHost} ${port} close`);
            });
            return new Promise(async (resolve, reject) => {
                transport.on('error', reject)

                transport.once('idle', () => {
                    resolve(transport)
                    // remove error handler
                    transport.removeListener('error', reject);

                });
            });
        },

        /**
         * get pool
         * 
         * @param {Object} ctx - context
         * @param {String} to - to email address
         * 
         * @returns {Object} pool - pool object
         */
        async getPool(ctx, to) {

            const fqdn = to.split('@')[1];

            // get pool
            let pool = this.pools.get(fqdn);

            if (pool) {
                return pool;
            }

            this.logger.info(`getPool MX ${to}`);

            // resolve mx records
            const mxRecords = await ctx.call('v1.resolver.resolve', {
                fqdn: fqdn,
                type: 'MX'
            });

            // check mx records
            if (!mxRecords || mxRecords.length === 0) {
                throw new MoleculerClientError("no mx records found", 404);
            }

            // get mx record
            const mxRecord = mxRecords.sort((a, b) => {
                return b.priority - a.priority;
            }).shift();

            // get mx record host
            const mxHost = mxRecord.exchange;

            this.logger.info(`getPool exchange ${to} ${mxHost}`);

            // check pool
            if (!pool) {
                // create pool
                pool = await this.createPool(ctx, mxHost);

                // set pool
                this.pools.set(fqdn, pool);
            }

            return pool;
        },

        /**
         * create outbound smtp server
         * 
         * @param {Object} ctx - context
         * @param {Object} params - params
         * 
         * @returns {Object} server - server object
         */
        async createServer(ctx) {

            const portNumber = 465;

            // resolve key and cert
            const [key, ca, cert] = await this.resolveKeyCert(this.config["emails.outbound.hostname"]);

            // resolve server options
            const options = await this.resolveServerOptions(ctx);

            const server = new SMTPServer({
                logger: false,

                name: this.config["emails.outbound.hostname"],

                banner: 'Welcome to ' + this.name,

                size: this.config["emails.outbound.maxSize"],

                // No authentication at this point
                disabledCommands: [],

                // Socket timeout is set to 10 minutes. This is needed to give enought time
                // for the server to process large recipients lists
                socketTimeout: this.config["emails.outbound.socketTimeout"] || 10 * 60 * 1000,

                key,
                ca,
                cert,

                secure: true,
                needsUpgrade: true,
                port: portNumber,

                SNICallback: (servername, callback) => {
                    this.logger.info(`SNI id=${servername}`);
                    this.SNICallback(servername).then(context => {
                        callback(null, context);
                    }).catch(err => {
                        callback(err);
                    });
                },

                onAuth: (auth, session, callback) => {
                    this.logger.info(`AUTH ${auth.method} id=${session.id}`);
                    this.onAuth(auth, session).then(user => {
                        callback(null, { user });
                    }).catch(err => {
                        callback(err);
                    });
                },
                onMailFrom: (address, session, callback) => {
                    this.logger.info(`MAIL FROM:<${address.address}> id=${session.id}`);

                },

                onRcptTo: (address, session, callback) => {
                    this.logger.info(`RCPT TO:<${address.address}> id=${session.id}`);

                },

                onAuth: (auth, session, callback) => {
                    this.logger.info(`AUTH ${auth.method} id=${session.id}`);

                },

                onData: (stream, session, callback) => {
                    this.logger.info(`DATA id=${session.id}`);

                },

                onClose: (session) => {
                    this.logger.info(`CLOSE id=${session.id}`);

                },

                onConnect: (session, callback) => {
                    this.logger.info(`CONNECT id=${session.id}`);

                },

                onSecure: (socket, session, callback) => {

                },
            });

            this.server = server;

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
            const { privkey, chain, cert } = result;

            // return key and cert
            return [privkey, chain, cert];
        },
        /**
                 * on auth
                 * 
                 * @param {Object} auth
                 * @param {Object} session
                 * 
                 * @returns {Promise}
                 */
        async onAuth(auth, session) {
            if (this.closing) {
                throw new Error('Server shutdown in progress');
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

            return user;
        },
        /**
         * close pools
         */
        async closePools() {
            // loop pools
            for (const [key, pool] of this.pools) {
                // close pool
                await pool.close().catch(err => {
                    this.logger.error(`closePool ${key} ${err.message}`);
                });
            }
        }

    },

    created() {
        this.pools = new Map();
    },

    async started() { },

    async stopped() {
        return this.closePools();
    },

};


