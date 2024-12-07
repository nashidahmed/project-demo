import {
  ConnectionRecord,
  ConnectionStateChangedEvent,
  ConnectionEventTypes,
  utils,
  KeyType,
  TypedArrayEncoder,
  AutoAcceptCredential,
} from "@credo-ts/core";
import { BaseAgent, indyNetworkConfig } from "./BaseAgent";
import { purpleText, Color, redText, greenText, Output } from "./OutputClass";
import {
  RegisterCredentialDefinitionReturnStateFinished,
  RegisterRevocationRegistryDefinitionReturnStateFinished,
} from "@credo-ts/anoncreds";
import express from "express";
import cors from "cors";

export class LaptopAgent extends BaseAgent {
  public anonCredsIssuerId?: string;
  public credentialDefinition?: RegisterCredentialDefinitionReturnStateFinished;
  public revocationRegistry?: RegisterRevocationRegistryDefinitionReturnStateFinished;

  constructor(port: number, name: string) {
    super({ port, name });
  }

  public async start() {
    await this.initialize();
    this.startExpressServer();
  }

  private startExpressServer() {
    const app = express();
    app.use(express.json());
    app.use(cors());

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
        await this.importDid();
        await this.issueCredential();
        res.status(200).send("Issued credential successfully");
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

    app.listen(5000, () => {
      console.log("LaptopAgent API is running on http://localhost:5000");
    });
  }

  public async importDid() {
    // NOTE: we assume the did is already registered on the ledger, we just store the private key in the wallet
    // and store the existing did in the wallet
    // indy did is based on private key (seed)
    const unqualifiedIndyDid = "2jEvRuKmfBJTRa7QowDpNN";
    const did = `did:indy:${indyNetworkConfig.indyNamespace}:${unqualifiedIndyDid}`;

    await this.agent.dids.import({
      did,
      overwrite: true,
      privateKeys: [
        {
          keyType: KeyType.Ed25519,
          privateKey: TypedArrayEncoder.fromString(
            "afjdemoverysercure00000000000000"
          ),
        },
      ],
    });
    this.anonCredsIssuerId = did;
  }

  private async getConnectionRecord() {
    if (!this.outOfBandId) {
      throw Error(redText(Output.MissingConnectionRecord));
    }

    const [connection] = await this.agent.connections.findAllByOutOfBandId(
      this.outOfBandId
    );

    if (!connection) {
      throw Error(redText(Output.MissingConnectionRecord));
    }

    return connection;
  }

  private async printConnectionInvite() {
    const outOfBand = await this.agent.oob.createInvitation();
    this.outOfBandId = outOfBand.id;

    console.log(
      Output.ConnectionLink,
      outOfBand.outOfBandInvitation.toUrl({
        domain: `http://localhost:${this.port}`,
      }),
      "\n"
    );
  }

