/**
 * Created by 4ant0m on 3/13/19.
 */
const Integrator = require(`../integrator`),
    config = require(`../config`),
    integrator = new Integrator({
        upsales: {
            token: config.APItokens.upsales
        },
        mailchimp: {
            token: config.APItokens.mailchimp
        }
    });

jest.setTimeout(30000);
jest.mock('get-subscribers');

describe('./integrator.js', () => {
    let preparedData = {};
    let subscribers = require('get-subscribers')()

    it('should prepare contacts from MC members ', () => {
        let data = integrator.prepareContactsFromMembers(subscribers);
        expect(data).not.toBeNull();
        expect(data).toEqual(expect.arrayContaining([expect.objectContaining({
            firstName: expect.any(String),
            lastName: expect.any(String),
            email: expect.any(String),
            client: expect.any(Object),
            projects: expect.any(Array)
        })]));
    });

    it('should prepare companies from MC members ', () => {
        let data = integrator.prepareCompaniesFromMembers(subscribers);
        expect(data).not.toBeNull();
        expect(data).toEqual(expect.arrayContaining([expect.objectContaining({
            name: expect.any(String),
        })]));
    });

    it('should prepare campaigns from MC lists ', () => {
        return integrator.mailchimp.getLists().then(lists =>
        integrator.prepareCampaignsFromLists(lists).then(data => {
            expect(data).not.toBeNull();
            expect(data).toEqual(expect.arrayContaining([expect.objectContaining({
                name: expect.any(String),
            })]));
        }));
    });

    it('should return prepared data with expected fields ', () => {
        return integrator.prepareData().then(data => {
            expect(data).not.toBeNull();
            expect(data).toEqual(expect.objectContaining({
                companies: expect.any(Array),
                campaigns: expect.any(Array),
                contacts: expect.any(Array),
                privateContacts: expect.any(Array)
            }));
            preparedData = data
        });
    });

    it('should clear companies ', () => {
        return integrator.clearCompany().then(data => {
            expect(data).not.toBeNull();
            expect(Array.isArray(data)).toBe(true);
            expect(data).toEqual(expect.not.arrayContaining([expect.not.objectContaining({
                error: null
            })]));
        });
    });

    it('should clear contacts ', () => {
        return integrator.clearContacts().then(data => {
            expect(data).not.toBeNull();
            expect(Array.isArray(data)).toBe(true);
            expect(data).toEqual(expect.not.arrayContaining([expect.not.objectContaining({
                error: null
            })]));
        });
    });

    it('should clear campaigns ', () => {
        return integrator.clearCampaign().then(data => {
            expect(data).not.toBeNull();
            expect(Array.isArray(data)).toBe(true);
            expect(data).toEqual(expect.not.arrayContaining([expect.not.objectContaining({
                error: null
            })]));
        });
    });

    it('should create companies ', () => {
        return integrator.createCompanies(preparedData.companies).then(data => {
            expect(data).not.toBeNull();
            expect(data).toEqual(expect.arrayContaining([expect.objectContaining({
                    name: preparedData.companies[0].name
                })])
            );
        });
    });

    it('should create campaigns ', () => {
        return integrator.createCampaigns(preparedData.campaigns).then(data => {
            expect(data).not.toBeNull();
            expect(data).toEqual(expect.arrayContaining([expect.objectContaining({
                    name: preparedData.campaigns[0].name
                })])
            );
        });
    });

    it('should create contacts ', () => {
        console.log(preparedData.contacts)
        return integrator.createContacts(preparedData.contacts).then(data => {
            expect(data).not.toBeNull();
            for (let i = 0; i < data.length; i++) {
                expect(data).toEqual(expect.arrayContaining([expect.objectContaining({
                        name: preparedData.contacts[i].name,
                        firstName: preparedData.contacts[i].firstName,
                        lastName: preparedData.contacts[i].lastName,
                        email: preparedData.contacts[i].email
                    })])
                );
            }
        });
    });
});
