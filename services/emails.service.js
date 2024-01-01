const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");

const { MoleculerClientError, MoleculerServerError } = require("moleculer").Errors;


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
                required: true,
                populate: {
                    action: "v2.emails.envelopes.get",
                }
            },

            // from address
            from: {
                type: "array",
                required: false,
                default: [],
                populate: {
                    action: "v2.emails.addresses.resolve",
                }
            },

            // to address
            to: {
                type: "array",
                required: false,
                default: [],
                populate: {
                    action: "v2.emails.addresses.resolve",
                }
            },

            // cc address
            cc: {
                type: "array",
                required: false,
                default: [],
                populate: {
                    action: "v2.emails.addresses.resolve",
                }
            },

            // bcc address
            bcc: {
                type: "array",
                required: false,
                default: [],
                populate: {
                    action: "v2.emails.addresses.get",
                }
            },

            // replyTo address
            replyTo: {
                type: "array",
                required: false,
                default: [],
                populate: {
                    action: "v2.emails.addresses.get",
                }
            },

            // headers
            headers: {
                type: "object",
                required: false,
                hidden: true,
                default: {}
            },

            // subject
            subject: {
                type: "string",
                required: false,
            },

            // body
            body: {
                type: "string",
                required: false,
                hidden: true,// hide from api
            },

            // date
            date: {
                type: "date",
                required: false,
            },

            // message id
            messageId: {
                type: "string",
                required: false,
            },

            // hash
            hash: {
                type: "string",
                required: false,
            },

            // priority
            priority: {
                type: "string",
                required: false,
                default: ""
            },

            // xPriority
            xPriority: {
                type: "string",
                required: false,
            },

            // userAgent
            userAgent: {
                type: "string",
                required: false,
            },

            // mimeVersion
            mimeVersion: {
                type: "string",
                required: false,
            },

            // contentType
            contentType: {
                type: "string",
                required: false,
            },

            // contentTransferEncoding
            contentTransferEncoding: {
                type: "string",
                required: false,
            },

            // attachments
            attachments: {
                type: "array",
                required: false,
                default: [],
                items: "string",
                populate: {
                    action: "v2.emails.attachments.resolve",
                }
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