  private async waitForConnection() {
    if (!this.outOfBandId) {
      console.log("\nNo connectionRecord ID has been set yet\n");
    }

    const getConnectionRecord = (outOfBandId: string) =>
      new Promise<ConnectionRecord>((resolve) => {
        // Timeout of 20 seconds
        const timeoutId = setTimeout(
          () => console.log("Timeout occured"),
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

    const connectionRecord = await getConnectionRecord(
      this.outOfBandId as string
    );

    try {
      await this.agent.connections.returnWhenIsConnected(connectionRecord.id);
      console.log("\nConnection established!");
      return connectionRecord.id;
    } catch (e) {
      console.log(
        `\nTimeout of 20 seconds reached.. Returning to home screen.\n`
      );
      return;
    }
  }

  public async setupConnection() {
    const invitationUrl = await this.createConnectionInvitation();
    await this.sendInvitationToRaspberryPi(invitationUrl);
    await this.waitForConnection();
  }

  private printSchema(name: string, version: string, attributes: string[]) {
    console.log(`\n\nThe credential definition will look like this:\n`);
    console.log(purpleText(`Name: ${Color.Reset}${name}`));
    console.log(purpleText(`Version: ${Color.Reset}${version}`));
    console.log(
      purpleText(
        `Attributes: ${Color.Reset}${attributes[0]}, ${attributes[1]}, ${attributes[2]}\n`
      )
    );
  }

  private async registerSchema() {
    if (!this.anonCredsIssuerId) {
      throw new Error(redText("Missing anoncreds issuerId"));
    }

    const schemaTemplate = {
      name: "IoTDeviceSchema-" + utils.uuid(),
      version: "1.0.0",
      attrNames: ["deviceId", "deviceType", "timestamp"],
      issuerId: this.anonCredsIssuerId,
    };

    this.printSchema(
      schemaTemplate.name,
      schemaTemplate.version,
      schemaTemplate.attrNames
    );

    console.log(greenText("\nRegistering schema for IoT devices...\n", false));

    const { schemaState } = await this.agent.modules.anoncreds.registerSchema({
      schema: schemaTemplate,
      options: {
        supportRevocation: true,
        endorserMode: "internal",
        endorserDid: this.anonCredsIssuerId,
      },
    });

    if (schemaState.state !== "finished") {
      throw new Error(
        `Error registering schema: ${
          schemaState.state === "failed" ? schemaState.reason : "Not Finished"
        }`
      );
    }

    console.log("\nIoT Device Schema registered successfully!\n");
    return schemaState;
  }

  private async registerCredentialDefinition(schemaId: string) {
    if (!this.anonCredsIssuerId) {
      throw new Error(redText("Missing anoncreds issuerId"));
    }

    console.log("\nRegistering credential definition...\n");
    const { credentialDefinitionState } =
      await this.agent.modules.anoncreds.registerCredentialDefinition({
        credentialDefinition: {
          schemaId,
          issuerId: this.anonCredsIssuerId,
          tag: "latest",
        },
        options: {
          supportRevocation: true,
        },
      });

    if (credentialDefinitionState.state !== "finished") {
      throw new Error(
        `Error registering credential definition: ${
          credentialDefinitionState.state === "failed"
            ? credentialDefinitionState.reason
            : "Not Finished"
        }}`
      );
    }

    this.credentialDefinition = credentialDefinitionState;
    console.log(
      "\nCredential definition with revocation support registered!!\n"
    );
    // Create the revocation registry after credential definition is created
    // await this.createRevocationRegistry(
    //   credentialDefinitionState.credentialDefinitionId
    // );

    return this.credentialDefinition;
  }

  // private async createRevocationRegistry(credentialDefinitionId: string) {
  //   if (!credentialDefinitionId) {
  //     throw new Error(
  //       "Missing credential definition ID for revocation registry"
  //     );
  //   }

  //   console.log("\nCreating revocation registry...\n");

  //   const { revocationRegistryDefinitionState } =
  //     await this.agent.modules.anoncreds.registerRevocationRegistryDefinition({
  //       revocationRegistryDefinition: {
  //         credentialDefinitionId,
  //         issuerId: this.anonCredsIssuerId!,
  //         tag: "latest",
  //         maximumCredentialNumber: 100, // Maximum number of credentials that can be issued
  //       },
  //       options: {},
  //     });

  //   if (revocationRegistryDefinitionState.state !== "finished") {
  //     throw new Error(
  //       `Error creating revocation registry: ${
  //         revocationRegistryDefinitionState.state === "failed"
  //           ? revocationRegistryDefinitionState.reason
  //           : "Not Finished"
  //       }`
  //     );
  //   }

  //   this.revocationRegistry = revocationRegistryDefinitionState;
  //   console.log("\nRevocation registry created successfully!\n");
  // }

  public async issueCredential() {
    const schema = await this.registerSchema();
    const credentialDefinition = await this.registerCredentialDefinition(
      schema.schemaId
    );
    const connectionRecord = await this.getConnectionRecord();

    console.log(connectionRecord);
    // console.log(credentialDefinition)

    console.log("\nSending credential offer...\n");

    await this.agent.credentials.offerCredential({
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
            this.revocationRegistry?.revocationRegistryDefinitionId,
          revocationRegistryIndex: 1,
        },
      },
    });

    console.log(
      `\nCredential offer sent!\n\nGo to the Raspberry Pi agent to accept the credential offer\n\n${Color.Reset}`
    );
  }

  private async sendInvitationToRaspberryPi(invitationUrl: string) {
    try {
      const response = await fetch("http://localhost:4000/accept-invitation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invitationUrl }),
      });

      if (response.ok) {
        console.log("Invitation URL sent to Raspberry Pi successfully");
      } else {
        console.error("Failed to send invitation URL:", response.statusText);
      }
    } catch (error) {
      console.error("Error sending invitation URL:", error);
    }
  }

  // public async revokeCredential(credentialRevocationId: string) {
  //   console.log("\nRevoking credential...\n");

  //   try {
  //     await this.agent.modules.anoncreds.revoc.revokeCredential({
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
const agent = new LaptopAgent(3001, "laptop");
agent.start();
