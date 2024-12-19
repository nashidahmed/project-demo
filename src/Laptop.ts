import { type RegisterCredentialDefinitionReturnStateFinished } from "@credo-ts/anoncreds";
import type {
  ConnectionRecord,
  ConnectionStateChangedEvent,
} from "@credo-ts/core";

import { ConnectionEventTypes, ProofState } from "@credo-ts/core";

import { BaseAgent } from "./BaseAgent";
import { Output, greenText, redText } from "./utils/OutputClass";
import { createServer } from "./server";
import { Application } from "express";
import { Listener } from "./utils/Listener";
import { sendInvitationToRaspberryPi } from "./utils/sendInvitation";
import {
  importDid,
  issueCredential,
  revokeCredential,
} from "./utils/credential";
import { printConnectionInvite } from "./utils/connection";
import { sendProofRequest, waitForProofResult } from "./utils/proof";

export enum RegistryOptions {
  indy = "did:indy",
  cheqd = "did:cheqd",
}

export class Faber extends BaseAgent {
  private app: Application;
  public outOfBandId?: string;
  public credentialDefinition?: RegisterCredentialDefinitionReturnStateFinished;
  public anonCredsIssuerId?: string;
  public listener: Listener;
  public supportRevocation: boolean = true;
  public nrpRequestedTime: number = 0;

  public constructor(port: number, name: string) {
    super({ port, name });
    this.app = createServer(5000, this.laptopRoutes.bind(this));
    this.listener = new Listener();
  }

  public laptopRoutes(app: Application) {
    // Endpoint to setup connection
    app.post("/setup-connection", async (req, res) => {
      try {
        await this.setupConnection();

        this.listener.credentialOfferListener(this.agent);
        res.status(200).send(this.outOfBandId);
      } catch (error) {
        console.error("Error setting up connection:", error);
        res.status(500).send("Error setting up connection");
      }
    });

    // Endpoint to issue credential
    app.post("/issue-credential", async (req, res) => {
      try {
        console.log("importing did");
        this.anonCredsIssuerId = await importDid(
          this.agent,
          RegistryOptions.indy
        );
        console.log("issuing credential");
        const { credential, credentialDefinition } = await issueCredential(
          this.agent,
          this.anonCredsIssuerId!,
          this.supportRevocation,
          this.outOfBandId!
        );
        this.credentialDefinition = credentialDefinition;
        res.status(200).send(credential);
      } catch (error) {
        console.error("Error issuing credential:", error);
        res.status(500).send("Error issuing credential");
      }
    });

    // Endpoint to get credentials
    app.post("/send-proof", async (req, res) => {
      try {
        const proof = await sendProofRequest(
          this.agent,
          this.outOfBandId!,
          this.credentialDefinition?.credentialDefinitionId!,
          this.nrpRequestedTime
        );

        // Wait for the event indicating proof state change
        const proofResult = await waitForProofResult(this.agent);

        if (proofResult.state === ProofState.Done) {
          res.status(200).send({
            message: "Proof request accepted",
            proof: proofResult,
          });
        } else if (proofResult.state === ProofState.Abandoned) {
          res.status(400).send({
            message: "Proof request abandoned",
            error: proofResult.errorMessage,
          });
        }
      } catch (error) {
        console.error("Error sending proof request:", error);
        res.status(500).send("Error sending proof request");
      }
    });

    // Endpoint to get credentials
    app.get("/get-credentials", async (req, res) => {
      try {
        const credentials = await this.agent.credentials.getAll();
        res.status(200).send(credentials);
      } catch (error) {
        console.error("Error getting credentials:", error);
        res.status(500).send("Error getting credentials");
      }
    });

    // Endpoint to get credentials
    app.delete("/delete-wallet", async (req, res) => {
      try {
        await this.deleteWallet();
        res.status(200).send("Deleted Wallet successfully");
      } catch (error) {
        console.error("Error deleting wallet:", error);
        res.status(500).send("Error deleting wallet");
      }
    });

    // Endpoint to revoke credential
    app.post("/revoke-credential", async (req, res) => {
      const credential: {
        _tags: {
          anonCredsCredentialRevocationId: string;
          anonCredsRevocationRegistryId: string;
        };
      } = req.body;
      console.log(credential);

      try {
        this.nrpRequestedTime = await revokeCredential(this.agent, credential);
        res.status(200).send("Credential revoked successfully");
      } catch (error) {
        console.error("Error revoking credential:", error);
        res.status(500).send("Error revoking credential");
      }
    });
  }

  public static async build(): Promise<Faber> {
    const faber = new Faber(5001, "laptop-agent");
    await faber.initializeAgent();
    return faber;
  }

  private async waitForConnection() {
    if (!this.outOfBandId) {
      throw new Error(redText(Output.MissingConnectionRecord));
    }

    console.log("Waiting for Alice to finish connection...");

    const getConnectionRecord = (outOfBandId: string) =>
      new Promise<ConnectionRecord>((resolve, reject) => {
        // Timeout of 20 seconds
        const timeoutId = setTimeout(
          () => reject(new Error(redText(Output.MissingConnectionRecord))),
          20000
        );

        // Start listener
        this.agent.events.on<ConnectionStateChangedEvent>(
          ConnectionEventTypes.ConnectionStateChanged,
          (e) => {
            if (e.payload.connectionRecord.outOfBandId !== outOfBandId) return;

            clearTimeout(timeoutId);
            resolve(e.payload.connectionRecord);
          }
        );

        // Also retrieve the connection record by invitation if the event has already fired
        void this.agent.connections
          .findAllByOutOfBandId(outOfBandId)
          .then(([connectionRecord]) => {
            if (connectionRecord) {
              clearTimeout(timeoutId);
              resolve(connectionRecord);
            }
          });
      });

    const connectionRecord = await getConnectionRecord(this.outOfBandId);

    try {
      await this.agent.connections.returnWhenIsConnected(connectionRecord.id);
    } catch (e) {
      console.log(
        redText(`\nTimeout of 20 seconds reached.. Returning to home screen.\n`)
      );
      return;
    }
    console.log(greenText(Output.ConnectionEstablished));
  }

  public async setupConnection() {
    const { invitationUrl, outOfBandId } = await printConnectionInvite(
      this.agent,
      this.port
    );
    this.outOfBandId = outOfBandId;
    await sendInvitationToRaspberryPi(invitationUrl);
    await this.waitForConnection();
  }
}

Faber.build();
