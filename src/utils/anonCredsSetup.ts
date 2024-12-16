import {
  RegisterCredentialDefinitionReturnStateFinished,
  RegisterRevocationRegistryDefinitionReturnStateFinished,
} from "@credo-ts/anoncreds";
import { DemoAgent } from "../BaseAgent";
import { registerCredentialDefinition } from "./credentialHelpers";
import {
  registerRevocationRegistry,
  registerRevocationStatusList,
} from "./revocationHelpers";
import { registerSchema } from "./schemaHelpers";
import { getConnectionRecord } from "./connectionHelpers";
import { ConnectionRecord } from "@credo-ts/core";

interface AnonCredsSetupResponse {
  credentialDefinition: RegisterCredentialDefinitionReturnStateFinished;
  connectionRecord: ConnectionRecord;
  revocationRegistry?: RegisterRevocationRegistryDefinitionReturnStateFinished;
}

export async function setupAnonCreds(
  agent: DemoAgent,
  issuerId: string,
  outOfBandId: string,
  supportRevocation: boolean
): Promise<AnonCredsSetupResponse> {
  const schema = await registerSchema(agent, issuerId);

  const credentialDefinition = await registerCredentialDefinition(
    agent,
    issuerId,
    schema.schemaId,
    supportRevocation
  );

  if (supportRevocation) {
    const revocationRegistry = await registerRevocationRegistry(
      agent,
      issuerId,
      credentialDefinition.credentialDefinitionId
    );

    await registerRevocationStatusList(agent, {
      revocationRegistryDefinitionId:
        revocationRegistry?.revocationRegistryDefinitionId,
      issuerId,
    });
  }

  const connectionRecord = await getConnectionRecord(outOfBandId!, agent);

  if (supportRevocation) {
    return {
      credentialDefinition,
      connectionRecord,
      revocationRegistry,
    };
  } else {
    return {
      credentialDefinition,
      connectionRecord,
    };
  }
}
