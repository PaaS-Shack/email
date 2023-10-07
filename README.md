# Overview of Services

These are a set of services for managing email messages. They include functionality for receiving, parsing, signing, and sending email messages. The services are designed to be used together, but they can also be used independently. The services are designed to be used with the [MolecularJS]

## Installation

```bash
git clone https://github.com/paas-shack/email.git
cd email
npm i
npm run dev
```

## Kubernetes Install

YAML files are included to deploy the services to a Kubernetes cluster. The following command will deploy the services to a Kubernetes cluster:

```bash
kubectl apply -f yaml
```


## Requirements

The `emails` service requires the following:

- An S3 bucket for storing email messages.
- A MongoDB database for storing email-related data.
- A DKIM key pair for signing email messages.
- A valid domain name for sending email messages.   
- A valid MX record for the domain name.
- A valid SPF record for the domain name.
- A valid DMARC record for the domain name. TODO: Add DMARC support.

## Configuration


The following configuration settings are required:

### s3

The `s3` configuration setting specifies the S3 bucket for storing email messages. The following configuration settings are required:

- `s3.endPoint`: The S3 endpoint.
- `s3.port`: The S3 port.
- `s3.useSSL`: If to use ssl
- `s3.accessKey`: The S3 access key.
- `s3.secretKey`: The S3 secret key.
- `s3.tempDir`: The tmp folder to use for storing email messages as cache.

### emails.outbound

The `emails.outbound` configuration setting specifies the outbound email service. The following configuration settings are required:

- `emails.outbound.dkim.domainName`: The domain name for the DKIM key pair.
- `emails.outbound.dkim.keySelector`: The key selector for the DKIM key pair.
- `emails.outbound.hostname`: The hostname for the outbound email service.
- `emails.outbound.maxSize`: The maximum size of an email message.
- `emails.outbound.socketTimeout`: The socket timeout for the outbound email service.

### emails.inbound

The `emails.inbound` configuration setting specifies the inbound email service. The following configuration settings are required:

- `emails.inbound.logging`: If to log inbound email messages.
- `emails.inbound.hostname`: The hostname for the inbound email service.
- `emails.inbound.disableVersionString`: If to disable the version string.
- `emails.inbound.maxSize`: The maximum size of an email message.
- `emails.inbound.authentication`: If to require authentication.
- `emails.inbound.starttls`: If to require starttls.
- `emails.inbound.secure`: If to require secure.
- `emails.inbound.secured`: If to require secured.
- `emails.inbound.socketTimeout`: The socket timeout for the inbound email service.
- `emails.inbound.maxRecipients`: The maximum number of recipients for an email message.
- `emails.inbound.bucket`: The S3 bucket for storing email messages.

# Services

The following services are included:

- `emails.outbound`: Handles outbound email communication.
- `emails.inbound`: Handles inbound email communication.
- `emails.messages`: Manages email messages.
- `emails.templates`: Manages email templates. TODO: Add support for email templates.
- `emails.accounts`: Manages email users.

## `emails.outbound` Service

The `emails.outbound` service is designed for handling outbound email communication. It is responsible for sending emails, managing email pools, and integrating with a database for persistence.

- [Documentation](docs/outbound.md)

## `emails.inbound` Service

The `emails.inbound` service is an inbound SMTP server designed to handle incoming email messages. It provides functionality for receiving, processing, and storing incoming emails.

- [Documentation](docs/inbound.md)

## `emails.messages` Service

The `emails.messages` service is designed for managing email messages, including storing, parsing, signing, queuing, and adding additional information to email messages.

- [Documentation](docs/messages.md)