const DbService = require("db-mixin");
const Membership = require("membership-mixin");
const ConfigLoader = require("config-mixin");
const { MoleculerClientError } = require("moleculer").Errors;

const IMAPServerModule = require('wildduck/imap-core');
const IMAPServer = IMAPServerModule.IMAPServer;
const imapHandler = IMAPServerModule.imapHandler;
const MemoryNotifier = require('../lib/memory-notifier');
const fs = require('fs');
const parseMimeTree = require('wildduck/imap-core/lib/indexer/parse-mime-tree');
const { log } = require("console");

/**
 * this is the email imap server service
 * for th most part will be a copy of wildduck/imap-core/test/test-server.js
 */

module.exports = {
    // name of service
    name: "emails.imap",
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
            permissions: 'emails.imap'
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
            'emails.imap.port': 1143,
            'emails.imap.host': '0.0.0.0',
            'emails.imap.secure': false,
            'emails.imap.needsUpgrade': false,
            'emails.imap.secured': false,
            'emails.imap.skipFetchLog': false,
            'emails.imap.closeTimeout': 5000,
            'emails.imap.useProxy': false,
            'emails.imap.ignoredHosts': [],
        }
    },

    /**
     * service actions
     */
    actions: {

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
         * create imap server
         * 
         * @param {Object} options - options for imap server 
         * @param {Number} options.port - port to listen on
         * @param {String} options.host - host to listen on
         * @param {Boolean} options.secure - use tls
         * @param {Boolean} options.needsUpgrade - needs upgrade to tls
         * @param {Boolean} options.secured - secured connection
         * @param {Boolean} options.skipFetchLog - skip fetch log
         * @param {Number} options.closeTimeout - close timeout
         * @param {Boolean} options.useProxy - use proxy 
         * @param {Array} options.ignoredHosts - ignored hosts
         * @param {Function} options.SNICallback - sni callback
         * @param {Object} options.sniOptions - sni options
         * 
         * 
         * @return {Promise} - promise that resolves when server is created
         */
        async createImapServer(options) {
            // create imap server
            const server = new IMAPServer(options);
            this.server = server;

            const service = this;

            const folders = this.folders;
            const subscriptions = this.subscriptions;

            server.notifier = new MemoryNotifier({
                logger: {
                    info: () => false,
                    debug: () => false,
                    error: () => false
                },
                folders: folders
            });

            // watch for errors
            server.on('error', err => {
                this.logger.error(err);
            });

            server.onAuth = (login, session, callback) => {
                this.logger.info('onAuth', login.username, login.password, login.method);
                this.authenticate(this.broker, login.username, login.password, login.method)
                    .then(user => {
                        this.logger.info(`user ${user.id} authenticated`)
                        session.user = user;
                        callback(null, {
                            id: user.id,
                            user: user
                        });
                    })
                    .catch(err => {
                        this.logger.error(err);
                        callback(err);
                    });
            };

            // LIST "" "*"
            // Returns all folders, query is informational
            // folders is either an Array or a Map
            server.onList = function (query, session, callback) {
                console.log('[%s] LIST for "%s"', session.id, query);
                service.listMailboxs(service.broker, session.user, query)
                    .then(entities => {
                        console.log(`found ${entities.length} mailboxes`)
                        callback(null, entities);
                    })
                    .catch(err => {
                        this.logger.error(`error listing mailboxes`, err);
                        return callback(null, 'NONEXISTENT');
                    });
            };


            // CREATE "path/to/mailbox"
            server.onCreate = function (mailbox, session, callback) {
                service.createMailbox(service.broker, session.user, mailbox)
                    .then(() => {
                        callback(null, true);
                    })
                    .catch(err => {
                        this.logger.error(`error creating mailbox`, err);
                        callback(null, 'ALREADYEXISTS');
                    });
            };

            // SELECT/EXAMINE
            server.onOpen = function (mailbox, session, callback) {
                service.openMailbox(service.broker, session.user, mailbox)
                    .then(folder => {
                        callback(null, folder);
                    })
                    .catch(err => {
                        this.logger.error(`error opening mailbox`, err);
                        callback(null, 'NONEXISTENT');
                    });
            };

            // LSUB "" "*"
            // Returns all subscribed folders, query is informational
            // folders is either an Array or a Map
            server.onLsub = function (query, session, callback) {
                console.log('[%s] LSUB for "%s"', session.id, query);

                let subscribed = [];
                folders.forEach(folder => {
                    if (subscriptions.has(folder)) {
                        subscribed.push(folder);
                    }
                });

                callback(null, subscribed);
            };

            // SUBSCRIBE "path/to/mailbox"
            server.onSubscribe = function (mailbox, session, callback) {
                console.log('[%s] SUBSCRIBE to "%s"', session.id, mailbox);

                if (!folders.has(mailbox)) {
                    return callback(null, 'NONEXISTENT');
                }

                subscriptions.add(folders.get(mailbox));
                callback(null, true);
            };

            // UNSUBSCRIBE "path/to/mailbox"
            server.onUnsubscribe = function (mailbox, session, callback) {
                console.log('[%s] UNSUBSCRIBE from "%s"', session.id, mailbox);

                if (!folders.has(mailbox)) {
                    return callback(null, 'NONEXISTENT');
                }

                subscriptions.delete(folders.get(mailbox));
                callback(null, true);
            };
            // RENAME "path/to/mailbox" "new/path"
            // NB! RENAME affects child and hierarchy mailboxes as well, this example does not do this
            server.onRename = function (mailbox, newname, session, callback) {
                console.log('[%s] RENAME "%s" to "%s"', session.id, mailbox, newname);

                if (!folders.has(mailbox)) {
                    return callback(null, 'NONEXISTENT');
                }

                if (folders.has(newname)) {
                    return callback(null, 'ALREADYEXISTS');
                }

                let oldMailbox = folders.get(mailbox);
                folders.delete(mailbox);

                oldMailbox.path = newname;
                folders.set(newname, oldMailbox);

                callback(null, true);
            };

            // DELETE "path/to/mailbox"
            server.onDelete = function (mailbox, session, callback) {
                console.log('[%s] DELETE "%s"', session.id, mailbox);

                if (!folders.has(mailbox)) {
                    return callback(null, 'NONEXISTENT');
                }

                // keep SPECIAL-USE folders
                if (folders.get(mailbox).specialUse) {
                    return callback(null, 'CANNOT');
                }

                folders.delete(mailbox);
                callback(null, true);
            };

            // STATUS (X Y X)
            server.onStatus = function (mailbox, session, callback) {
                console.log('[%s] Requested status for "%s"', session.id, mailbox);

                if (!folders.has(mailbox)) {
                    return callback(null, 'NONEXISTENT');
                }

                let folder = folders.get(mailbox);

                return callback(null, {
                    messages: folder.messages.length,
                    uidNext: folder.uidNext,
                    uidValidity: folder.uidValidity,
                    highestModseq: folder.modifyIndex,
                    unseen: folder.messages.filter(message => !message.flags.includes('\\Seen')).length
                });
            };

            // APPEND mailbox (flags) date message
            server.onAppend = function (mailbox, flags, date, raw, session, callback) {
                console.log('[%s] Appending message to "%s"', session.id, mailbox);

                if (!folders.has(mailbox)) {
                    return callback(null, 'TRYCREATE');
                }

                date = (date && new Date(date)) || new Date();

                let folder = folders.get(mailbox);
                let message = {
                    uid: folder.uidNext++,
                    modseq: ++folder.modifyIndex,
                    date: (date && new Date(date)) || new Date(),
                    mimeTree: parseMimeTree(raw),
                    flags
                };

                folder.messages.push(message);

                // do not write directly to stream, use notifications as the currently selected mailbox might not be the one that receives the message
                this.notifier.addEntries(
                    session.user.id,
                    mailbox,
                    {
                        command: 'EXISTS',
                        uid: message.uid
                    },
                    () => {
                        this.notifier.fire(session.user.id, mailbox);

                        return callback(null, true, {
                            uidValidity: folder.uidValidity,
                            uid: message.uid
                        });
                    }
                );
            };

            // STORE / UID STORE, updates flags for selected UIDs
            server.onStore = function (mailbox, update, session, callback) {
                console.log('[%s] Updating messages in "%s"', session.id, mailbox);

                if (!folders.has(mailbox)) {
                    return callback(null, 'NONEXISTENT');
                }

                let condstoreEnabled = !!session.selected.condstoreEnabled;

                let modified = [];
                let folder = folders.get(mailbox);
                let i = 0;

                let processMessages = () => {
                    if (i >= folder.messages.length) {
                        this.notifier.fire(session.user.id, mailbox);
                        return callback(null, true, modified);
                    }

                    let message = folder.messages[i++];
                    let updated = false;

                    if (update.messages.indexOf(message.uid) < 0) {
                        return processMessages();
                    }

                    if (update.unchangedSince && message.modseq > update.unchangedSince) {
                        modified.push(message.uid);
                        return processMessages();
                    }

                    switch (update.action) {
                        case 'set':
                            // check if update set matches current or is different
                            if (message.flags.length !== update.value.length || update.value.filter(flag => message.flags.indexOf(flag) < 0).length) {
                                updated = true;
                            }
                            // set flags
                            message.flags = [].concat(update.value);
                            break;

                        case 'add':
                            message.flags = message.flags.concat(
                                update.value.filter(flag => {
                                    if (message.flags.indexOf(flag) < 0) {
                                        updated = true;
                                        return true;
                                    }
                                    return false;
                                })
                            );
                            break;

                        case 'remove':
                            message.flags = message.flags.filter(flag => {
                                if (update.value.indexOf(flag) < 0) {
                                    return true;
                                }
                                updated = true;
                                return false;
                            });
                            break;
                    }

                    // notifiy only if something changed
                    if (updated) {
                        message.modseq = ++folder.modifyIndex;

                        // Only show response if not silent or modseq is required
                        if (!update.silent || condstoreEnabled) {
                            session.writeStream.write(
                                session.formatResponse('FETCH', message.uid, {
                                    uid: update.isUid ? message.uid : false,
                                    flags: update.silent ? false : message.flags,
                                    modseq: condstoreEnabled ? message.modseq : false
                                })
                            );
                        }

                        this.notifier.addEntries(
                            session.user.id,
                            mailbox,
                            {
                                command: 'FETCH',
                                ignore: session.id,
                                uid: message.uid,
                                flags: message.flags
                            },
                            processMessages
                        );
                    } else {
                        processMessages();
                    }
                };

                processMessages();
            };

            // EXPUNGE deletes all messages in selected mailbox marked with \Delete
            server.onExpunge = function (mailbox, update, session, callback) {
                console.log('[%s] Deleting messages from "%s"', session.id, mailbox);

                if (!folders.has(mailbox)) {
                    return callback(null, 'NONEXISTENT');
                }

                let folder = folders.get(mailbox);
                let deleted = [];
                let i, len;

                for (i = folder.messages.length - 1; i >= 0; i--) {
                    if (
                        ((update.isUid && update.messages.indexOf(folder.messages[i].uid) >= 0) || !update.isUid) &&
                        folder.messages[i].flags.indexOf('\\Deleted') >= 0
                    ) {
                        deleted.unshift(folder.messages[i].uid);
                        folder.messages.splice(i, 1);
                    }
                }

                let entries = [];
                for (i = 0, len = deleted.length; i < len; i++) {
                    entries.push({
                        command: 'EXPUNGE',
                        ignore: session.id,
                        uid: deleted[i]
                    });
                    if (!update.silent) {
                        session.writeStream.write(session.formatResponse('EXPUNGE', deleted[i]));
                    }
                }

                this.notifier.addEntries(session.user.id, mailbox, entries, () => {
                    this.notifier.fire(session.user.id, mailbox);
                    return callback(null, true);
                });
            };

            // COPY / UID COPY sequence mailbox
            server.onCopy = function (connection, mailbox, update, session, callback) {
                console.log('[%s] Copying messages from "%s" to "%s"', session.id, mailbox, update.destination);

                if (!folders.has(mailbox)) {
                    return callback(null, 'NONEXISTENT');
                }

                if (!folders.has(update.destination)) {
                    return callback(null, 'TRYCREATE');
                }

                let sourceFolder = folders.get(mailbox);
                let destinationFolder = folders.get(update.destination);

                let messages = [];
                let sourceUid = [];
                let destinationUid = [];
                let i, len;
                let entries = [];

                for (i = sourceFolder.messages.length - 1; i >= 0; i--) {
                    if (update.messages.indexOf(sourceFolder.messages[i].uid) >= 0) {
                        messages.unshift(JSON.parse(JSON.stringify(sourceFolder.messages[i])));
                        sourceUid.unshift(sourceFolder.messages[i].uid);
                    }
                }

                for (i = 0, len = messages.length; i < len; i++) {
                    messages[i].uid = destinationFolder.uidNext++;
                    destinationUid.push(messages[i].uid);
                    destinationFolder.messages.push(messages[i]);

                    // do not write directly to stream, use notifications as the currently selected mailbox might not be the one that receives the message
                    entries.push({
                        command: 'EXISTS',
                        uid: messages[i].uid
                    });
                }

                this.notifier.addEntries(update.destination, session.user.id, entries, () => {
                    this.notifier.fire(session.user.id, update.destination);

                    return callback(null, true, {
                        uidValidity: destinationFolder.uidValidity,
                        sourceUid,
                        destinationUid
                    });
                });
            };

            // sends results to socket
            server.onFetch = function (mailbox, options, session, callback) {
                service.fetchMailbox(service.broker, session.user, mailbox, options)
                    .then(() => {
                        callback(null, true);
                    }).catch(err => {
                        callback(err);
                    });
            };

            // returns an array of matching UID values and the highest modseq of matching messages
            server.onSearch = function (mailbox, options, session, callback) {
                if (!folders.has(mailbox)) {
                    return callback(null, 'NONEXISTENT');
                }

                let folder = folders.get(mailbox);
                let highestModseq = 0;

                let uidList = [];
                let checked = 0;
                let checkNext = () => {
                    if (checked >= folder.messages.length) {
                        return callback(null, {
                            uidList,
                            highestModseq
                        });
                    }
                    let message = folder.messages[checked++];
                    session.matchSearchQuery(message, options.query, (err, match) => {
                        if (err) {
                            // ignore
                        }
                        if (match && highestModseq < message.modseq) {
                            highestModseq = message.modseq;
                        }
                        if (match) {
                            uidList.push(message.uid);
                        }
                        checkNext();
                    });
                };
                checkNext();
            };

            return new Promise((resolve, reject) => {
                server.listen(options.port, options.host, () => {
                    this.logger.info(`listening on ${options.host}:${options.port}`);
                    resolve(server);
                });
            });

        },

        /**
         * close imap server
         * 
         * @return {Promise} - promise that resolves when server is closed
         */
        async closeImapServer() {

            if (!this.server) {
                return Promise.resolve();
            }

            return new Promise((resolve, reject) => {
                this.server.close(() => {
                    this.logger.info(`server closed`);
                    resolve();
                });
            });
        },

        /**
         * authenticate user
         * 
         * @param {Object} ctx - context of request
         * @param {String} username - username to authenticate
         * @param {String} password - password to authenticate
         * @param {String} method - method to authenticate with
         * 
         * @return {Promise} - promise that resolves when user is authenticated
         */
        async authenticate(ctx, username, password, method) {

            // get user
            const user = await ctx.call('v1.emails.accounts.auth', {
                username,
                password,
                method,
            });

            // if no user throw error
            if (!user) {
                throw new MoleculerClientError('Authentication failed', 401, 'AUTHENTICATION_FAILED');
            }

            return user;
        },

        /**
         * open mailbox
         * 
         * @param {Object} ctx - context of request
         * @param {Object} user - user to open mailbox for
         * @param {String} mailbox - mailbox to open
         * 
         * @return {Promise} - promise that resolves when mailbox is opened
         */
        async openMailbox(ctx, user, mailbox) {
            console.log(`opening mailbox ${mailbox}`)
            // get mailbox
            const folder = await ctx.call('v1.emails.mailboxs.lookup', {
                mailbox: mailbox,
                user: user.id,
                populate: true
            });

            // if no mailbox throw error
            if (!folder) {
                throw new MoleculerClientError('Mailbox not found', 404, 'MAILBOX_NOT_FOUND');
            }

            this.folders.set(mailbox, folder);

            return {
                specialUse: folder.specialUse,
                uidValidity: folder.uidValidity,
                uidNext: folder.uidNext,
                modifyIndex: folder.modifyIndex,
                uidList: folder.messages.map(message => message.uid)
            };
        },

        /**
         * list mailboxs
         * 
         * @param {Object} ctx - context of request
         * @param {Object} user - user to list mailboxs for
         * @param {String} query - query to list mailboxs with
         * 
         * @return {Promise} - promise that resolves when mailboxs are listed
         */
        async listMailboxs(ctx, user, query) {

            // get mailboxs
            const entities = await ctx.call('v1.emails.mailboxs.list', {
                user: user.id,
                query
            });

            // set folder
            entities.forEach(entity => {
                this.folders.set(entity.path, entity);
            });

            return entities;
        },
        /**
         * fetch mailbox
         * 
         * @param {Object} ctx - context of request
         * @param {Object} user - user to fetch mailbox for
         * @param {String} mailbox - mailbox to fetch
         * @param {Object} options - options for fetch
         * 
         * @return {Promise} - promise that resolves when mailbox is fetched
         */
        async fetchMailbox(ctx, user, mailbox, options) {
            console.log('[%s] Requested FETCH for "%s"', session.id, mailbox);
            console.log('[%s] FETCH: %s', session.id, JSON.stringify(options.query));

            const folder = await ctx.call('v1.emails.mailboxs.lookup', {
                mailbox: mailbox,
                user: user.id
            });

            if (!folder) {
                throw new MoleculerClientError('Mailbox not found', 404, 'MAILBOX_NOT_FOUND');
            }


            this.folders.set(mailbox, folder);

            let entries = [];

            if (options.markAsSeen) {
                // mark all matching messages as seen
                for (let i = 0; i < folder.messages.length; i++) {
                    const message = folder.messages[i];
                    if (options.messages.indexOf(message.uid) < 0) {
                        continue;
                    }
                    await ctx.call('v1.emails.mailboxs.messages.flag', {
                        uid: message.uid,
                        user: user.id,
                        mailbox: mailbox,
                        flags: ['\\Seen']
                    });

                    // if BODY[] is touched, then add \Seen flag and notify other clients
                    if (!message.flags.includes('\\Seen')) {
                        message.flags.unshift('\\Seen');
                        entries.push({
                            command: 'FETCH',
                            ignore: session.id,
                            uid: message.uid,
                            flags: message.flags
                        });
                    }
                }
            }

            this.server.notifier.addEntries(session.user.id, mailbox, entries, () => {
                let pos = 0;
                let processMessage = () => {
                    if (pos >= folder.messages.length) {
                        // once messages are processed show relevant updates
                        this.server.notifier.fire(session.user.id, mailbox);
                        return callback(null, true);
                    }
                    let message = folder.messages[pos++];

                    if (options.messages.indexOf(message.uid) < 0) {
                        return setImmediate(processMessage);
                    }

                    if (options.changedSince && message.modseq <= options.changedSince) {
                        return setImmediate(processMessage);
                    }

                    let stream = imapHandler.compileStream(
                        session.formatResponse('FETCH', message.uid, {
                            query: options.query,
                            values: session.getQueryResponse(options.query, message)
                        })
                    );

                    // send formatted response to socket
                    session.writeStream.write(stream, () => {
                        setImmediate(processMessage);
                    });
                };

                setImmediate(processMessage);
            });
        },
        /**
         * create mailbox
         * 
         * @param {Object} ctx - context of request
         * @param {Object} user - user to create mailbox for
         * @param {String} mailbox - mailbox to create
         * 
         * @returns {Promise} 
         */
        async createMailbox(ctx, user, mailbox) {
            console.log('[%s] CREATE "%s"', session.id, mailbox);

            // get mailbox
            const entity = await ctx.call('v1.emails.mailboxs.create', {
                mailbox: mailbox,
                user: user.id,
                path: `${mailbox}`
            });

            return true;
        },

        /**
         * rename mailbox
         * 
         * @param {Object} ctx - context of request
         * @param {Object} user - user to rename mailbox for
         * @param {String} mailbox - mailbox to rename
         * @param {String} newname - new name of mailbox
         * 
         * @returns {Promise} 
         */
        async renameMailbox(ctx, user, mailbox, newname) {

            // get mailbox
            const entity = await ctx.call('v1.emails.mailboxs.rename', {
                name: mailbox,
                user: user.id,
                newname
            });

            return entity;
        },

        /**
         * delete mailbox
         * 
         * @param {Object} ctx - context of request
         * @param {Object} user - user to delete mailbox for
         * @param {String} mailbox - mailbox to delete
         * 
         * @returns {Promise}
         */
        async deleteMailbox(ctx, user, mailbox) {

            // lookup mailbox
            const entity = await ctx.call('v1.emails.mailboxs.lookup', {
                name: mailbox,
                user: user.id
            });

            // if no mailbox throw error
            if (!entity) {
                throw new MoleculerClientError('Mailbox not found', 404, 'MAILBOX_NOT_FOUND');
            }

            // delete mailbox
            await ctx.call('v1.emails.mailboxs.remove', {
                id: entity.id
            });

            return entity;
        },

        /**
         * status mailbox
         * 
         * @param {Object} ctx - context of request
         * @param {Object} user - user to status mailbox for
         * @param {String} mailbox - mailbox to status
         * 
         * @returns {Promise}
         */
        async statusMailbox(ctx, user, mailbox) {

            // get mailbox
            const entity = await ctx.call('v1.emails.mailboxs.lookup', {
                name: mailbox,
                user: user.id
            });

            // if no mailbox throw error
            if (!entity) {
                throw new MoleculerClientError('Mailbox not found', 404, 'MAILBOX_NOT_FOUND');
            }

            return entity;
        },

        /**
         * append message
         * 
         * @param {Object} ctx - context of request
         * @param {Object} user - user to append message for
         * @param {String} mailbox - mailbox to append message to
         * @param {String} message - message to append
         * @param {Array} flags - flags to append
         * @param {Date} date - date to append
         * 
         * @returns {Promise}
         */
        async appendMessage(ctx, user, mailbox, message, flags, date) {

            // get mailbox
            const entity = await ctx.call('v1.emails.mailboxs.append', {
                name: mailbox,
                user: user.id,
                message,
                flags,
                data
            });

            return entity;
        },

    },

    created() {
        this.server = null;
        this.folders = new Map();
        this.subscriptions = new WeakSet();

    },

    async started() {
        const options = {
            port: this.settings.config['emails.imap.port'],
            host: this.settings.config['emails.imap.host'],
            secure: this.settings.config['emails.imap.secure'],
            needsUpgrade: this.settings.config['emails.imap.needsUpgrade'],
            secured: this.settings.config['emails.imap.secured'],
            skipFetchLog: this.settings.config['emails.imap.skipFetchLog'],
            closeTimeout: this.settings.config['emails.imap.closeTimeout'],
            useProxy: this.settings.config['emails.imap.useProxy'],
            ignoredHosts: this.settings.config['emails.imap.ignoredHosts'],
            SNICallback: this.settings.config['emails.imap.SNICallback'],
            sniOptions: this.settings.config['emails.imap.sniOptions'],
            //logger: this.logger,
        };
        return this.createImapServer(options);
    },

    async stopped() {
        return this.closeImapServer()
    }

}


