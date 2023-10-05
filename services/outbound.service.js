const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");
const { MoleculerClientError } = require("moleculer").Errors;

const nodemailer = require("nodemailer");

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

            // resolve mx records
            const mxRecords = await ctx.call('v1.resolver.resolve', {
                fqdn: to.split('@')[1],
                type: 'MX'
            });

            // check mx records
            if (!mxRecords || mxRecords.length === 0) {
                throw new MoleculerClientError("no mx records found", 404);
            }

            // get mx record
            const mxRecord = mxRecords[0];

            // get mx record host
            const mxHost = mxRecord.exchange;

            // get pool
            let pool = this.pools.get(mxHost);

            // check pool
            if (!pool) {
                // create pool
                pool = await this.createPool(ctx, mxHost);

                // set pool
                this.pools.set(mxHost, pool);
            }

            // resolve dkim
            const dkim = await ctx.call('v1.certificates.resolveDKIM', {
                domain: from.split('@')[1],

            })


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

            const ports = [465, 587, 25];

            // loop ports
            for (let index = 0; index < ports.length; index++) {
                const port = ports[index];

                // create pool
                await this.createTransport(ctx, mxHost, port, true, false)
                    .then(transport => {
                        pool = transport;
                    }).catch(err => {
                        this.logger.error(err);
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
            // create transport
            let transport = null;

            // create transport
            transport = nodemailer.createTransport({
                host: mxHost,
                port,
                secure, // use TLS
                tls: {
                    // do not fail on invalid certs
                    rejectUnauthorized: false
                }
            });

            // test transport
            await transport.verify();

            return transport;
        }

    },

    created() {
        this.pools = new Map();
    },

    async started() { },

    async stopped() { },

}


