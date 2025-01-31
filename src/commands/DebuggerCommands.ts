// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import {
  debug,
  DebugConfiguration,
  QuickPickItem,
  window,
  workspace,
} from 'vscode';

import * as path from 'path';
import { DEBUG_TYPE } from '../debugAdapter/constants/debugAdapter';
import { DebugNetwork } from '../debugAdapter/debugNetwork';
import { TransactionProvider } from '../debugAdapter/transaction/transactionProvider';
import { Web3Wrapper } from '../debugAdapter/web3Wrapper';

export namespace DebuggerCommands {
  export async function startSolidityDebugger() {
    const workingDirectory = getWorkingDirectory();
    if (!workingDirectory) {
      return;
    }
    const debugNetwork = new DebugNetwork(workingDirectory);
    await debugNetwork.load();
    const contractBuildDir = debugNetwork.getTruffleConfiguration()!.contracts_build_directory;
    const debugNetworkOptions = debugNetwork.getNetwork()!.options;
    const web3 = new Web3Wrapper(debugNetworkOptions);
    const providerUrl = web3.getProviderUrl();

    if (debugNetwork.isLocalNetwork()) {
      // if local service then provide last transactions to choose
      const transactionProvider = new TransactionProvider(web3, contractBuildDir);
      const quickPickItems = await getQuickPickItems(transactionProvider);

      const quickPick = window.createQuickPick();
      quickPick.placeholder = 'Enter the transaction hash to debug';
      quickPick.ignoreFocusOut = true;
      const onTransactionSelected = (selection: QuickPickItem[]) => {
        if (selection[0]) {
          const txHash = selection[0].label;
          const config = generateDebugAdapterConfig(txHash, workingDirectory, providerUrl);
          debug.startDebugging(undefined, config);
        }
        quickPick.hide();
      };

      quickPick.items = quickPickItems;
      quickPick.onDidChangeSelection(onTransactionSelected);
      quickPick.onDidHide(() => quickPick.dispose());
      quickPick.show();
    } else {
      // if remote network then require txHash
      const placeHolder = 'Type the transaction hash you want to debug (0x...)';
      const txHash = await window.showInputBox({ placeHolder });
      if (txHash) {
        const config = generateDebugAdapterConfig(txHash, workingDirectory, providerUrl);
        debug.startDebugging(undefined, config);
      }
    }
  }
}

async function getQuickPickItems(txProvider: TransactionProvider) {
    const txHashes = await txProvider.getLastTransactionHashes();
    const txInfos = await txProvider.getTransactionsInfo(txHashes);

    return txInfos.map((txInfo) => {
        const description = generateDescription(txInfo.contractName, txInfo.methodName);
        return { alwaysShow: true, label: txInfo.hash, description } as QuickPickItem;
    });
}

function getWorkingDirectory() {
    if (typeof workspace.workspaceFolders === 'undefined' || workspace.workspaceFolders.length === 0) {
        return '';
    }

    return workspace.workspaceFolders[0].uri.fsPath;
}

function generateDebugAdapterConfig(txHash: string, workingDirectory: string, providerUrl: string)
: DebugConfiguration  {
    return {
        files: [],
        name: 'Debug Transactions',
        providerUrl,
        request: 'launch',
        txHash,
        type: DEBUG_TYPE,
        workingDirectory,
    } as DebugConfiguration;
}

// Migration.json, setComplete => Migration.setComplete()
function generateDescription(contractName?: string, methodName?: string) {
    const contractNameWithoutExt = path.basename(contractName || '', '.json');
    return `${contractNameWithoutExt}.${methodName}()`;
}
