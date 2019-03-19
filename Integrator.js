const Upsales = require('./upsales-sdk');
const Mailchimp = require('./mailchimp-sdk');
const logger = require(`./lib/log`);
const PRIVATE_EMAILS = require(`./private-emails`);

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
        let domain = email.replace(/.*@/, "").toLowerCase(),
            domains = Integrator.jsUcfirst(email.replace(/.*@/, "")).split(`.`),
            names = email.replace(/@.*$/, "").split(`.`),
            firstname = Integrator.jsUcfirst(names[0]),
            lastname = Integrator.jsUcfirst(names[1]);

        return {
            domains,
            names,
            firstname,
            lastname,
            domain
        }
    };

    static checkPrivateEmail (contact) {
        return PRIVATE_EMAILS.indexOf(Integrator.parseEmail(contact.email).domain) != -1
    }

    filterPrivateEmails (contacts) {
        let publicEmails = [];
        let privateEmails = contacts.filter(contact => {
            return Integrator.checkPrivateEmail(contact)
        });
        return {
            publicEmails,
            privateEmails
        }
    }

    prepareContactsFromMembers (members) {
        let contacts = members.map((member) => {
            let parsedEmail = Integrator.parseEmail(member.email_address),
                firstName = member.merge_fields.FNAME || parsedEmail.firstname || ``,
                lastName = member.merge_fields.LNAME || parsedEmail.lastname || ``,
                name = `${firstName} ${lastName}`,
                email = member.email_address,
                client = {
                    name: Integrator.checkPrivateEmail({email: email}) ? `Private emails` : parsedEmail.domains[0],
                },
                projects = [];

            return {
                firstName,
                lastName,
                name,
                email,
                client,
                projects
            }
        });
        return contacts
    }

    prepareCompaniesFromMembers (members) {
        let companies = [];
        members.forEach((member) => {
            let parsedEmail = Integrator.parseEmail(member.email_address);
            if (!companies.find((company) => company.name.toLowerCase() == parsedEmail.domains[0].toLowerCase())) {
                companies.push({
                    name: Integrator.checkPrivateEmail({email: member.email_address}) ? `Private emails` : parsedEmail.domains[0]
                })
            }
        });
        return companies
    }

    async prepareCampaignsFromLists (lists) {
        let campaigns = [];

        for (let i = 0; i < lists.length; i++) {
            let members = await this.mailchimp.getMembersFromList(lists[i].id);
            campaigns.push({
                name: lists[i].name,
                contacts: this.prepareContactsFromMembers(members)
            })
        }
        return campaigns
    }

    async prepareData () {
        this.logger.mailchimp.action(`Getting all subscribers`);
        let subscribers = await this.mailchimp.getAllSubscribers();
        this.logger.mailchimp.action(`Getting all lists`);
        let lists = await this.mailchimp.getLists();

        this.logger.integrator.action(`Preparing data for Upsales`);

        let contacts = this.prepareContactsFromMembers(subscribers),
            companies = this.prepareCompaniesFromMembers(subscribers),
            campaigns = await this.prepareCampaignsFromLists(lists),
            privateContacts = this.filterPrivateEmails(contacts).privateEmails,
            publicContacts = this.filterPrivateEmails(contacts).publicEmails;

        campaigns.forEach(campaign => {
            contacts.forEach(contact => {
                if (campaign.contacts.find(item => item.email == contact.email)) {
                  contact.projects.push({name: campaign.name})
                }
            })
        });

        return {
            companies,
            contacts,
            campaigns,
            privateContacts,
            publicContacts
        }
    };

    async checkDuplicates (resource, param, data) {
        this.logger.upsales.action(`Checking ${resource} duplicates with such param ${param}`);
        let results = await this.upsales[resource].getAll();

        let filteredData = data.filter((item) =>
            results.data.find((result) => result[param] == item[param]) == null
        );

        return filteredData
    };

    async createCompanies (companies) {
        this.logger.upsales.action(`Creating companies`);
        let results = [];
        let filteredCompany = await this.checkDuplicates(`company`, `name`, companies);

        for (let i = 0; i < filteredCompany.length; i++) {
            let company = (await this.upsales.company.create(filteredCompany[i])).data;

            this.logger.upsales.success(`Created company - name: ${company.name}`);
            results.push(company)
        }
        return results
    };

    async createContacts (contacts) {
        this.logger.upsales.action(`Creating contacts`);
        let results = [],
            filteredContacts = await this.checkDuplicates(`contacts`, `email`, contacts),
            companies = (await this.upsales.company.getAll()).data || [],
            campaigns = (await this.upsales.campaign.getAll()).data || []

        for (let i = 0; i < filteredContacts.length; i++) {
            filteredContacts[i].client = companies.find((company) =>
            company.name.toLowerCase() === filteredContacts[i].client.name.toLowerCase());

            let projects = filteredContacts[i].projects.map((project) => {
                return campaigns.find((campaign) =>
                campaign.name.toLowerCase() === project.name.toLowerCase())
            });

            filteredContacts[i].projects = projects;

            let contact = (await this.upsales.contacts.create(filteredContacts[i])).data;

            results.push(contact);
            this.logger.upsales.success(`Created contact - email: ${contact.email}, firstName: ${contact.firstName}, lastName: ${contact.lastName}`)
        }

        return results
    };

    async createCampaigns (campaigns) {
        this.logger.upsales.action(`Creating campaign`);
        let results = [];
        let filtered = await this.checkDuplicates(`campaign`, `name`, campaigns);

        for (let i = 0; i < filtered.length; i++) {
            let result = (await this.upsales.campaign.create(filtered[i])).data;

            this.logger.upsales.success(`Created campaign - name: ${result.name}`);
            results.push(result)
        }
        return results
    }

    async clearResource (resource) {
        this.logger.upsales.action(`Clearing ${resource}`);
        let results = [],
            duplicates = (await this.upsales[resource].getAll()).data;

        for (let i = 0; i < duplicates.length; i++) {
            this.logger.upsales.action(`Deleting ${resource}: ${duplicates[i].name} `);
            results.push(await this.upsales[resource].delete({id: duplicates[i].id}));
        }
        return results
    };

    async clearContacts () {
        return await this.clearResource(`contacts`);
    }

    async clearCampaign () {
        return await this.clearResource(`campaign`);
    }

    async clearCompany () {
        return await this.clearResource(`company`);
    }

    async integrate () {
        try {
            let data = await this.prepareData();

            let companies = await this.createCompanies(data.companies);
            this.logger.integrator.success(`Created companies:`);
            this.logger.integrator.info(companies);

            let campaigns = await this.createCampaigns(data.campaigns);
            this.logger.integrator.success(`Created campaigns:`);
            this.logger.integrator.info(campaigns);

            let contacts = await this.createContacts(data.contacts);
            this.logger.integrator.success(`Created contacts:`);
            this.logger.integrator.info(contacts);

            return {
                companies,
                contacts,
                campaigns
            }
        } catch (e) {
            this.logger.integrator.error(e.message)
        }
    }
}

module.exports = Integrator;