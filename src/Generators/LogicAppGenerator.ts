// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as fs from 'fs-extra';
import * as path from 'path';
import { Uri, window } from 'vscode';
import { Constants } from '../Constants';
import { getWorkspaceRoot, TruffleConfiguration } from '../helpers';
import { showInputBox, showQuickPick } from '../helpers/userInteraction';
import { ResourceGroupItem, SubscriptionItem } from '../Models/QuickPickItems';
import { Output } from '../Output';
import { AzureResourceExplorer } from '../resourceExplorers';
import { Telemetry } from '../TelemetryClient';
import { buildContract } from './AbiDeserialiser';
import './Nethereum.Generators.DuoCode';

interface ILogicAppData {
  contractAddress: string;
  messagingType?: number;
  outputDir: string;
  resourceGroup: string;
  serviceType: number;
  subscriptionId: string;
  topicName?: string;
  workflowType: string;
}

export class LogicAppGenerator {
  public async generateMicroservicesWorkflows(filePath?: Uri): Promise<void> {
    Telemetry.sendEvent('LogicAppGenerator.microservicesWorkflows');
    this.generateWorkflows(Constants.microservicesWorkflows.Service, filePath);
  }

  public async generateDataPublishingWorkflows(filePath?: Uri): Promise<void> {
    Telemetry.sendEvent('LogicAppGenerator.dataPublishingWorkflows');
    this.generateWorkflows(Constants.microservicesWorkflows.Data, filePath);
  }

  public async generateEventPublishingWorkflows(filePath?: Uri): Promise<void> {
    Telemetry.sendEvent('LogicAppGenerator.eventPublishingWorkflows');
    this.generateWorkflows(Constants.microservicesWorkflows.Messaging, filePath);
  }

  public async generateReportPublishingWorkflows(filePath?: Uri): Promise<void> {
    Telemetry.sendEvent('LogicAppGenerator.reportPublishingWorkflows');
    this.generateWorkflows(Constants.microservicesWorkflows.Reporting, filePath);
  }

  private async generateWorkflows(workflowType: string, filePath?: Uri): Promise<void> {
    const filePaths = await this.getContractsPath(filePath);
    const logicAppData = await this.getLogicAppData(workflowType);
    for (const file of filePaths) {
      const contract = await fs.readJson(file, { encoding: 'utf8' });
      const generatedFiles: any[] = this.getGenerator(contract, logicAppData).GenerateAll();
      for (const generatedFile of generatedFiles) {
        await this.writeFile(generatedFile);
      }
    }

    window.showInformationMessage(Constants.informationMessage.generatedLogicApp);
    Telemetry.sendEvent('LogicAppGenerator.generateWorkflows.commandFinished');
  }

  private async getContractsPath(filePath?: Uri): Promise<string[]> {
    const truffleConfigPath = TruffleConfiguration.getTruffleConfigUri();
    const truffleConfig = new TruffleConfiguration.TruffleConfig(truffleConfigPath);
    const configuration = truffleConfig.getConfiguration();
    const buildDir = path.join(getWorkspaceRoot()!, configuration.contracts_build_directory);
    const files: string[] = [];

    if (!fs.pathExistsSync(buildDir)) {
      Telemetry.sendException(new Error(Constants.errorMessageStrings.BuildContractsDirIsNotExist(
        Telemetry.obfuscate(buildDir),
      )));
      throw new Error(Constants.errorMessageStrings.BuildContractsDirIsNotExist(buildDir));
    }

    if (filePath) {
      // TODO: what should we do if solidity file without constructor?
      const contractName = path.basename(filePath.fsPath, Constants.contractExtension.sol);
      files.push(`${contractName}${Constants.contractExtension.json}`);
    } else {
      files.push(...await fs.readdir(buildDir));
    }

    const filePaths = files
      .map((file) => path.join(buildDir, file))
      .filter((file) => fs.lstatSync(file).isFile());

    if (files.length === 0) {
      Telemetry.sendException(new Error(
        Constants.errorMessageStrings.BuildContractsDirIsEmpty(Telemetry.obfuscate(buildDir)) + ' ' +
        Constants.errorMessageStrings.BuildContractsBeforeGenerating,
      ));
      throw new Error(
        Constants.errorMessageStrings.BuildContractsDirIsEmpty(buildDir) + ' ' +
        Constants.errorMessageStrings.BuildContractsBeforeGenerating,
      );
    }

    return filePaths;
  }

  private async getLogicAppData(workflowType: string): Promise<ILogicAppData> {
    const serviceType = await this.getServiceType(workflowType);
    const outputDir = await this.getOutputDir(serviceType);
    const contractAddress = await showInputBox({ ignoreFocusOut: true, value: 'contract address' });
    const [subscriptionItem, resourceGroupItem] = await this.selectSubscriptionAndResourceGroup();
    const logicAppData: ILogicAppData = {
      contractAddress,
      outputDir,
      resourceGroup: resourceGroupItem.description,
      serviceType,
      subscriptionId: subscriptionItem.subscriptionId,
      workflowType,
    };

    if (workflowType === Constants.microservicesWorkflows.Messaging) {
      Telemetry.sendEvent('LogicAppGenerator.getLogicAppData.workflowTypeIsMessaging');
      logicAppData.topicName = await showInputBox({ ignoreFocusOut: true, value: 'topic name' });
      logicAppData.messagingType = await this.getMessagingType();
    }

    return logicAppData;
  }

