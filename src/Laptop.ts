import {
  AnonCredsRequestProofFormat,
  dateToTimestamp,
  type AnonCredsCredentialFormatService,
  type AnonCredsRegisterRevocationStatusListOptions,
  type RegisterCredentialDefinitionReturnStateFinished,
  type RegisterRevocationStatusListReturnStateFinished,
} from "@credo-ts/anoncreds";
import type {
  ConnectionRecord,
  ConnectionStateChangedEvent,
  CredentialExchangeRecord,
  OfferCredentialOptions,
  ProofStateChangedEvent,
  V2CredentialProtocol,
} from "@credo-ts/core";
import type {
  IndyVdrRegisterSchemaOptions,
  IndyVdrRegisterCredentialDefinitionOptions,
} from "@credo-ts/indy-vdr";

import {
  ConnectionEventTypes,
  CredoError,
  KeyType,
  ProofEventTypes,
  ProofState,
  TypedArrayEncoder,
  utils,
} from "@credo-ts/core";

import { BaseAgent, indyNetworkConfig } from "./BaseAgent";
import {
  Color,
  Output,
  greenText,
  purpleText,
  redText,
} from "./utils/OutputClass";
import { createServer } from "./server";
import { Application } from "express";
import { Listener } from "./utils/Listener";
import { sendInvitationToRaspberryPi } from "./utils/sendInvitation";

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
        await this.importDid(RegistryOptions.indy);
        console.log("issuing credential");
        const credential = await this.issueCredential();
        res.status(200).send(credential);
      } catch (error) {
        console.error("Error issuing credential:", error);
        res.status(500).send("Error issuing credential");
      }
    });

    // Endpoint to get credentials
    app.post("/send-proof", async (req, res) => {
      try {
        const proof = await this.sendProofRequest();

        // Wait for the event indicating proof state change
        const proofResult = await this.waitForProofResult();

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
        await this.revokeCredential(credential);
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

  public async importDid(registry: string) {
    // NOTE: we assume the did is already registered on the ledger, we just store the private key in the wallet
    // and store the existing did in the wallet
    // indy did is based on private key (seed)
    const unqualifiedIndyDid = "2jEvRuKmfBJTRa7QowDpNN";
    const cheqdDid = "did:cheqd:testnet:d37eba59-513d-42d3-8f9f-d1df0548b675";
    const indyDid = `did:indy:${indyNetworkConfig.indyNamespace}:${unqualifiedIndyDid}`;

    const did = registry === RegistryOptions.indy ? indyDid : cheqdDid;
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
    const invitationUrl = outOfBand.outOfBandInvitation.toUrl({
      domain: `http://localhost:${this.port}`,
    });

    console.log(Output.ConnectionLink, invitationUrl, "\n");

    return invitationUrl;
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
    const invitationUrl = await this.printConnectionInvite();
    await sendInvitationToRaspberryPi(invitationUrl);
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
      name: "Faber College" + utils.uuid(),
      version: "1.0.0",
      attrNames: ["name", "degree", "date"],
      issuerId: this.anonCredsIssuerId,
    };
    this.printSchema(
      schemaTemplate.name,
      schemaTemplate.version,
      schemaTemplate.attrNames
    );
    console.log(greenText("\nRegistering schema...\n", false));

    const { schemaState } =
      await this.agent.modules.anoncreds.registerSchema<IndyVdrRegisterSchemaOptions>(
        {
          schema: schemaTemplate,
          options: {
            endorserMode: "internal",
            endorserDid: this.anonCredsIssuerId,
          },
        }
      );

    if (schemaState.state !== "finished") {
      throw new Error(
        `Error registering schema: ${
          schemaState.state === "failed" ? schemaState.reason : "Not Finished"
        }`
      );
    }
    console.log("\nSchema registered!\n");
    return schemaState;
  }

  private async registerCredentialDefinition(schemaId: string) {
    if (!this.anonCredsIssuerId) {
      throw new Error(redText("Missing anoncreds issuerId"));
    }

    console.log("\nRegistering credential definition...\n");
    const { credentialDefinitionState } =
      await this.agent.modules.anoncreds.registerCredentialDefinition<IndyVdrRegisterCredentialDefinitionOptions>(
        {
          credentialDefinition: {
            schemaId,
            issuerId: this.anonCredsIssuerId,
            tag: "latest",
          },
          options: {
            supportRevocation: this.supportRevocation,
            endorserMode: "internal",
            endorserDid: this.anonCredsIssuerId,
          },
        }
      );

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
    console.log("\nCredential definition registered!!\n");
    return this.credentialDefinition;
  }

  public async registerRevocationRegistry() {
    if (!this.credentialDefinition?.credentialDefinitionId) {
      throw new Error(
        "Missing credential definition ID for revocation registry"
      );
    }

    console.log("\nCreating revocation registry...\n");

    const { revocationRegistryDefinitionState } =
      await this.agent.modules.anoncreds.registerRevocationRegistryDefinition({
        revocationRegistryDefinition: {
          issuerId: this.anonCredsIssuerId!,
          credentialDefinitionId:
            this.credentialDefinition.credentialDefinitionId,
          tag: "latest",
          maximumCredentialNumber: 10, // Maximum number of credentials that can be issued
        },
        options: {},
      });

    if (revocationRegistryDefinitionState.state !== "finished") {
      throw new Error(
        `Error creating revocation registry: ${
          revocationRegistryDefinitionState.state === "failed"
            ? revocationRegistryDefinitionState.reason
            : "Not Finished"
        }`
      );
    }

    console.log("\nRevocation registry created successfully!\n");
    return revocationRegistryDefinitionState;
  }

  public async registerRevocationStatusList(
    revocationStatusList: AnonCredsRegisterRevocationStatusListOptions
  ): Promise<RegisterRevocationStatusListReturnStateFinished> {
    const { revocationStatusListState } =
      await this.agent.modules.anoncreds.registerRevocationStatusList({
        revocationStatusList,
        options: {},
      });

    if (revocationStatusListState.state !== "finished") {
      throw new CredoError(
        `Revocation status list not created: ${
          revocationStatusListState.state === "failed"
            ? revocationStatusListState.reason
            : "Not finished"
        }`
      );
    }

    return revocationStatusListState;
  }

  public async issueCredential() {
    const schema = await this.registerSchema();
    const credentialDefinition = await this.registerCredentialDefinition(
      schema.schemaId
    );
    const connectionRecord = await this.getConnectionRecord();

    let revocationRegistry;
    if (this.supportRevocation) {
      revocationRegistry = await this.registerRevocationRegistry();

      await this.registerRevocationStatusList({
        revocationRegistryDefinitionId:
          revocationRegistry?.revocationRegistryDefinitionId,
        issuerId: this.anonCredsIssuerId!,
      });
    }

    console.log("\nSending credential offer...\n");

    const options: OfferCredentialOptions<
      V2CredentialProtocol<AnonCredsCredentialFormatService[]>[]
    > = {
      connectionId: connectionRecord.id,
      protocolVersion: "v2",
      credentialFormats: {
        anoncreds: {
          attributes: [
            {
              name: "name",
              value: "Alice Smith",
            },
            {
              name: "degree",
              value: "Computer Science",
            },
            {
              name: "date",
              value: "01/01/2022",
            },
          ],
          credentialDefinitionId: credentialDefinition.credentialDefinitionId,
        },
      },
    };

    if (this.supportRevocation && options.credentialFormats.anoncreds) {
      options.credentialFormats.anoncreds.revocationRegistryDefinitionId =
        revocationRegistry?.revocationRegistryDefinitionId;
      options.credentialFormats.anoncreds.revocationRegistryIndex = 1;
    }

    const credential = await this.agent.credentials.offerCredential(options);
    console.log(
      `\nCredential offer sent!\n\nGo to the Alice agent to accept the credential offer\n\n${Color.Reset}`
    );

    return credential;
  }

  private async printProofFlow(print: string) {
    console.log(print);
    await new Promise((f) => setTimeout(f, 2000));
  }

  private async newProofAttribute() {
    await this.printProofFlow(
      greenText(`Creating new proof attribute for 'name' ...\n`)
    );
    const proofAttribute = {
      name: {
        name: "name",
        restrictions: [
          {
            cred_def_id: this.credentialDefinition?.credentialDefinitionId,
          },
        ],
      },
    };

    return proofAttribute;
  }

  public async sendProofRequest() {
    const connectionRecord = await this.getConnectionRecord();
    const proofAttribute = await this.newProofAttribute();
    await this.printProofFlow(greenText("\nRequesting proof...\n", false));

    let requestProofFormat: AnonCredsRequestProofFormat;
    if (this.nrpRequestedTime) {
      requestProofFormat = {
        non_revoked: { from: this.nrpRequestedTime, to: this.nrpRequestedTime },
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

    const proof = await this.agent.proofs.requestProof({
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

  public async sendMessage(message: string) {
    const connectionRecord = await this.getConnectionRecord();
    await this.agent.basicMessages.sendMessage(connectionRecord.id, message);
  }

  public async revokeCredential(credential: {
    _tags: {
      anonCredsCredentialRevocationId: string;
      anonCredsRevocationRegistryId: string;
    };
  }) {
    const credentialRevocationRegistryDefinitionId =
      credential._tags.anonCredsRevocationRegistryId;
    const credentialRevocationIndex =
      credential._tags.anonCredsCredentialRevocationId;

    console.log(credentialRevocationRegistryDefinitionId);
    console.log(credentialRevocationIndex);

    console.log(`\nRevoking Credential...`);

    const { revocationStatusListState } =
      await this.agent.modules.anoncreds.updateRevocationStatusList({
        revocationStatusList: {
          revocationRegistryDefinitionId:
            credentialRevocationRegistryDefinitionId,
          revokedCredentialIndexes: [Number(credentialRevocationIndex)],
        },
        options: {},
      });

    console.log(revocationStatusListState.revocationStatusList);
    const revokedTimestamp =
      revocationStatusListState.revocationStatusList?.timestamp;
    const nrpRequestedTime =
      (revokedTimestamp ?? dateToTimestamp(new Date())) + 1;
    console.log(revokedTimestamp, nrpRequestedTime);
    this.nrpRequestedTime = nrpRequestedTime;

    console.log(`\nRevoked credential!\n`);
  }

  public async exit() {
    console.log(Output.Exit);
    await this.agent.shutdown();
    process.exit(0);
  }

  public async restart() {
    await this.agent.shutdown();
  }

  public waitForProofResult(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.agent.events.on(
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
}

Faber.build();
