import {
  AnonCredsRegisterRevocationStatusListOptions,
  RegisterRevocationStatusListReturnStateFinished,
} from "@credo-ts/anoncreds";
import { CredoError } from "@credo-ts/core";
import { DemoAgent } from "../BaseAgent";

export async function registerRevocationRegistry(
  agent: DemoAgent,
  credentialDefinitionId: string,
  issuerId: string
) {
  if (!credentialDefinitionId) {
    throw new Error("Missing credential definition ID for revocation registry");
  }

  console.log("\nCreating revocation registry...\n");

  const { revocationRegistryDefinitionState } =
    await agent.modules.anoncreds.registerRevocationRegistryDefinition({
      revocationRegistryDefinition: {
        issuerId,
        credentialDefinitionId: credentialDefinitionId,
        tag: "latest",
        maximumCredentialNumber: 10, // Maximum number of credentials that can be issued
      },
      options: {},
    });

  if (revocationRegistryDefinitionState.state !== "finished") {
    throw new Error(
      `Error creating revocation registry: ${
        revocationRegistryDefinitionState.state === "failed"
          ? revocationRegistryDefinitionState.reason
          : "Not Finished"
      }`
    );
  }

  console.log("\nRevocation registry created successfully!\n");
  return revocationRegistryDefinitionState;
}

export async function registerRevocationStatusList(
  agent: DemoAgent,
  revocationStatusList: AnonCredsRegisterRevocationStatusListOptions
): Promise<RegisterRevocationStatusListReturnStateFinished> {
  const { revocationStatusListState } =
    await agent.modules.anoncreds.registerRevocationStatusList({
      revocationStatusList,
      options: {},
    });

  if (revocationStatusListState.state !== "finished") {
    throw new CredoError(
      `Revocation status list not created: ${
        revocationStatusListState.state === "failed"
          ? revocationStatusListState.reason
          : "Not finished"
      }`
    );
  }

  return revocationStatusListState;
}
