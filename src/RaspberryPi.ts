import {
  ConnectionRecord,
  CredentialEventTypes,
  CredentialExchangeRecord,
  CredentialState,
  CredentialStateChangedEvent,
} from "@credo-ts/core";
import { BaseAgent } from "./BaseAgent";
import express from "express";
import { Color, greenText, Output, purpleText, redText } from "./OutputClass";
import cors from "cors";

export class RaspberryPiAgent extends BaseAgent {
  public connected: boolean;
  public connectionRecordId?: string;

  constructor(port: number, name: string) {
    super({ port, name });
    this.connected = false;
  }

  public async start() {
    await this.initialize();
    console.log("Raspberry Pi agent is now running on port", this.port);

    // Set up REST API using Express
    const app = express();
    app.use(express.json());
    app.use(cors());

    // Endpoint to receive the invitation URL
    app.post("/accept-invitation", async (req, res) => {
      const { invitationUrl } = req.body;

      if (!invitationUrl) {
        return res.status(400).send("Invitation URL is required");
      }

      try {
        await this.acceptConnection(invitationUrl);
        if (!this.connected) return;
        this.credentialOfferListener();
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
      const { credentialId } = req.params;
      if (!credentialId) {
        res.status(400).send("Missing credential ID");
        return;
      }

      try {
        await this.deleteCredential(credentialId);
        res.status(200).send("Credential deleted successfully");
      } catch (error) {
        console.error("Error deleting credential:", error);
        res.status(500).send("Error deleting credential");
      }
    });

    this.agent.credentials.deleteById;

    app.listen(4000, () => {
      console.log("REST API running on http://localhost:4000");
    });
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

  public async acceptCredentialOffer(
    credentialRecord: CredentialExchangeRecord
  ) {
    await this.agent.credentials.acceptOffer({
      credentialRecordId: credentialRecord.id,
    });
    console.log("Accepted credential with ID:", credentialRecord.id);
  }

  public async deleteCredential(credentialId: string) {
    try {
      await this.agent.credentials.deleteById(credentialId);
      console.log(`Credential with ID ${credentialId} deleted successfully.`);
    } catch (error) {
      console.error("Error deleting credential:", error);
      throw new Error("Credential deletion failed");
    }
  }

  private printCredentialAttributes(
    credentialRecord: CredentialExchangeRecord
  ) {
    if (credentialRecord.credentialAttributes) {
      const attribute = credentialRecord.credentialAttributes;
      console.log("\n\nCredential preview:");
      attribute.forEach((element) => {
        console.log(
          purpleText(`${element.name} ${Color.Reset}${element.value}`)
        );
      });
    }
  }

  public credentialOfferListener() {
    this.agent.events.on(
      CredentialEventTypes.CredentialStateChanged,
      async ({ payload }: CredentialStateChangedEvent) => {
        if (payload.credentialRecord.state === CredentialState.OfferReceived) {
          this.printCredentialAttributes(payload.credentialRecord);
          await this.acceptCredentialOffer(payload.credentialRecord);
        }
      }
    );
  }
}

// Start the Raspberry Pi agent
const agent = new RaspberryPiAgent(7000, "raspberry-pi");
agent.start();
