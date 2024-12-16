import {
  CredentialExchangeRecord,
  KeyType,
  TypedArrayEncoder,
} from "@credo-ts/core";
import { DemoAgent, indyNetworkConfig } from "../BaseAgent";
import { Color, purpleText, redText } from "./OutputClass";

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
