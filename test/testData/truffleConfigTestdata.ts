// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fs from 'fs-extra';
import * as path from 'path';

export const referenceCfgContent = 'const HDWalletProvider = require("truffle-hdwallet-provider");'
  + 'module.exports = {'
  + '  networks: {'
  + '    development: {'
  + '      host: "127.0.0.1",'
  + '      port: 8545,'
  + '      network_id: "*"'
  + '    },'
  + '    "localhost:123": {'
  + '      from: "string",'
  + '      gas: 2,'
  + '      gasPrice: 3,'
  + '      host: "127.0.0.1",'
  + '      network_id: "*",'
  + '      port: 123,'
  + '      provider: new HDWalletProvider('
  + '                        fs.readFileSync("path", "encoding"),'
  + '                        "url"),'
  + '      skipDryRun: true,'
  + '      timeoutBlocks: 4,'
  + '      websockets: false,'
  + '    }'
  + '  },'
  + '  mocha: {},'
  + '  compilers: {'
  + '    solc: {}'
  + '  }'
  + '};';

export const referenceCfgContentWithDirectories = 'const HDWalletProvider = require("truffle-hdwallet-provider");'
  + 'module.exports = {'
  + '  contracts_build_directory: "build",'
  + '  contracts_directory: "test_contracts",'
  + '  migrations_directory: "test_migrations",'
  + '  networks: {'
  + '    development: {'
  + '      host: "127.0.0.1",'
  + '      port: 8545,'
  + '      network_id: "*"'
  + '    },'
  + '    "localhost:123": {'
  + '      from: "string",'
  + '      gas: 2,'
  + '      gasPrice: 3,'
  + '      host: "127.0.0.1",'
  + '      network_id: "*",'
  + '      port: 123,'
  + '      provider: new HDWalletProvider('
  + '                        fs.readFileSync("path", "encoding"),'
  + '                        "url"),'
  + '      skipDryRun: true,'
  + '      timeoutBlocks: 4,'
  + '      websockets: false,'
  + '    }'
  + '  },'
  + '  mocha: {},'
  + '  compilers: {'
  + '    solc: {}'
  + '  }'
  + '};';

export const referenceConfiguration = {
  contracts_build_directory: 'build\\contracts',
  contracts_directory: 'contracts',
  migrations_directory: 'migrations',
  networks: [
    {
      name: 'development',
      options: {
        host: '127.0.0.1',
        network_id: '*',
        port: 8545,
      },
    },
    {
      name: 'localhost:123',
      options: {
        from: 'string',
        gas: 2,
        gasPrice: 3,
        host: '127.0.0.1',
        network_id: '*',
        port: 123,
        provider: {
          raw: 'new HDWalletProvider(fs.readFileSync(\"path\", \"encoding\"), \"url\")',
          url: 'url',
        },
        skipDryRun: true,
        timeoutBlocks: 4,
        websockets: false,
      },
    },
  ],
};

const referenceAstPath = path.join(__dirname, 'referenceAstObject.json');
export const referenceAstObject = JSON.parse(fs.readFileSync(referenceAstPath, 'utf-8').toString());
