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

import { acceptProofRequest } from "./proofHelpers";
import {
  printCredentialAttributes,
  acceptCredentialOffer,
} from "./credentialHelpers";

export class Listener {
  public constructor() {}

  public credentialOfferListener(agent: DemoAgent) {
    agent.events.on(
      CredentialEventTypes.CredentialStateChanged,
      async ({ payload }: CredentialStateChangedEvent) => {
        console.log(new Date(), payload.credentialRecord.state);
        if (payload.credentialRecord.state === CredentialState.OfferReceived) {
          printCredentialAttributes(payload.credentialRecord);
          await acceptCredentialOffer(agent, payload.credentialRecord);
        }
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
