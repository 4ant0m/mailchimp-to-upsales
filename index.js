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
})();