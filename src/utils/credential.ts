import {
  CredentialExchangeRecord,
  KeyType,
  OfferCredentialOptions,
  TypedArrayEncoder,
  V2CredentialProtocol,
} from "@credo-ts/core";
import { DemoAgent, indyNetworkConfig } from "../BaseAgent";
import { Color, purpleText, redText } from "./OutputClass";
import { RegistryOptions } from "../Laptop";
import { IndyVdrRegisterCredentialDefinitionOptions } from "@credo-ts/indy-vdr";
import { registerSchema } from "./schema";
import { AnonCredsCredentialFormatService } from "@credo-ts/anoncreds";
import {
  registerRevocationRegistry,
  registerRevocationStatusList,
} from "./revocation";
import { getConnectionRecord } from "./connection";

export async function importDid(agent: DemoAgent, registry: string) {
  // NOTE: we assume the did is already registered on the ledger, we just store the private key in the wallet
  // and store the existing did in the wallet
  // indy did is based on private key (seed)
  const unqualifiedIndyDid = "2jEvRuKmfBJTRa7QowDpNN";
  const cheqdDid = "did:cheqd:testnet:d37eba59-513d-42d3-8f9f-d1df0548b675";
  const indyDid = `did:indy:${indyNetworkConfig.indyNamespace}:${unqualifiedIndyDid}`;

  const did = registry === RegistryOptions.indy ? indyDid : cheqdDid;
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
    await agent.modules.anoncreds.registerCredentialDefinition<IndyVdrRegisterCredentialDefinitionOptions>(
      {
        credentialDefinition: {
          schemaId,
          issuerId,
          tag: "latest",
        },
        options: {
          supportRevocation,
          endorserMode: "internal",
          endorserDid: issuerId,
        },
      }
    );

  if (credentialDefinitionState.state !== "finished") {
    throw new Error(
      `Error registering credential definition: ${
        credentialDefinitionState.state === "failed"
          ? credentialDefinitionState.reason
          : "Not Finished"
      }}`
    );
  }

  console.log("\nCredential definition registered!!\n");
  return credentialDefinitionState;
}

export async function issueCredential(
  agent: DemoAgent,
  issuerId: string,
  supportRevocation: boolean,
  outOfBandId: string
) {
  const schema = await registerSchema(agent, issuerId);
  const credentialDefinition = await registerCredentialDefinition(
    agent,
    issuerId,
    schema.schemaId,
    supportRevocation
  );
  const connectionRecord = await getConnectionRecord(agent, outOfBandId);

  let revocationRegistry;
  if (supportRevocation) {
    revocationRegistry = await registerRevocationRegistry(
      agent,
      credentialDefinition.credentialDefinitionId,
      issuerId
    );

    await registerRevocationStatusList(agent, {
      revocationRegistryDefinitionId:
        revocationRegistry?.revocationRegistryDefinitionId,
      issuerId,
    });
  }

  console.log("\nSending credential offer...\n");

  const options: OfferCredentialOptions<
    V2CredentialProtocol<AnonCredsCredentialFormatService[]>[]
  > = {
    connectionId: connectionRecord.id,
    protocolVersion: "v2",
    credentialFormats: {
      anoncreds: {
        attributes: [
          {
            name: "name",
            value: "Alexa",
          },
          {
            name: "type",
            value: "Smart Assistant",
          },
          {
            name: "date",
            value: new Date().toISOString(),
          },
        ],
        credentialDefinitionId: credentialDefinition.credentialDefinitionId,
      },
    },
  };

  if (supportRevocation && options.credentialFormats.anoncreds) {
    options.credentialFormats.anoncreds.revocationRegistryDefinitionId =
      revocationRegistry?.revocationRegistryDefinitionId;
    options.credentialFormats.anoncreds.revocationRegistryIndex = 1;
  }

  const credential = await agent.credentials.offerCredential(options);
  console.log(
    `\nCredential offer sent!\n\nGo to the Alice agent to accept the credential offer\n\n${Color.Reset}`
  );

  return { credential, credentialDefinition };
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
