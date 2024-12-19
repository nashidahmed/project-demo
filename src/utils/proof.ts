import { ProofExchangeRecord } from "@credo-ts/core";
import { DemoAgent } from "../BaseAgent";
import { greenText } from "./OutputClass";

export async function acceptProofRequest(
  agent: DemoAgent,
  proofRecord: ProofExchangeRecord
) {
  const requestedCredentials = await agent.proofs.selectCredentialsForRequest({
    proofRecordId: proofRecord.id,
    proofFormats: { anoncreds: { filterByNonRevocationRequirements: false } },
  });

  await agent.proofs.acceptRequest({
    proofRecordId: proofRecord.id,
    proofFormats: requestedCredentials.proofFormats,
  });

  console.log(greenText("\nProof request accepted!\n"));
}
