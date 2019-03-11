/**
 * Created by 4ant0m on 3/7/19.
 */

const MailchimpV3 = require(`mailchimp-api-v3`);

class Mailchimp extends MailchimpV3 {
    constructor (data) {
        super(data)
    }

    async getLists () {
        try {
            let result = await this.get({
                path: `/lists/`
            });
            return result.lists
        } catch (e) {
            throw e
        }
    };

    async getAllSubscribers () {
        try {
            let lists = await this.getLists(),
                batch = lists.map((list) => {
                    return {
                        method: `get`,
                        path: `/lists/${list.id}/members/`
                    }
                });
            let results = await this.batch(batch),
                members = [],
                membersLists = results.map((result) => {
                    return result.members
                });

            membersLists.forEach((membersList) => {
                members = members.concat(membersList)
            });
            return members
        } catch (e) {
            throw e
        }
    };
}

module.exports = Mailchimp;

