import type {
  CredentialStateChangedEvent,
  ProofStateChangedEvent,
} from "@credo-ts/core";

import {
  CredentialEventTypes,
  CredentialState,
  ProofEventTypes,
  ProofState,
} from "@credo-ts/core";

import { greenText } from "./OutputClass";
import { DemoAgent } from "../BaseAgent";
import {
  acceptCredential,
  acceptCredentialOffer,
  acceptCredentialRequest,
  printCredentialAttributes,
} from "./credentialHelpers";
import { acceptProofRequest } from "./proofHelpers";

export class Listener {
  public constructor() {}

  public credentialOfferListener(agent: DemoAgent) {
    agent.events.on(
      CredentialEventTypes.CredentialStateChanged,
      async ({ payload }: CredentialStateChangedEvent) => {
        console.log(new Date(), payload.credentialRecord.state);

        switch (payload.credentialRecord.state) {
          case CredentialState.OfferReceived:
            printCredentialAttributes(payload.credentialRecord);
            await acceptCredentialOffer(agent, payload.credentialRecord);
            break;
        }
        // if (payload.credentialRecord.state === CredentialState.OfferReceived) {
        //   printCredentialAttributes(payload.credentialRecord);
        //   await acceptCredentialOffer(agent, payload.credentialRecord);
        // } else if (
        //   payload.credentialRecord.state === CredentialState.RequestReceived
        // ) {
        //   await acceptCredentialRequest(agent, payload.credentialRecord);
        // } else if (
        //   payload.credentialRecord.state === CredentialState.CredentialReceived
        // ) {
        //   await acceptCredential(agent, payload.credentialRecord);
        // } else if (payload.credentialRecord.state === CredentialState.Done) {
        //   console.log("Accepted credential");
        // }
      }
    );
  }

  public proofRequestListener(agent: DemoAgent) {
    agent.events.on(
      ProofEventTypes.ProofStateChanged,
      async ({ payload }: ProofStateChangedEvent) => {
        if (payload.proofRecord.state === ProofState.RequestReceived) {
          await acceptProofRequest(agent, payload.proofRecord);
        }
      }
    );
  }

  public proofAcceptedListener(agent: DemoAgent) {
    agent.events.on(
      ProofEventTypes.ProofStateChanged,
      async ({ payload }: ProofStateChangedEvent) => {
        if (payload.proofRecord.state === ProofState.Done) {
          console.log(greenText("\nProof request accepted!\n"));
        }
      }
    );
  }
}
