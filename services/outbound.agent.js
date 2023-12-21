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

        /**
         * validate to address
         * 
         * @actions
         * @param {String} to - to email address
         * 
         * @returns {Object} result - result object
         */
        validateTo: {
            params: {
                to: {
                    type: "string",
                    required: true,
                },
            },
            async handler(ctx) {
                const { to } = ctx.params;

                const result = await this.validateTo(ctx, to);

                return result;
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
                const id = ctx.params.id;

                const message = await ctx.call('v1.emails.messages.get', {
                    id,
                });

                if (!message) {
                    throw new Error('no message');
                }

                this.logger.info(`queued ${message.id} now sending`);


                // group by to by mx host
                const tos = message.to.reduce((acc, to) => {
                    const fqdn = to.split('@')[1];
                    if (!acc[fqdn]) {
                        acc[fqdn] = [];
                    }
                    acc[fqdn].push(to);
                    return acc;
                }, {});

                // loop tos
                for (const [fqdn, to] of Object.entries(tos)) {

                    const pool = await this.getPool(ctx, to[0]);

                    if (!pool) {
                        this.logger.error(`sendPoolEmail ${fqdn} no pool`);
                        continue;
                    }
                    // send email
                    await this.sendPoolEmail(ctx, pool, to, message)
                        .then(email => {
                            this.logger.info(`sendPoolEmail ${fqdn} ${email.id} ${email.state}`);
                        })
                        .catch(err => {
                            this.logger.error(`sendPoolEmail ${fqdn} ${err.message}`);
                        });
                }

            },
        },
    },

    /**
     * service methods
     */
    methods: {
        /**
         * send pool email
         * 
         * @param {Object} ctx - context
         * @param {Object} pool - pool object
         * @param {String} to - to email address
         * @param {Object} message - message object
         */
        async sendPoolEmail(ctx, pool, to, message) {
            // resolve dkim
            const dkim = await ctx.call('v1.certificates.resolveDKIM', {
                domain: message.from.split('@')[1],
            });

            // send email
            const info = await pool.sendMail({
                ...message,
                to,
                dkim: {
                    domainName: this.config['emails.outbound.dkim.domainName'],
                    keySelector: this.config['emails.outbound.dkim.keySelector'],
                    privateKey: dkim.privkey,
                }
            });

            // set info date
            info.date = Date.now();
            // set info host
            info.host = this.config["emails.outbound.hostname"];
            // set pool mx
            info.mx = pool.mx;


            // update message status and info
            return ctx.call('v1.emails.messages.addInfo', {
                id: message.id,
                info
            });
        },
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

            transport.mx = mxHost;

            //watch error
            transport.on('error', err => {
                this.logger.error(`createTransport ${mxHost} ${port} ${err.message}`);
            });
            transport.on('close', () => {
                this.logger.info(`createTransport ${mxHost} ${port} close`);
            });
            transport.on('idle', () => {
                this.logger.info(`createTransport ${mxHost} ${port} idle`);
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
            const mxRecords = await ctx.call('v1.utils.dns.lookup', {
                host: fqdn,
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
                pool.on('end', () => {
                    this.logger.info(`getPool ${mxHost} end`);
                    this.pools.delete(fqdn);
                });
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
                    this.onAuth(auth, session).then(async (user) => {
                        this.logger.info(`AUTH ${auth.method} id=${session.id} success`);
                        if (!session.envelopeID) {
                            await this.createEnvelope(session);
                        }
                        callback(null, { user });
                    }).catch(err => {
                        this.logger.info(`AUTH ${auth.method} id=${session.id} ${err.message}`);
                        callback(err);
                    });
                },
                onMailFrom: (address, session, callback) => {
                    this.logger.info(`MAIL FROM:<${address.address}> id=${session.id}`);
                    this.validateFrom(this.broker, address.address, session.user.id).then(result => {
                        this.logger.info(`MAIL FROM:<${address.address}> id=${session.id} success`);
                        callback(null, result);
                    }).catch(err => {
                        this.logger.info(`MAIL FROM:<${address.address}> id=${session.id} ${err.message}`);
                        callback(null, err.message);
                    })

                },

                onRcptTo: (address, session, callback) => {
                    this.logger.info(`RCPT TO:<${address.address}> id=${session.id}`);
                    this.validateTo(this.broker, address.address, session.user.id).then(result => {
                        this.logger.info(`RCPT TO:<${address.address}> id=${session.id} success`);
                        callback(null, result);
                    }).catch(err => {
                        this.logger.info(`RCPT TO:<${address.address}> id=${session.id} ${err.message}`);
                        callback(null, err.message);
                    });
                },

                onData: (stream, session, callback) => {
                    this.logger.info(`DATA id=${session.id}`);
                    this.storeMessage(this.broker, session, stream).then(result => {
                        this.logger.info(`DATA id=${session.id} success`);

                        // send message queued event
                        this.broker.emit('emails.outbound.queued', {
                            id: session.envelopeID,
                        });

                        callback(null, result);
                    }).catch(err => {
                        this.logger.info(`DATA id=${session.id} ${err.message}`);
                        callback(null, err.message);
                    });
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

            session.user = user;

            return user;
        },

        /**
         * validate from address
         * 
         * @param {Object} ctx - context
         * @param {String} from - from email address
         * @param {String} user - user id
         * 
         * @returns {Promise} 
         */
        async validateFrom(ctx, from, user) {
            // validate from address
            
            const result = await ctx.call("v1.emails.accounts.validateFrom", {
                from,
                user,
            });

            return result;
        },

        /**
         * validate to address
         * 
         * @param {Object} ctx - context
         * @param {String} to - to email address
         * @param {String} user - user id
         * 
         * @returns {Promise}
         */
        async validateTo(ctx, to) {

            const fqdn = to.split('@')[1];

            // resolve mx records
            const mxRecords = await ctx.call('v1.utils.dns.lookup', {
                host: fqdn,
                type: 'MX'
            });

            // check mx records
            if (!mxRecords || mxRecords.length === 0) {
                throw new MoleculerClientError("no mx records found", 404);
            }

            return true;
        },

        /**
         * store email message stream in S3
         * 
         * @param {Object} ctx - context
         * @param {Object} session - session
         * @param {Stream} stream - stream object
         * 
         * @returns {Promise}
         */
        async storeMessage(ctx, session, stream) {
            // store message

            // store stream to s3
            const s3 = await this.storeMessageStream({
                id: session.envelopeID,
            }, stream);

            // set s3 to outbound message
            const result = await this.updateEntity(ctx, {
                id: session.envelopeID,
                s3,
            });

            return result;
        },


        async createEnvelope(session) {

            const envelope = await this.broker.call("v1.emails.outbound.create", {});
            session.envelopeID = envelope.id;
            this.logger.info(`created envelope id=${envelope.id}`);
        },
        /**
         * close pools
         */
        async closePools() {
            // loop pools
            for (const [key, pool] of this.pools) {
                // close pool
                try {
                    pool.close()
                } catch (err) {
                    this.logger.error(`closePools ${err.message}`)
                }
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


