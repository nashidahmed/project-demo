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

import { greenText, redText } from "./OutputClass";
import { DemoAgent } from "../BaseAgent";

import { acceptProofRequest } from "./proofHelpers";
import {
  printCredentialAttributes,
  acceptCredentialOffer,
} from "./credentialHelpers";

export class Listener {
  public on: boolean = false;

  public constructor() {}

  public credentialOfferListener(agent: DemoAgent) {
    agent.events.on(
      CredentialEventTypes.CredentialStateChanged,
      async ({ payload }: CredentialStateChangedEvent) => {
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
        switch (payload.proofRecord.state) {
          case ProofState.Abandoned:
            console.log(
              redText(
                `\nProof abandoned! ${payload.proofRecord.errorMessage}\n`
              )
            );
            break;
          case ProofState.Done:
            console.log(greenText("\nProof request done!\n"));
            break;
          case ProofState.RequestReceived:
            await acceptProofRequest(agent, payload.proofRecord);
            break;
        }
      }
    );
  }

  public proofAcceptedListener(agent: DemoAgent) {
    this.on = true;
    agent.events.on(
      ProofEventTypes.ProofStateChanged,
      async ({ payload }: ProofStateChangedEvent) => {
        switch (payload.proofRecord.state) {
          case ProofState.Done:
            console.log(greenText("\nProof request accepted!\n"));
            this.on = false;
            break;
          case ProofState.Abandoned:
            console.log(
              redText(
                `\nProof abandoned! ${payload.proofRecord.errorMessage}\n`
              )
            );
            this.on = false;
            break;
        }
      }
    );
  }
}
