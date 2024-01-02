const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;
const { v4: uuidv4 } = require('uuid');


/**
 * after envelope is stored in s3 and processed by the emails.processing service
 * 
 * attachments: [],
  from: [ '5Wa84WbGQ5TGX6yLdnqr' ],
  to: [],
  cc: [],
  bcc: [],
  replyTo: [],
  headers: Map(15) {
    
  },
  subject: 'Fwd: Hey',
  body: 'Tim.\n',
  date: 2024-01-01T03:47:04.000Z,
  messageId: '<CAHu8G9tCtZWih=4UjQvBsbeV+K_BBjScAL-X9SrgBaGG9JKkvA@mail.gmail.com>',
  hash: '<CAHu8G9tCtZWih=4UjQvBsbeV+K_BBjScAL-X9SrgBaGG9JKkvA',
  priority: undefined,
  xPriority: undefined,
  userAgent: undefined,
  mimeVersion: '1.0',
  contentType: 'multipart/mixed',
  contentTransferEncoding: undefined
 */

module.exports = {
    // name of service
    name: "emails",
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
        DbService({}),
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

            // envelope id
            envelope: {
                type: "string",
                required: false,
                populate: {
                    action: "v2.emails.envelopes.get",
                }
            },

            // from address
            from: {
                type: "string",
                required: true,
                populate: {
                    action: "v2.emails.addresses.resolve",
                },
            },

            // to address
            to: {
                type: "array",
                required: true,
                items: "string",
                populate: {
                    action: "v2.emails.addresses.resolve",
                },
            },

            // cc address
            cc: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.addresses.resolve",
                },
            },

            // bcc address
            bcc: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.addresses.resolve",
                },
            },

            // subject
            subject: {
                type: "string",
                required: true,
            },

            // text body
            text: {
                type: "string",
                required: true,
            },

            // html body
            html: {
                type: "string",
                required: false,
            },

            // message id
            messageId: {
                type: "string",
                required: false,
                readonly: true,
                onCreate: ({ ctx }) => {
                    if (ctx.params.messageId) {
                        return ctx.params.messageId;
                    } else {
                        return `<${uuidv4()}@${this.config['emails.outbound.hostname']}>`
                    }
                }
            },

            // date
            date: {
                type: "number",
                required: false,
                readonly: true,
                onCreate: Date.now
            },

            // status
            status: {
                type: "string",
                required: false,
                readonly: true,
                default: "pending",
                enum: [
                    "pending",
                    "sent",
                    "failed",
                    "queued",
                    "mailbox"
                ]
            },

            // error
            error: {
                type: "string",
                required: false,
                readonly: true,
            },

            // Routing options

            // sender - An email address that will appear on the Sender: field (always prefer from if you’re not sure which one to use)
            sender: {
                type: "string",
                required: false,
                populate: {
                    action: "v2.emails.addresses.resolve",
                },
            },

            // replyTo - An email address that will appear on the Reply-To: field
            replyTo: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.addresses.resolve",
                },
            },

            // inReplyTo - The Message-ID this message is replying to
            inReplyTo: {
                type: "string",
                required: false,
            },

            // references - Message-ID list (an array or space separated string)
            references: {
                type: "array",
                required: false,
                default: [],
                items: "string",
            },

            // Header options

            // priority - Sets message importance headers, either ‘high’, ‘normal’ (default) or ‘low’.
            priority: {
                type: "string",
                required: false,
                default: "normal",
                enum: [
                    "high",
                    "normal",
                    "low",
                ]
            },

            // headers - An object or array of additional header fields (e.g. {“X-Key-Name”: “key value”} or [{key: “X-Key-Name”, value: “val1”}, {key: “X-Key-Name”, value: “val2”}]). Read more about custom headers here
            headers: {
                type: "object",
                required: false,
                default: {},
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

    },

}


