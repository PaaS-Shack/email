


module.exports = {
    name: "emails.imap.login",

    /**
     * Mixin settings
     */
    settings: {
        commands: {
            "LOGIN": {
                "arguments": ["username", "password"],
                "response": "OK",
                "handler": "loginHandler"
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
         * LOGIN handler
         * @param {Context} ctx - moleculer context
         * @param {Object} session - imap session
         * @param {Object} command - command object
         * @param {String} command.action - command action
         * @param {Array} command.arguments - command arguments
         * @param {Object} command.options - command options
         * @returns {Promise}
         */
        async loginHandler(ctx, session, command) {
            const { username, password } = command.arguments;

            // check secure connection
            if (!session.secure) {
                // send NO
                return this.sendTaggedNo(ctx, session, command, "LOGIN failed");
            }

            // check not authenticated
            if (session.authenticated) {
                // send BAD
                await this.sendBad(ctx, session, "LOGIN failed");
                // send NO
                return this.sendTaggedNo(ctx, session, command, "LOGIN failed");
            }

            // authenticate account
            const account = await ctx.call("v2.emails.accounts.authenticate", { username, password });

            // check account
            if (!account) {
                // send NO
                return this.sendTaggedNo(ctx, session, command, "LOGIN failed");
            }

            // set session user
            session.user = account;

            // set session authenticated
            session.authenticated = true;

            // send OK
            return this.sendTaggedOk(ctx, session, command, "LOGIN completed")
                .then(() => {
                    // send CAPABILITY
                    return this.sendUntaggedCapability(ctx, session)
                });
        }
    }
};