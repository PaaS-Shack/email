## `emails.accounts` Service Documentation

### Introduction

The `emails.accounts` service is responsible for managing email accounts. It provides functionalities related to authentication and validation of email account details. This service is a part of the MolecularJS application.

### Service Overview

- **Name:** emails.accounts
- **Version:** 1

### Service Mixins

This service utilizes the following mixins:

- **DbService:** Provides database-related functionality.
- **ConfigLoader:** Loads configuration settings.

### Service Dependencies

This service does not have any dependencies on other services.

### Service Settings

The service settings define the schema for email account information and other configurations. Below are the key settings:

- **Rest:** Enabled for RESTful API.
- **Fields:** Defines the schema for email accounts, including username, password, email address, sender, and SMTP/IMAP details.
- **Default Populates:** Specifies how related entities should be populated.
- **Scopes:** Defines authorization scopes.
- **Default Scopes:** Specifies default authorization scopes.
- **Config:** Default configuration settings (empty in this case).

### Service Actions

#### 1. `auth`

- **Parameters:**
  - `username` (String, required): Account username.
  - `password` (String, required): Account password.
  - `method` (String, enum: 'PLAIN', 'LOGIN', 'XOAUTH2', default: 'basic'): SMTP authentication method.

- **Description:** Authenticates an email account based on the provided username and password.

#### 2. `validateFrom`

- **Parameters:**
  - `from` (String, required): From address.
  - `user` (String, required): Account ID.

- **Description:** Validates whether the provided "from" address corresponds to the specified user's email account.

#### 3. `clean`

- **Description:** Cleans the database by removing all entities related to email accounts.

### Service Events

This service does not have any custom events defined.

### Service Methods

This service does not have any custom methods defined.

### Usage

- The `auth` action can be used to authenticate an email account.
- The `validateFrom` action can be used to validate the "from" address for an email account.
- The `clean` action can be used to clean the database by removing all email account entities.

### Permissions

- `emails.accounts.auth`: Required permission for the `auth` action.
- `emails.accounts.validateFrom`: Required permission for the `validateFrom` action.

### Error Handling

- The service may throw `MoleculerClientError` with appropriate HTTP status codes for various error scenarios such as account not found or invalid password.
