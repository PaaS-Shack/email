


module.exports = {
    name: "emails.imap.starttls",

    /**
     * Mixin settings
     */
    settings: {
        commands: {
            "STARTTLS": {
                "arguments": [],
                "response": "OK",
                "handler": "starttlsHandler"
            }
        }
    },


    /**
     * Actions
     */
    actions: {

    },

    /**
     * Methods
     */
    methods: {
        /**
         * STARTTLS handler
         * @param {Context} ctx - moleculer context
         * @param {Object} session - imap session
         * @param {Object} command - command object
         * @param {String} command.action - command action
         * @param {Array} command.arguments - command arguments
         * @param {Object} command.options - command options
         * @returns {Promise}
         */
        async starttlsHandler(ctx, session, command) {
            // check secure connection
            if (session.secure) {
                // send BAD
                await this.sendBad(ctx, session, "STARTTLS failed");
                // send NO
                return this.sendTaggedNo(ctx, session, command, "STARTTLS failed");
            }

            // send OK
            await this.sendTaggedOk(ctx, session, command, "Begin TLS negotiation now");
            // upgrade connection
            const tlsSocket = await this.secureConnection(ctx, session);
            // send server line
            await this.serverLine(ctx, session, "STARTTLS completed");
            // return upgraded connection
            return tlsSocket;
        },

        /**
         * secure connection
         * @param {Context} ctx - moleculer context
         * @param {Object} session - imap session
         * @returns {Promise}
         */
        async secureConnection(ctx, session) {
            // resolve key/cert
            const [key, ca, cert] = await this.resolveKeyCert(this.config["emails.imap.hostname"]);
            // upgrade connection
            const tlsSocket = new tls.TLSSocket(session.socket, {
                secureContext: tls.createSecureContext({
                    key,
                    ca,
                    cert
                }),
                isServer: true,
                requestCert: true,
                rejectUnauthorized: false
            });
            // set secure
            session.secure = true;
            // set socket
            session.socket = tlsSocket;
            // set socket encoding
            session.socket.setEncoding("utf8");
            // set socket timeout
            session.socket.setTimeout(this.config["emails.imap.socketTimeout"]);
            // reattach socket listeners
            await this.attachSocketListeners(session);
            // return secure connection
            return tlsSocket;
        }
    }
};