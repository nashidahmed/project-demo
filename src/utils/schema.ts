import { utils } from "@credo-ts/core";
import { IndyVdrRegisterSchemaOptions } from "@credo-ts/indy-vdr";
import { DemoAgent } from "../BaseAgent";
import { Color, greenText, purpleText, redText } from "./OutputClass";

export async function printSchema(
  name: string,
  version: string,
  attributes: string[]
) {
  console.log(`\n\nThe credential definition will look like this:\n`);
  console.log(purpleText(`Name: ${Color.Reset}${name}`));
  console.log(purpleText(`Version: ${Color.Reset}${version}`));
  console.log(
    purpleText(
      `Attributes: ${Color.Reset}${attributes[0]}, ${attributes[1]}, ${attributes[2]}\n`
    )
  );
}

export async function registerSchema(agent: DemoAgent, issuerId: string) {
  if (!issuerId) {
    throw new Error(redText("Missing anoncreds issuerId"));
  }

  const schemaTemplate = {
    name: "Faber College" + utils.uuid(),
    version: "1.0.0",
    attrNames: ["name", "type", "date"],
    issuerId,
  };

  printSchema(
    schemaTemplate.name,
    schemaTemplate.version,
    schemaTemplate.attrNames
  );

  console.log(greenText("\nRegistering schema...\n", false));

  const { schemaState } =
    await agent.modules.anoncreds.registerSchema<IndyVdrRegisterSchemaOptions>({
      schema: schemaTemplate,
      options: {
        endorserMode: "internal",
        endorserDid: issuerId,
      },
    });

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
