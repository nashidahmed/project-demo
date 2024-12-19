import { DemoAgent } from "../BaseAgent";
import { Output, redText } from "./OutputClass";

export async function printConnectionInvite(agent: DemoAgent, port: number) {
  const outOfBand = await agent.oob.createInvitation();
  const outOfBandId = outOfBand.id;
  const invitationUrl = outOfBand.outOfBandInvitation.toUrl({
    domain: `http://localhost:${port}`,
  });

  console.log(Output.ConnectionLink, invitationUrl, "\n");

  return { invitationUrl, outOfBandId };
}

export async function receiveConnectionRequest(
  agent: DemoAgent,
  invitationUrl: string
) {
  const { connectionRecord } = await agent.oob.receiveInvitationFromUrl(
    invitationUrl
  );
  if (!connectionRecord) {
    throw new Error(redText(Output.NoConnectionRecordFromOutOfBand));
  }
  return connectionRecord;
}

export async function waitForConnection(agent: DemoAgent, outOfBandId: string) {
  if (!outOfBandId) {
    console.log("\nNo connectionRecord ID has been set yet\n");
  }

  const connectionRecord = await getConnectionRecord(agent, outOfBandId!);

  try {
    await agent.connections.returnWhenIsConnected(connectionRecord.id);
    console.log("\nConnection establishedsss!");
    return connectionRecord.id;
  } catch (e) {
    console.log(
      `\nTimeout of 20 seconds reached.. Returning to home screen.\n`
    );
    return;
  }
}

export async function getConnectionRecord(
  agent: DemoAgent,
  outOfBandId: string
) {
  if (!outOfBandId) {
    throw Error(redText(Output.MissingConnectionRecord));
  }

  const [connection] = await agent.connections.findAllByOutOfBandId(
    outOfBandId
  );

  if (!connection) {
    throw Error(redText(Output.MissingConnectionRecord));
  }

  return connection;
}
