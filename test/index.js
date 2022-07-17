'use strict';

const Code = require('@hapi/code');
const Lab = require('@hapi/lab');
const Server = require('../index');

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;

describe('Server', () => {

    it('starts without error', async () => {

        const server = await Server.init();
        expect(server.settings.port).to.equal(3000);
    });
});