  private getGenerator(contract: any, logicAppData: ILogicAppData) {
    const { Service, Data, Messaging, Reporting } = Constants.microservicesWorkflows;

    switch (logicAppData.workflowType) {
      case Service:
        Telemetry.sendEvent('LogicAppGenerator.getGenerator.Service');
        return this.getServiceWorkflowProjectGenerator(contract, logicAppData);
      case Data:
        Telemetry.sendEvent('LogicAppGenerator.getGenerator.Data');
        return this.getDataWorkflowProjectGenerator(contract, logicAppData);
      case Messaging:
        Telemetry.sendEvent('LogicAppGenerator.getGenerator.Messaging');
        return this.getMessagingWorkflowProjectGenerator(contract, logicAppData);
      case Reporting:
        Telemetry.sendEvent('LogicAppGenerator.getGenerator.Reporting');
        return this.getReportingWorkflowProjectGenerator(contract, logicAppData);
      default:
        const error = new Error(Constants.errorMessageStrings.WorkflowTypeDoesNotMatch);
        Telemetry.sendException(error);
        throw error;
    }
  }

  private async selectSubscriptionAndResourceGroup(): Promise<[SubscriptionItem, ResourceGroupItem]> {
    const azureResourceExplorer = new AzureResourceExplorer();
    await azureResourceExplorer.waitForLogin();

    const subscriptionItem = await azureResourceExplorer.getOrSelectSubscriptionItem();
    const resourceGroupItem = await azureResourceExplorer.getOrCreateResourceGroupItem(subscriptionItem);

    return [subscriptionItem, resourceGroupItem];
  }

  private async getServiceType(workflowType: string): Promise<number> {
    const items = [
      { label: Constants.logicApp.LogicApp, serviceType: 1 },
      { label: Constants.logicApp.FlowApp, serviceType: 0 },
    ];

    if (workflowType === Constants.microservicesWorkflows.Service) {
      items.push({ label: Constants.logicApp.AzureFunction, serviceType: 2 });
    }

    const item = await showQuickPick(items, { ignoreFocusOut: true });
    return item.serviceType;
  }

  private getOutputDir(serviceType: int): string {
    switch (serviceType) {
      case 0:
        return path.join(getWorkspaceRoot()!, Constants.logicApp.output.FlowApp);
      case 1:
        return path.join(getWorkspaceRoot()!, Constants.logicApp.output.LogicApp);
      case 2:
        return path.join(getWorkspaceRoot()!, Constants.logicApp.output.AzureFunction);
      default: {
        const error = new Error(Constants.errorMessageStrings.InvalidServiceType);
        Telemetry.sendException(error);
        throw error;
      }
    }
  }

  private async getMessagingType(): Promise<number> {
    const items = [
      { label: 'Event Grid', messagingType: 0 },
      { label: 'Service Bus', messagingType: 1 },
    ];

    const item = await showQuickPick(items, { ignoreFocusOut: true });
    return item.messagingType;
  }

  private getServiceWorkflowProjectGenerator(contract: any, logicAppData: ILogicAppData) {
    return new Nethereum.Generators.ServiceWorkflow.ServiceWorkflowProjectGenerator(
      buildContract(JSON.stringify(contract.abi)),
      contract.contractName,
      contract.bytecode,
      contract.contractName,
      `${contract.contractName}.${logicAppData.workflowType}`,
      logicAppData.outputDir,
      path.sep,
      logicAppData.serviceType,
      0,
      JSON.stringify(contract.abi),
      logicAppData.contractAddress,
      logicAppData.subscriptionId,
      logicAppData.resourceGroup,
      '',
    );
  }

  private getDataWorkflowProjectGenerator(contract: any, logicAppData: ILogicAppData) {
    return new Nethereum.Generators.DataWorkflow.DataWorkflowProjectGenerator(
      buildContract(JSON.stringify(contract.abi)),
      contract.contractName,
      contract.bytecode,
      contract.contractName,
      `${contract.contractName}.${logicAppData.workflowType}`,
      logicAppData.outputDir,
      path.sep,
      logicAppData.serviceType,
      0,
      logicAppData.contractAddress,
      logicAppData.subscriptionId,
      logicAppData.resourceGroup,
      JSON.stringify(contract.abi),
    );
  }

  private getMessagingWorkflowProjectGenerator(contract: any, logicAppData: ILogicAppData) {
    return new Nethereum.Generators.MessagingWorkflow.MessagingWorkflowProjectGenerator(
      buildContract(JSON.stringify(contract.abi)),
      contract.contractName,
      contract.bytecode,
      contract.contractName,
      `${contract.contractName}.${logicAppData.workflowType}`,
      logicAppData.outputDir,
      path.sep,
      logicAppData.serviceType,
      0,
      logicAppData.contractAddress,
      logicAppData.subscriptionId,
      logicAppData.resourceGroup,
      JSON.stringify(contract.abi),
      logicAppData.topicName!,
      logicAppData.messagingType!,
    );
  }

  private getReportingWorkflowProjectGenerator(contract: any, logicAppData: ILogicAppData) {
    return new Nethereum.Generators.ReportingWorkflow.ReportingWorkflowProjectGenerator(
      buildContract(JSON.stringify(contract.abi)),
      contract.contractName,
      contract.bytecode,
      contract.contractName,
      `${contract.contractName}.${logicAppData.workflowType}`,
      logicAppData.outputDir,
      path.sep,
      logicAppData.serviceType,
      0,
      logicAppData.contractAddress,
      logicAppData.subscriptionId,
      logicAppData.resourceGroup,
      JSON.stringify(contract.abi),
    );
  }

  private async writeFile(file: Nethereum.Generators.Core.GeneratedFile): Promise<void> {
    const filePath = path.join(file.get_OutputFolder(), file.get_FileName());

    await fs.mkdirp(path.dirname(filePath));
    await fs.writeFile(filePath, file.get_GeneratedCode());

    Output.outputLine(Constants.outputChannel.logicAppGenerator, 'Saved file to ' + filePath);
  }
}
