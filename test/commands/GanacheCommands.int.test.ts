// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as cp from 'child_process';
import * as rp from 'request-promise';
import * as sinon from 'sinon';
import * as stream from 'stream';
import { GanacheCommands } from '../../src/commands';
import * as commands from '../../src/helpers/command';
import * as shell from '../../src/helpers/shell';
import {
  AzureBlockchainService,
  IExtensionItem,
  LocalProject,
  LocalService,
  Service,
} from '../../src/Models/TreeItems';
import { TreeManager } from '../../src/services';
import { ProjectView } from '../../src/ViewItems';

describe('Integration tests GanacheCommands', () => {
  const defaultPort = 8545;
  let getItemsMock: sinon.SinonStub<[(boolean | undefined)?], IExtensionItem[]>;
  let serviceItems: Service[];
  let loadStateMock: sinon.SinonStub<[], IExtensionItem[]>;
  let projectView: ProjectView;
  const streamMock = {
    on(_event: 'data', _listener: (chunk: any) => void): any { /* empty */ },
  };
  const processMock = {
    on(_event: 'close', _listener: (code: number, signal: string) => void): any { /* empty */ },
    stderr: streamMock as stream.Readable,
    stdout: streamMock as stream.Readable,
  };
  let nodeVersion = '';
  const tryExecuteCommandFake = async () => {
    return {
      cmdOutput: nodeVersion,
      cmdOutputIncludingStderr: '',
      code: 0,
    } as commands.ICommandResult;
  };

  before(async () => {
    serviceItems = await createTestServiceItems();
    getItemsMock = sinon.stub(TreeManager, 'getItems');
    getItemsMock.returns(serviceItems);
    loadStateMock = sinon.stub(TreeManager, 'loadState');
    loadStateMock.returns(serviceItems);

    projectView = new ProjectView(new LocalProject('test consortium', defaultPort));
  });

  afterEach(() => {
    sinon.restore();
  });

  it('startGanacheCmd should execute npx cmd',
    async () => {
      // Arrange
      nodeVersion = 'v10.15.0';
      const spawnStub = sinon.stub(cp, 'spawn').returns(processMock as cp.ChildProcess);
      sinon.stub(shell, 'findPid').resolves(Number.NaN);
      sinon.replace(commands, 'tryExecuteCommand', tryExecuteCommandFake);

      const response = { result: 'OK' };
      sinon.stub(rp, 'post').resolves(response);

      // Act
      await GanacheCommands.startGanacheCmd(projectView);

      // Assert
      assert.strictEqual(spawnStub.called, true, 'should execute external command ');
      assert.strictEqual(spawnStub.getCall(0).args[0], 'npx', 'should execute npx command');
      assert.deepStrictEqual(
        spawnStub.getCall(0).args[1],
        ['ganache-cli', `-p ${defaultPort}`],
        'should execute npx command with specific parameters',
      );
    });
});

async function createTestServiceItems(): Promise<Service[]> {
  const azureBlockchainService = new AzureBlockchainService();
  const localService = new LocalService();

  return [azureBlockchainService, localService];
}
