import {
  ConnectionRecord,
  CredentialEventTypes,
  CredentialExchangeRecord,
  CredentialState,
  CredentialStateChangedEvent,
  ProofExchangeRecord,
} from "@credo-ts/core";
import { BaseAgent } from "./BaseAgent";
import express, { Application } from "express";
import {
  Color,
  greenText,
  Output,
  purpleText,
  redText,
} from "./utils/OutputClass";
import cors from "cors";
import { createServer } from "./server";
import {
  credentialOfferListener,
  deleteCredential,
} from "./utils/credentialHelpers";

export class RaspberryPiAgent extends BaseAgent {
  private app: Application;
  public connected: boolean;
  public connectionRecordId?: string;

  constructor(port: number, name: string) {
    super({ port, name });
    this.connected = false;
    this.app = createServer(4000, this.raspberryPiRoutes.bind(this));
  }

  private raspberryPiRoutes(app: Application) {
    // Endpoint to receive the invitation URL
    app.post("/accept-invitation", async (req, res) => {
      const { invitationUrl } = req.body;

      if (!invitationUrl) {
        return res.status(400).send("Invitation URL is required");
      }

      try {
        await this.acceptConnection(invitationUrl);
        if (!this.connected) return;
        credentialOfferListener(this.agent);
        res.status(200).send("Invitation accepted successfully");
      } catch (error) {
        console.error("Error accepting invitation:", error);
        res.status(500).send("Error accepting invitation");
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

    // Endpoint to delete credential
    app.delete("/delete-credential/:credentialId", async (req, res) => {
      console.log("Entered deletion");
      const { credentialId } = req.params;
      if (!credentialId) {
        res.status(400).send("Missing credential ID");
        return;
      }

      try {
        await deleteCredential(this.agent, credentialId);
        res.status(200).send("Credential deleted successfully");
      } catch (error) {
        console.error("Error deleting credential:", error);
        res.status(500).send("Error deleting credential");
      }
    });

    // Endpoint to delete wallet
    app.delete("/delete-wallet", async (req, res) => {
      try {
        await this.deleteWallet();
        res.status(200).send("Deleted Wallet successfully");
      } catch (error) {
        console.error("Error deleting wallet:", error);
        res.status(500).send("Error deleting wallet");
      }
    });
  }

  public async start() {
    await this.initialize();
    console.log("Raspberry Pi agent is now running on port", this.port);
  }

  private async waitForConnection(connectionRecord: ConnectionRecord) {
    connectionRecord = await this.agent.connections.returnWhenIsConnected(
      connectionRecord.id
    );
    this.connected = true;
    console.log(greenText(Output.ConnectionEstablished));
    return connectionRecord.id;
  }

  public async acceptConnection(invitation_url: string) {
    const connectionRecord = await this.receiveConnectionRequest(
      invitation_url
    );
    this.connectionRecordId = await this.waitForConnection(connectionRecord);
  }

  private async receiveConnectionRequest(invitationUrl: string) {
    const { connectionRecord } = await this.agent.oob.receiveInvitationFromUrl(
      invitationUrl
    );
    if (!connectionRecord) {
      throw new Error(redText(Output.NoConnectionRecordFromOutOfBand));
    }
    return connectionRecord;
  }

  public async acceptProofRequest(proofRecord: ProofExchangeRecord) {
    const requestedCredentials =
      await this.agent.proofs.selectCredentialsForRequest({
        proofRecordId: proofRecord.id,
      });

    await this.agent.proofs.acceptRequest({
      proofRecordId: proofRecord.id,
      proofFormats: requestedCredentials.proofFormats,
    });
    console.log(greenText("\nProof request accepted!\n"));
  }
}

// Start the Raspberry Pi agent
const agent = new RaspberryPiAgent(4001, "pi1");
agent.start();
