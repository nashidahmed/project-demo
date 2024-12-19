import {
  ProofEventTypes,
  ProofExchangeRecord,
  ProofState,
  ProofStateChangedEvent,
} from "@credo-ts/core";
import { DemoAgent } from "../BaseAgent";
import { Color, greenText, redText } from "./OutputClass";
import { getConnectionRecord } from "./connection";
import { AnonCredsRequestProofFormat } from "@credo-ts/anoncreds";

export async function printProofFlow(print: string) {
  console.log(print);
  await new Promise((f) => setTimeout(f, 2000));
}

export async function newProofAttribute(credentialDefinitionId: string) {
  await printProofFlow(
    greenText(`Creating new proof attribute for 'name' ...\n`)
  );
  const proofAttribute = {
    name: {
      name: "name",
      restrictions: [
        {
          cred_def_id: credentialDefinitionId,
        },
      ],
    },
  };

  return proofAttribute;
}

export async function sendProofRequest(
  agent: DemoAgent,
  outOfBandId: string,
  credentialDefinitionId: string,
  nrpRequestedTime: number
) {
  const connectionRecord = await getConnectionRecord(agent, outOfBandId);
  const proofAttribute = await newProofAttribute(credentialDefinitionId);
  await printProofFlow(greenText("\nRequesting proof...\n", false));

  let requestProofFormat: AnonCredsRequestProofFormat;
  if (nrpRequestedTime) {
    requestProofFormat = {
      non_revoked: { from: nrpRequestedTime, to: nrpRequestedTime },
      name: "proof-request",
      version: "1.0",
      requested_attributes: proofAttribute,
    };
  } else {
    requestProofFormat = {
      name: "proof-request",
      version: "1.0",
      requested_attributes: proofAttribute,
    };
  }

  const proof = await agent.proofs.requestProof({
    protocolVersion: "v2",
    connectionId: connectionRecord.id,
    proofFormats: {
      anoncreds: requestProofFormat,
    },
  });
  console.log(
    `\nProof request sent!\n\nGo to the Alice agent to accept the proof request\n\n${Color.Reset}`
  );

  return proof;
}

export async function waitForProofResult(agent: DemoAgent): Promise<any> {
  return new Promise((resolve, reject) => {
    agent.events.on(
      ProofEventTypes.ProofStateChanged,
      async ({ payload }: ProofStateChangedEvent) => {
        const { proofRecord } = payload;

        switch (proofRecord.state) {
          case ProofState.Done:
            console.log(greenText("\nProof request accepted!\n"));
            resolve({
              state: ProofState.Done,
              proofRecord,
            });
            break;

          case ProofState.Abandoned:
            console.log(
              redText(`\nProof abandoned! ${proofRecord.errorMessage}\n`)
            );
            resolve({
              state: ProofState.Abandoned,
              errorMessage: proofRecord.errorMessage,
            });
            break;
        }
      }
    );

    // Optional: Add a timeout to avoid hanging indefinitely
    setTimeout(() => {
      reject(new Error("Proof result timeout"));
    }, 30000); // Adjust timeout as needed
  });
}

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
