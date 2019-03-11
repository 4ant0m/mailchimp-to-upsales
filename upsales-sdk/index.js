/**
 * Created by 4ant0m on 3/8/19.
 */
const request = require('superagent');
const RESOURCES = require('./resources');
const METHODS = require('./methods');

const LINK = `https://integration.upsales.com/api`;

class Upsales {
    constructor (data) {
        this.token = data.token;
        this.version = data.version;
        this.link = `${LINK}/v${this.version}`;

        this._makeResources(RESOURCES, METHODS)
    }

    _makeResources (resources, methods) {
        for (let resource in resources) {
            if (!RESOURCES.hasOwnProperty(resource)) {
                continue;
            }
            this._makeMethods(resource, methods)

        }
    }

    _makeMethods (resource, methods) {
        Upsales.prototype[resource] = {};
        for (let method in methods) {
            if (!RESOURCES.hasOwnProperty(resource)) {
                continue;
            }
            Upsales.prototype[resource][method] = this.makeRequest.bind(this, resource, methods[method]);
        }
    }

    _getAPILink (resource) {
        return `${this.link}${RESOURCES[resource]}`
    }

    async makeRequest (resource, method, params) {
        try {
            let id = params && params.id || ``,
                link = `${this._getAPILink(resource)}/${id}`,
                res = await request
                    [method](link)
                    .set({Accept: 'application/json'})
                    .query({token: this.token})
                    .query(params)
                    .send(params);
            if (res.body.error) {
                throw new Error(`Error Response. Link: ${link}, method: ${method}, message: ${res.body.error}`);
            }
            return res.body
        } catch (e) {
            throw e
        }
    }
}

module.exports = Upsales;