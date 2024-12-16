import { utils } from "@credo-ts/core";
import { redText, greenText, purpleText, Color } from "./OutputClass";
import { DemoAgent } from "../BaseAgent";

export async function registerSchema(agent: DemoAgent, issuerId: string) {
  if (!issuerId) {
    throw new Error(redText("Missing anoncreds issuerId"));
  }

  const schemaTemplate = {
    name: "IoTDeviceSchema-" + utils.uuid(),
    version: "1.0.0",
    attrNames: ["name", "deviceType", "timestamp"],
    issuerId,
  };

  printSchema(
    schemaTemplate.name,
    schemaTemplate.version,
    schemaTemplate.attrNames
  );

  console.log(greenText("\nRegistering schema for IoT devices...\n", false));

  const { schemaState } = await agent.modules.anoncreds.registerSchema({
    schema: schemaTemplate,
    options: {},
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

function printSchema(name: string, version: string, attributes: string[]) {
  console.log(`\n\nThe credential definition will look like this:\n`);
  console.log(purpleText(`Name: ${Color.Reset}${name}`));
  console.log(purpleText(`Version: ${Color.Reset}${version}`));
  console.log(
    purpleText(
      `Attributes: ${Color.Reset}${attributes[0]}, ${attributes[1]}, ${attributes[2]}\n`
    )
  );
}
