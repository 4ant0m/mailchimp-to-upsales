/**
 * Created by 4ant0m on 3/7/19.
 */
const Integrator = require(`./integrator`)
const config = require(`./config`);

(async () => {
    let integrator = new Integrator({
        upsales: {
            token: config.APItokens.upsales
        },
        mailchimp: {
            token: config.APItokens.mailchimp
        }
    });

    await integrator.integrate()
   /* console.log(await integrator.upsales.company.get())
    console.log(await integrator.upsales.contacts.get())

    await integrator.clearDuplicateCompany();
    await integrator.clearDuplicateContacts();
*/
    //await integrator.clearCompany();
    console.log(await integrator.upsales.company.getAll())
    //console.log(await integrator.upsales.contacts.get())
    await integrator.integrateTest();

    console.log(await integrator.upsales.company.getAll())
    //console.log(await integrator.mailchimp.getLists())
    //console.log(await integrator.integrate())




})();