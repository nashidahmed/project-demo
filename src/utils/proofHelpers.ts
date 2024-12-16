import { ProofExchangeRecord } from "@credo-ts/core";
import { DemoAgent } from "../BaseAgent";
import { greenText } from "./OutputClass";

export async function acceptProofRequest(
  agent: DemoAgent,
  proofRecord: ProofExchangeRecord
) {
  console.log(proofRecord);
  const requestedCredentials = await agent.proofs.selectCredentialsForRequest({
    proofRecordId: proofRecord.id,
  });
  console.log(requestedCredentials);

  const proof = await agent.proofs.acceptRequest({
    proofRecordId: proofRecord.id,
    proofFormats: requestedCredentials.proofFormats,
  });
  console.log(proof);

  console.log(greenText("\nProof request accepted!\n"));
}
