


module.exports = {
    name: "emails.imap.capabilities",

    /**
     * Mixin settings
     */
    settings: {
        commands: {
            "CAPABILITY": {
                "arguments": [],
                "response": "CAPABILITY",
                "handler": "capabilityHandler"
            }
        },
        capabilities: [
            "IMAP4rev1",
        ]
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
         * CAPABILITY handler
         * @param {Context} ctx - moleculer context
         * @param {Object} session - imap session
         * @param {Object} command - command object
         * @param {String} command.action - command action
         * @param {Array} command.arguments - command arguments
         * @param {Object} command.options - command options
         * @returns {Promise}
         */
        async capabilityHandler(ctx, session, command) {
            const capabilities = [...this.settings.capabilities];
            if (session.authenticated) {
                capabilities.push("AUTH=PLAIN");
                capabilities.push("AUTH=LOGIN");
            } else {
                capabilities.push("LOGINDISABLED");
            }
            // send server line
            await this.serverLine(ctx, session, `CAPABILITY ${capabilities.join(" ")}`);
            // send OK
            return this.sendTaggedOk(ctx, session, command, "CAPABILITY completed");
        },

        /**
         * send untagged CAPABILITY response
         * @param {Context} ctx - moleculer context
         * @param {Object} session - imap session
         * @returns {Promise}
         */
        async sendUntaggedCapability(ctx, session) {
            const capabilities = [...this.settings.capabilities];
            if (session.authenticated) {
                capabilities.push("AUTH=PLAIN");
                capabilities.push("AUTH=LOGIN");
            } else {
                capabilities.push("LOGINDISABLED");
            }
            // send untagged response
            return this.sendUntagged(ctx, session, "CAPABILITY", capabilities.join(" "));
        },
    }
};