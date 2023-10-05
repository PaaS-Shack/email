const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");
const { MoleculerClientError } = require("moleculer").Errors;

const fs = require('fs').promises;
const { createWriteStream, createReadStream } = require('fs');

const simpleParser = require('mailparser').simpleParser;
const MailParser = require('mailparser').MailParser;

const S3Mixin = require("../mixins/s3-store.mixin");


const PassThrough = require('stream').PassThrough;
const LineEnds = require('../lib/line-ends');
const DkimRelaxedBody = require('../lib/dkim-relaxed-body');
const StreamHash = require('../lib/stream-hash');
const MessageParser = require('../lib/message-parser');
const mailsplit = require('mailsplit');

const crypto = require('crypto');
const dns = require('dns');
const pem = require('pem');
const child_process = require('child_process');
const { ConsumerOptsBuilderImpl } = require("nats/lib/jetstream/types");

const sshKeyToPem = require('ssh-key-to-pem');


/**
 * email parser service
 */

module.exports = {
    // name of service
    name: "emails.parser",
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
            permissions: 'emails.parser'
        }),
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

        fields: {


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
        /**
         * parse email message
         * 
         * @actions
         * @param {String} id - envelope id
         * 
         * @returns {Object} - parsed message
         */
        parse: {
            params: {
                id: { type: "string" },
            },
            async handler(ctx) {
                const id = ctx.params.id;

                // check if id is valid
                if (!id) {
                    throw new MoleculerClientError("Invalid envelope id", 400, "INVALID_ENVELOPE_ID");
                }

                // get message stream
                const stream = await this.getMessageStream({
                    id,
                });

                return simpleParser(stream)
            }
        },
        /**
         * verify DKIM signature
         * 
         * @actions
         * @param {String} id - envelope id
         * 
         * @returns {Promise} - resolves to s3 object
         */
        verifyDKIM: {
            params: {
                id: { type: "string" },
            },
            async handler(ctx) {
                const id = ctx.params.id;

                // check if id is valid
                if (!id) {
                    throw new MoleculerClientError("Invalid envelope id", 400, "INVALID_ENVELOPE_ID");
                }

                // get message stream
                const stream = await this.getMessageStream({
                    id,
                });


                return this.verifyDKIM({
                    id,
                }, stream)
            }
        },
    },

    /**
     * service events
     */
    events: {
        async "emails.inbound.received"(ctx) {
            const envelope = ctx.params.envelope;

            // check if envelope is valid
            if (!envelope) {
                throw new MoleculerClientError("Invalid envelope", 400, "INVALID_ENVELOPE");
            }

            console.log(envelope)
        },
    },

    /**
     * service methods
     */
    methods: {
        /**
         * verify DKIM signature
         * 
         * @param {Object} envelope - message envelope
         * @param {Stream} stream - raw email message stream
         * 
         * @returns {Promise} - resolves to s3 object
         */
        async verifyDKIM(envelope, stream) {
            // get message stream
            const tmpFile = await this.writeStreamToTmpFile(stream);

            // hash message body and headers
            const hashs = await this.hashMessageStream(createReadStream(tmpFile), tmpFile)

            // remove tmp file
            await fs.unlink(tmpFile);

            return hashs;
        },

        /**
         * hash message stream
         * 
         * @param {Stream} stream - raw email message stream
         * 
         * @returns {Promise} - body hash
         */
        async hashMessageStream(stream,tmpFile) {

            const {
                bodyHash,
                headers,
            } = await this.parseStream(stream);


            // parse dkim signature
            const signatureObject = await this.parseSignature(headers.get('dkim-signature')[0]);

            const dkimDomain = signatureObject.d;
            const dkimSelector = signatureObject.s;

            // get dkim public key
            const dkimPublicKeyObject = await this.getDKIMPublicKey(dkimDomain, dkimSelector);

            const publicKey = `-----BEGIN PUBLIC KEY-----\n${dkimPublicKeyObject.p}\n-----END PUBLIC KEY-----\n`

            const v = await this.verifyRawEmailWithDKIM(tmpFile, publicKey)

            return {
                bodyHash,
                dkimPublicKeyObject,
                signatureObject,
                verify: v,
            }

        },

        /**
         * Verify a raw email message using DKIM validation
         *
         * @param {string} filePath - Path to the raw email message file
         * @param {string} dkimPublicKey - DKIM public key for the sending domain
         * @returns {Promise<boolean>} - True if the email is verified, false otherwise
         */
        async verifyRawEmailWithDKIM(filePath, dkimPublicKey) {
            try {
                // Read the raw email message from the file
                const rawEmail = await fs.readFile(filePath, 'utf8');

                // Parse the raw email into an object
                const parsedEmail = await simpleParser(rawEmail);

                // Extract the DKIM signature header from the parsed email
                const dkimSignature = parsedEmail.headers.get('dkim-signature');

                if (!dkimSignature) {
                    console.error('DKIM signature not found in the email headers.');
                    return false;
                }
                console.log(dkimSignature)

                // Extract the DKIM signature value (excluding the "DKIM-Signature:" prefix)
                const dkimSignatureValue = dkimSignature.replace(/^DKIM-Signature:/i, '').trim();


                // Verify the DKIM signature
                const verifier = crypto.createVerify('RSA-SHA256');
                verifier.update(parsedEmail.header);
                verifier.update(parsedEmail.text);

                const isSignatureValid = verifier.verify(dkimPublicKey, Buffer.from(dkimSignatureValue, 'base64'));

                if (isSignatureValid) {
                    console.log('DKIM signature is valid.');
                    return true;
                } else {
                    console.error('DKIM signature is not valid.');
                    return false;
                }
            } catch (error) {
                console.error('Error verifying DKIM signature:', error);
                return false;
            }
        },
        /**
         * parse stream
         * 
         * @param {Stream} stream - raw email message stream
         * 
         * @returns {Promise} - parsed message
         */
        async parseStream(stream) {
            //parse message stream for headers
            const message = new MessageParser();

            let raw = new PassThrough();
            let splitter = new mailsplit.Splitter({
                ignoreEmbedded: true
            });
            let streamer = new PassThrough({
                objectMode: true
            });

            let dkimStream = new DkimRelaxedBody({
                hashAlgo: 'sha256',
                debug: true,
            });
            let lineEnds = new LineEnds();

            const promise = new Promise((resolve, reject) => {
                dkimStream.on('hash', bodyHash => {
                    console.log('body hash:', bodyHash);
                    resolve({
                        bodyHash,
                        headers: message.headers,
                    })
                });
            });

            stream.pipe(raw)
            raw.pipe(splitter);
            splitter.pipe(streamer);
            streamer.pipe(message);
            message.pipe(lineEnds).pipe(dkimStream);

            return promise;
        },
        /**
         * parse signature
         * 
         * @param {String} signature - dkim signature
         * 
         * @returns {Promise} - resolves to parsed signature
         */
        async parseSignature(signature) {
            const signatureStringArray = signature.split(';')
            const parsedSignature = {};
            // parse dkim signature

            signatureStringArray.forEach((item) => {

                const key = item.substring(0, item.indexOf('='));
                const value = item.substring(item.indexOf('=') + 1, item.length);

                //remove \r\n and " " from value
                const trimmedValue = value.replace(/[\r\n]+/gm, '').replace(/ /g, '');

                parsedSignature[key.trim()] = trimmedValue
            });

            return parsedSignature;
        },
        /**
         * header hash
         * 
         * @param {Stream} stream - raw email message stream
         * 
         * @returns {Promise} - header hash
         */
        async hashHeaders(headers) {
            // Sort headers alphabetically by key
            const sortedHeaders = Object.keys(headers)
                .filter(key => key.toLowerCase() !== 'dkim-signature') // Exclude DKIM-Signature header
                .sort()
                .map(key => `${key}:${headers[key]}`)
                .join('\r\n');

            // Hash the header string
            const dkimStream = new DkimRelaxedBody({
                hashAlgo: 'sha256',
                debug: true,
            });

            dkimStream.end(sortedHeaders);

            return dkimStream.hash;
        },
        /**
         * get DKIM public key
         * 
         * @param {String} domain - domain name
         * @param {String} selector - selector
         * 
         * @returns {Promise} - resolves public key
         */
        async getDKIMPublicKey(domain, selector) {
            // get dkim public key
            const records = await this.broker.call('v1.resolver.resolve', {
                fqdn: `${selector}._domainkey.${domain}`,
                type: 'TXT',
            });

            // get dkim public key
            const dkimPublicKey = records[0].join('');
            // check if dkim public key exists
            if (!dkimPublicKey) {
                throw new MoleculerClientError("DKIM public key not found", 400, "DKIM_PUBLIC_KEY_NOT_FOUND");
            }
            //v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAntvSKT1hkqhKe0xcaZ0x+QbouDsJuBfby/S82jxsoC/SodmfmVs2D1KAH3mi1AqdMdU12h2VfETeOJkgGYq5ljd996AJ7ud2SyOLQmlhaNHH7Lx+Mdab8/zDN1SdxPARDgcM7AsRECHwQ15R20FaKUABGu4NTbR2fDKnYwiq5jQyBkLWP+LgGOgfUF4T4HZb2PY2bQtEP6QeqOtcW4rrsH24L7XhD+HSZb1hsitrE0VPbhJzxDwI4JF815XMnSVjZgYUXP8CxI1Y0FONlqtQYgsorZ9apoW1KPQe8brSSlRsi9sXB/tu56LmG7tEDNmrZ5XUwQYUUADBOu7t1niwXwIDAQAB
            // return stripped dkim public key
            const keys = dkimPublicKey.split('; ')

            const result = {};
            keys.forEach((item) => {
                const key = item.substring(0, item.indexOf('='));
                const value = item.substring(item.indexOf('=') + 1, item.length);

                //remove \r\n and " " from value
                const trimmedValue = value.replace(/[\r\n]+/gm, '').replace(/ /g, '');

                result[key.trim()] = trimmedValue
            });



            return result
        },

        /**
         * write stream to tmp file
         * 
         * @param {Stream} stream - stream to write
         * 
         * @returns {Promise} - resolves to tmp file path
         */
        async writeStreamToTmpFile(stream) {
            // create tmp file
            const tmpFile = `/tmp/${crypto.randomBytes(16).toString('hex')}.eml`;

            const writeStream = createWriteStream(tmpFile);

            // write stream to tmp file
            stream.pipe(writeStream);

            // wait for stream to finish
            await new Promise((resolve, reject) => {
                stream.on('end', resolve);
                stream.on('error', reject);
            });

            // return tmp file path
            return tmpFile;
        },



    }
};


