


module.exports = {
    name: "emails.imap.logout",

    /**
     * Mixin settings
     */
    settings: {
        commands: {
            "LOGOUT": {
                "arguments": [],
                "response": "BYE",
                "handler": "logoutHandler"
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
         * LOGOUT handler
         * @param {Context} ctx - moleculer context
         * @param {Object} session - imap session
         * @param {Object} command - command object
         * @param {String} command.action - command action
         * @param {Array} command.arguments - command arguments
         * @param {Object} command.options - command options
         * @returns {Promise}
         */
        async logoutHandler(ctx, session, command) {
            // check authenticated
            if (!session.authenticated) {
                // send BAD
                await this.sendBad(ctx, session, "LOGOUT failed");
                // send NO
                await this.sendTaggedNo(ctx, session, command, "LOGOUT failed");
                // close connection
                return this.closeConnection(ctx, session);
            }
            // send BYE
            await this.sendUntagged(ctx, session, "BYE", "IMAP4rev1 Server logging out");
            // send OK
            await this.sendTaggedOk(ctx, session, command, "LOGOUT completed");
            // close connection
            return this.closeConnection(ctx, session);
        }
    }
};