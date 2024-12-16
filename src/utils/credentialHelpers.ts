import {
  CredentialExchangeRecord,
  KeyType,
  TypedArrayEncoder,
} from "@credo-ts/core";
import { DemoAgent, indyNetworkConfig } from "../BaseAgent";
import { Color, purpleText, redText } from "./OutputClass";

export async function registerCredentialDefinition(
  agent: DemoAgent,
  issuerId: string,
  schemaId: string,
  supportRevocation: boolean
) {
  if (!issuerId) {
    throw new Error(redText("Missing anoncreds issuerId"));
  }

  console.log("\nRegistering credential definition...\n");
  const { credentialDefinitionState } =
    await agent.modules.anoncreds.registerCredentialDefinition({
      credentialDefinition: {
        schemaId,
        issuerId,
        tag: "latest",
      },
      options: {
        supportRevocation,
      },
    });

  if (credentialDefinitionState.state !== "finished") {
    throw new Error(
      `Error registering credential definition: ${
        credentialDefinitionState.state === "failed"
          ? credentialDefinitionState.reason
          : "Not Finished"
      }}`
    );
  }

  // this.credentialDefinition = credentialDefinitionState;
  console.log("\nCredential definition with revocation support registered!!\n");

  return credentialDefinitionState;
}

export async function deleteCredential(agent: DemoAgent, credentialId: string) {
  try {
    await agent.credentials.deleteById(credentialId);
    console.log(`Credential with ID ${credentialId} deleted successfully.`);
  } catch (error) {
    console.error("Error deleting credential:", error);
    throw new Error("Credential deletion failed");
  }
}

export function printCredentialAttributes(
  credentialRecord: CredentialExchangeRecord
) {
  if (credentialRecord.credentialAttributes) {
    const attribute = credentialRecord.credentialAttributes;
    console.log("\n\nCredential preview:");
    attribute.forEach((element) => {
      console.log(purpleText(`${element.name} ${Color.Reset}${element.value}`));
    });
  }
}

export async function acceptCredentialOffer(
  agent: DemoAgent,
  credentialRecord: CredentialExchangeRecord
) {
  await agent.credentials.acceptOffer({
    credentialRecordId: credentialRecord.id,
  });
  console.log(
    new Date(),
    "Accepted credential offer with ID:",
    credentialRecord.id
  );
}

export async function acceptCredentialRequest(
  agent: DemoAgent,
  credentialRecord: CredentialExchangeRecord
) {
  await agent.credentials.acceptRequest({
    credentialRecordId: credentialRecord.id,
  });
  console.log(
    new Date(),
    "Accepted credential request with ID:",
    credentialRecord.id
  );
}

export async function acceptCredential(
  agent: DemoAgent,
  credentialRecord: CredentialExchangeRecord
) {
  await agent.credentials.acceptCredential({
    credentialRecordId: credentialRecord.id,
  });
  console.log("Accepted credential with ID:", credentialRecord.id);
}

export async function importDid(agent: DemoAgent): Promise<string> {
  // NOTE: we assume the did is already registered on the ledger, we just store the private key in the wallet
  // and store the existing did in the wallet
  // indy did is based on private key (seed)
  const unqualifiedIndyDid = "2jEvRuKmfBJTRa7QowDpNN";
  const did = `did:indy:${indyNetworkConfig.indyNamespace}:${unqualifiedIndyDid}`;

  await agent.dids.import({
    did,
    overwrite: true,
    privateKeys: [
      {
        keyType: KeyType.Ed25519,
        privateKey: TypedArrayEncoder.fromString(
          "afjdemoverysercure00000000000000"
        ),
      },
    ],
  });
  return did;
}
