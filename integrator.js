const Upsales = require('./upsales-sdk');
const Mailchimp = require('./mailchimp-sdk');
const logger = require(`./lib/log`);

class Integrator {
    constructor (data) {
        this.mailchimp = new Mailchimp(data.mailchimp.token);
        this.upsales = new Upsales({
            version: 2,
            token: data.upsales.token
        });
        this.logger = {
            mailchimp: new logger({context: `MAILCHIMP`}),
            upsales: new logger({context: `UPSALES`}),
            integrator: new logger({context: `INTEGRATOR`})
        };
    }

    static jsUcfirst (data) {
        let string = data || ``;
        return `${string.charAt(0).toUpperCase()}${string.slice(1)}`
    }

    static parseEmail (email) {
        let domain = Integrator.jsUcfirst(email.replace(/.*@/, "")).split(`.`)[0],
            names = email.replace(/@.*$/, "").split(`.`),
            firstname = Integrator.jsUcfirst(names[0]),
            lastname = Integrator.jsUcfirst(names[1]);

        return {
            domain,
            names,
            firstname,
            lastname
        }
    };

    async prepareData () {
        this.logger.mailchimp.action(`Getting all subscribers`);
        let mailchimp = this.mailchimp,
            subscribers = await mailchimp.getAllSubscribers(),
            companies = [],
            self = this;
        this.logger.mailchimp.success(`Subscribers was received`);
        this.logger.integrator.action(`Preparing data for Upsales`);
        let contacts = subscribers.map((subscriber) => {
            let parsedEmail = Integrator.parseEmail(subscriber.email_address),
                firstName = subscriber.merge_fields.FNAME || parsedEmail.firstname || ``,
                lastName = subscriber.merge_fields.LNAME || parsedEmail.lastname || ``,
                name = `${firstName} ${lastName}`,
                email = subscriber.email_address,
                client = {
                    name: parsedEmail.domain
                };

            if (!companies.find((company) => company.name.toLowerCase() == parsedEmail.domain.toLowerCase())) {
                companies.push({
                    name: parsedEmail.domain
                })
            }
            return {
                firstName,
                lastName,
                name,
                email,
                client
            }
        });
        return {
            companies,
            contacts
        }
    };

    async checkDuplicates (resource, params) {
        this.logger.upsales.action(`Checking ${resource} duplicates with such params ${JSON.stringify(params)}`);
        let result = await this.upsales[resource].get(params);
        return result.metadata.total !== 0 ? result.data[0] : false
    };

    async createCompanies (companies) {
        this.logger.upsales.action(`Creating companies`);
        let ids = [],
            results = [];
        for (let i = 0; i < companies.length; i++) {
            let company = await this.checkDuplicates(`company`, {name: companies[i].name})
                || await this.upsales.company.create(companies[i]);
            company = company && company.data || company;
            this.logger.upsales.success(`Created company - name: ${company.name}`);
            if (ids.indexOf(company.id) == -1) {
                ids.push(company.id);
                results.push({
                    id: company.id,
                    name: company.name
                })
            }
        }
        return results
    };

    async createContacts (contacts, companies) {
        this.logger.upsales.action(`Creating contacts`);
        let results = [];
        for (let i = 0; i < contacts.length; i++) {
            contacts[i].client = companies.find((company) =>
            company.name.toLowerCase() === contacts[i].client.name.toLowerCase());
            let contact = await this.checkDuplicates(`contacts`, {email: contacts[i].email})
                || await this.upsales.contacts.create(contacts[i]);
            contact = contact && contact.data || contact;
            results.push(contact);
            this.logger.upsales.success(`Created contact - email: ${contact.email}, firstName: ${contact.firstName}, lastName: ${contact.lastName}`)
        }
        return results
    };

    async clearResourceByParams (resource, duplicates, params) {
        this.logger.upsales.action(`Clearing ${resource} by params ${JSON.stringify(params)}`);
        let results = [];
        for (let i = 0; i < duplicates.length; i++) {
            for (let k = 0; k < 1000; k++) {
                let searchParams = {},
                    duplicate;
                params.forEach(param => {
                    searchParams[param] = duplicates[i][param]
                });
                duplicate = await this.checkDuplicates(resource, searchParams);

                if (duplicate) {
                    this.logger.upsales.action(`Deleting ${resource}: ${duplicate.name} `);
                    results.push(await this.upsales[resource].delete({id: duplicate.id}));
                }
                else {
                    break
                }
            }
        }
        return results
    };

    async clearDuplicateContacts () {
        let data = await this.prepareData();
        return await this.clearResourceByParams(`contacts`, data.contacts, [`email`]);
    }

    async clearDuplicateCompany () {
        let data = await this.prepareData();
        return await this.clearResourceByParams(`company`, data.companies, [`name`]);

    }

    async integrate () {
        try {
            let data = await this.prepareData();

            let companies = await this.createCompanies(data.companies);
            this.logger.integrator.success(`Created companies:`);
            this.logger.integrator.info(companies);

            let contacts = await this.createContacts(data.contacts, companies);
            this.logger.integrator.success(`Created contacts:`);
            this.logger.integrator.info(contacts);

            return {
                companies,
                contacts
            }
        } catch (e) {
            this.logger.integrator.error(e.message)
        }
    }
}

module.exports = Integrator;
