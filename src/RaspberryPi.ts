import type { ConnectionRecord } from "@credo-ts/core";

import { BaseAgent } from "./BaseAgent";
import { greenText, Output } from "./utils/OutputClass";
import { Listener } from "./utils/Listener";
import { Application } from "express";
import { createServer } from "./server";
import { deleteCredential } from "./utils/credential";
import { receiveConnectionRequest } from "./utils/connection";

export class Alice extends BaseAgent {
  private app: Application;
  private listener: Listener;
  public connected: boolean;
  public connectionRecordFaberId?: string;

  public constructor(port: number, name: string) {
    super({ port, name });
    this.connected = false;
    this.app = createServer(4000, this.raspberryPiRoutes.bind(this));
    this.listener = new Listener();
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

        this.listener.credentialOfferListener(this.agent);
        this.listener.proofRequestListener(this.agent);
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

  public static async build(): Promise<Alice> {
    const alice = new Alice(4001, "raspberry-pi");
    await alice.initializeAgent();
    return alice;
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
    const connectionRecord = await receiveConnectionRequest(
      this.agent,
      invitation_url
    );
    this.connectionRecordFaberId = await this.waitForConnection(
      connectionRecord
    );
  }
}

Alice.build();
