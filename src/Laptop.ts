import { AutoAcceptCredential } from "@credo-ts/core";
import { BaseAgent } from "./BaseAgent";
import { Color } from "./utils/OutputClass";
import {
  RegisterCredentialDefinitionReturnStateFinished,
  RegisterRevocationRegistryDefinitionReturnStateFinished,
} from "@credo-ts/anoncreds";
import { Application } from "express";
import { createServer } from "./server";
import { importDid } from "./utils/credentialHelpers";
import { setupAnonCreds } from "./utils/anonCredsSetup";
import { sendInvitationToRaspberryPi } from "./utils/sendInvitation";

export class LaptopAgent extends BaseAgent {
  private app: Application;
  public credentialDefinition?: RegisterCredentialDefinitionReturnStateFinished;
  public revocationRegistry?: RegisterRevocationRegistryDefinitionReturnStateFinished;

  constructor(port: number, name: string) {
    super({ port, name });
    this.app = createServer(5000, this.laptopRoutes.bind(this));
  }

  public async start() {
    await this.initialize();
  }

  public laptopRoutes(app: Application) {
    // Endpoint to setup connection
    app.post("/setup-connection", async (req, res) => {
      try {
        await this.setupConnection();
        res.status(200).send(this.outOfBandId);
      } catch (error) {
        console.error("Error setting up connection:", error);
        res.status(500).send("Error setting up connection");
      }
    });

    // Endpoint to issue credential
    app.post("/issue-credential", async (req, res) => {
      try {
        const issuerId = await importDid(this.agent);
        const credential = await this.issueCredential(issuerId);
        res.status(200).send(credential);
      } catch (error) {
        console.error("Error issuing credential:", error);
        res.status(500).send("Error issuing credential");
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

    // // Endpoint to revoke credential
    // app.post("/revoke-credential", async (req, res) => {
    //   const { credentialRevocationId } = req.body;
    //   if (!credentialRevocationId) {
    //     res.status(400).send("Missing credentialRevocationId");
    //     return;
    //   }

    //   try {
    //     await this.revokeCredential(credentialRevocationId);
    //     res.status(200).send("Credential revoked successfully");
    //   } catch (error) {
    //     console.error("Error revoking credential:", error);
    //     res.status(500).send("Error revoking credential");
    //   }
    // });
  }

  private async setupConnection() {
    const invitationUrl = await this.createConnectionInvitation();
    await sendInvitationToRaspberryPi(invitationUrl);
    // await this.waitForConnection();
  }

  public async issueCredential(issuerId: string) {
    const { credentialDefinition, connectionRecord, revocationRegistry } =
      await setupAnonCreds(this.agent, issuerId, this.outOfBandId!);

    console.log("\nSending credential offer...\n");

    const credentialRecord = await this.agent.credentials.offerCredential({
      connectionId: connectionRecord.id,
      protocolVersion: "v2",
      autoAcceptCredential: AutoAcceptCredential.Always,
      credentialFormats: {
        anoncreds: {
          attributes: [
            {
              name: "deviceId",
              value: "Device12345",
            },
            {
              name: "deviceType",
              value: "Alexa",
            },
            {
              name: "timestamp",
              value: new Date().toISOString(),
            },
          ],
          credentialDefinitionId: credentialDefinition?.credentialDefinitionId,
          revocationRegistryDefinitionId:
            revocationRegistry?.revocationRegistryDefinitionId,
          revocationRegistryIndex: 1,
        },
      },
    });

    console.log(
      `\nCredential offer sent!\n\nGo to the Raspberry Pi agent to accept the credential offer\n\n${Color.Reset}`
    );

    return credentialRecord;
  }

  // public async revokeCredential(credentialRevocationId: string) {
  //   console.log("\nRevoking credential...\n");

  //   try {
  //     await this.agent.modules.anoncreds.updateRevocationStatusList({
  //       revocationStatusList: {
  //         revocationRegistryDefinitionId:
  //           credentialRevocationRegistryDefinitionId,
  //         revokedCredentialIndexes: [Number(credentialRevocationIndex)],
  //       },
  //       options: {},
  //       credentialRevocationId,
  //     });
  //     console.log("\nCredential revoked successfully!");
  //   } catch (error) {
  //     console.error("Error revoking credential:", error);
  //     throw new Error("Revocation failed");
  //   }
  // }
}

// Start the Raspberry Pi agent
export const laptopAgent = new LaptopAgent(5001, "laptop1");
laptopAgent.start();
