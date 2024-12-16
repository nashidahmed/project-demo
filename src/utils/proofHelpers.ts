import { CredentialExchangeRecord, ProofExchangeRecord } from "@credo-ts/core";
import { DemoAgent } from "../BaseAgent";
import { Color, greenText } from "./OutputClass";
import { getConnectionRecord } from "./connectionHelpers";
import {
  AnonCredsCredentialsForProofRequest,
  AnonCredsProofFormat,
  AnonCredsProofFormatService,
  AnonCredsRequestedAttributeMatch,
  AnonCredsRequestedPredicateMatch,
  LegacyIndyProofFormat,
  LegacyIndyProofFormatService,
  RegisterCredentialDefinitionReturnStateFinished,
} from "@credo-ts/anoncreds";
import {
  ProofFormatDataMessagePayload,
  GetCredentialsForRequestReturn,
} from "@credo-ts/core/build/modules/proofs/protocol/ProofProtocolOptions";
import { ProofCredentialAttributes } from "../types/proof-items";

export async function sendProofRequest(
  agent: DemoAgent,
  outOfBandId: string,
  credentialDefinition: RegisterCredentialDefinitionReturnStateFinished
) {
  const connectionRecord = await getConnectionRecord(outOfBandId, agent);
  const proofAttribute = await newProofAttribute(credentialDefinition);
  console.log("---------------------------------------------------");
  console.log(connectionRecord);
  console.log(proofAttribute);
  console.log("---------------------------------------------------");
  await printProofFlow(greenText("\nRequesting proof...\n", false));

  const proofRecord = await agent.proofs.requestProof({
    protocolVersion: "v2",
    connectionId: connectionRecord.id,
    proofFormats: {
      anoncreds: {
        name: "proof-request",
        version: "1.0",
        requested_attributes: proofAttribute,
      },
    },
  });
  console.log(proofRecord);
  console.log(
    `\nProof request sent!\n\nGo to the Raspberry Pi agent to accept the proof request\n\n${Color.Reset}`
  );
  return proofRecord;
}

export const printProofFlow = async (print: string) => {
  console.log(print);
  await new Promise((f) => setTimeout(f, 2000));
};

export const newProofAttribute = async (
  credentialDefinition: RegisterCredentialDefinitionReturnStateFinished
) => {
  await printProofFlow(
    greenText(`Creating new proof attribute for 'name' ...\n`)
  );
  const proofAttribute = {
    name: {
      name: "name",
      restrictions: [
        {
          cred_def_id: credentialDefinition?.credentialDefinitionId,
        },
      ],
    },
  };

  return proofAttribute;
};

export async function acceptProofRequest(
  agent: DemoAgent,
  proofRecord: ProofExchangeRecord
) {
  // const activeCreds = await agent.credentials.getAll();
  // const retrievedCredentials = await retrieveCredentialsForProof(
  //   agent,
  //   proofRecord
  // );
  // let credList: string[] = activeCreds.map((activeCreds) => activeCreds.id);

  // const formatCredentials = (
  //   retrievedItems: Record<
  //     string,
  //     (AnonCredsRequestedAttributeMatch | AnonCredsRequestedPredicateMatch)[]
  //   >,
  //   credList: string[]
  // ) => {
  //   return Object.keys(retrievedItems)
  //     .map((key) => {
  //       return {
  //         [key]: retrievedItems[key].filter((attr) =>
  //           credList.includes(attr.credentialId)
  //         ),
  //       };
  //     })
  //     .reduce((prev, curr) => {
  //       return {
  //         ...prev,
  //         ...curr,
  //       };
  //     }, {});
  // };

  // if (!retrievedCredentials) {
  //   throw new Error("ProofRequest.RequestedCredentialsCouldNotBeFound");
  // }
  // const format = await agent.proofs.getFormatData(proofRecord.id);

  // const formatToUse = format.request?.anoncreds ? "anoncreds" : "indy";

  // console.log("retrievedCredentials", retrievedCredentials);
  // console.log("activeCreds", activeCreds);

  // // this is the best way to supply our desired credentials in the proof, otherwise it selects them automatically
  // const credObject = {
  //   ...retrievedCredentials,
  //   attributes: formatCredentials(
  //     retrievedCredentials.attributes,
  //     activeCreds.map((item) => item.id)
  //   ),
  //   predicates: formatCredentials(
  //     retrievedCredentials.predicates,
  //     activeCreds.map((item) => item.id)
  //   ),
  //   selfAttestedAttributes: {},
  // };
  // const automaticRequestedCreds = {
  //   proofFormats: { [formatToUse]: { ...credObject } },
  // };

  // if (!automaticRequestedCreds) {
  //   throw new Error("ProofRequest.RequestedCredentialsCouldNotBeFound");
  // }

  // console.log("---------------------------------------------------------");
  // console.log(proofRecord.id, automaticRequestedCreds.proofFormats);

  // await agent.proofs.acceptRequest({
  //   proofRecordId: proofRecord.id,
  //   proofFormats: automaticRequestedCreds.proofFormats,
  // });
  console.log(proofRecord);
  const requestedCredentials = await agent.proofs.selectCredentialsForRequest({
    proofRecordId: proofRecord.id,
  });
  console.log(requestedCredentials);

  const proof = await agent.proofs.acceptRequest({
    proofRecordId: proofRecord.id,
    proofFormats: requestedCredentials.proofFormats,
  });
  console.log(proof);

  console.log(greenText("\nProof request accepted!\n"));
}

export const retrieveCredentialsForProof = async (
  agent: DemoAgent,
  proof: ProofExchangeRecord
  // fullCredentials: CredentialExchangeRecord[]
) => {
  try {
    const format = await agent.proofs.getFormatData(proof.id);
    const hasAnonCreds = format.request?.anoncreds !== undefined;
    const hasIndy = format.request?.indy !== undefined;
    const credentials = await agent.proofs.getCredentialsForRequest({
      proofRecordId: proof.id,
      proofFormats: {
        // FIXME: AFJ will try to use the format, even if the value is undefined (but the key is present)
        // We should ignore the key, if the value is undefined. For now this is a workaround.
        ...(hasIndy
          ? {
              indy: {
                // Setting `filterByNonRevocationRequirements` to `false` returns all
                // credentials even if they are revokable (and revoked). We need this to
                // be able to show why a proof cannot be satisfied. Otherwise we can only
                // show failure.
                filterByNonRevocationRequirements: false,
              },
            }
          : {}),

        ...(hasAnonCreds
          ? {
              anoncreds: {
                // Setting `filterByNonRevocationRequirements` to `false` returns all
                // credentials even if they are revokable (and revoked). We need this to
                // be able to show why a proof cannot be satisfied. Otherwise we can only
                // show failure.
                filterByNonRevocationRequirements: false,
              },
            }
          : {}),
      },
    });
    if (!credentials) {
      throw new Error("ProofRequest.RequestedCredentialsCouldNotBeFound");
    }

    if (!format) {
      throw new Error("ProofRequest.RequestedCredentialsCouldNotBeFound");
    }

    if (!(format && credentials)) {
      return;
    }

    const proofFormat =
      credentials.proofFormats.anoncreds ?? credentials.proofFormats.indy;

    // const attributes = processProofAttributes(
    //   format.request,
    //   credentials,
    //   fullCredentials
    // );
    // const predicates = processProofPredicates(
    //   format.request,
    //   credentials,
    //   fullCredentials
    // );

    // const groupedProof = Object.values(
    //   mergeAttributesAndPredicates(attributes, predicates)
    // );

    console.log(proofFormat);

    return proofFormat;
  } catch (err: unknown) {
    console.log(
      "Error.Title1043",
      "Error.Message1043",
      (err as Error)?.message ?? err,
      1043
    );
  }
};

// export const processProofPredicates = (
//   request?: ProofFormatDataMessagePayload<[LegacyIndyProofFormat, AnonCredsProofFormat], 'request'> | undefined,
//   credentials?: GetCredentialsForRequestReturn<[LegacyIndyProofFormatService, AnonCredsProofFormatService]>,
//   credentialRecords?: CredentialExchangeRecord[]
// ): { [key: string]: ProofCredentialPredicates } => {
//   const processedPredicates = {} as { [key: string]: ProofCredentialPredicates }
//   const requestedProofPredicates = request?.anoncreds?.requested_predicates ?? request?.indy?.requested_predicates
//   const retrievedCredentialPredicates =
//     credentials?.proofFormats?.anoncreds?.predicates ?? credentials?.proofFormats?.indy?.predicates

//   if (!requestedProofPredicates || !retrievedCredentialPredicates) {
//     return {}
//   }

//   // non_revoked interval can sometimes be top level
//   const requestNonRevoked = request?.indy?.non_revoked ?? request?.anoncreds?.non_revoked

//   for (const key of Object.keys(retrievedCredentialPredicates)) {
//     const altCredentials = [...(retrievedCredentialPredicates[key] ?? [])]
//       .sort(credentialSortFn)
//       .map((cred) => cred.credentialId)

//     const credentialList = [...(retrievedCredentialPredicates[key] ?? [])].sort(credentialSortFn)
//     const { name, p_type: pType, p_value: pValue, non_revoked } = requestedProofPredicates[key]
//     if (credentialList.length <= 0) {
//       const missingPredicates = addMissingDisplayPredicates(requestedProofPredicates[key])
//       if (!processedPredicates[missingPredicates.credName]) {
//         processedPredicates[missingPredicates.credName] = missingPredicates
//       } else {
//         processedPredicates[missingPredicates.credName].predicates?.push(...(missingPredicates.predicates ?? []))
//       }
//     }

//     for (const credential of credentialList) {
//       let revoked = false
//       let credExchangeRecord = undefined
//       if (credential) {
//         credExchangeRecord = credentialRecords?.find((record) =>
//           record.credentials.map((cred) => cred.credentialRecordId).includes(credential.credentialId)
//         )
//         revoked = credExchangeRecord?.revocationNotification !== undefined
//       } else {
//         continue
//       }
//       const { credentialDefinitionId, schemaId } = { ...credential, ...credential?.credentialInfo }

//       const credNameRestriction = credNameFromRestriction(requestedProofPredicates[key]?.restrictions)

//       let credName = credNameRestriction ?? key
//       if (credential?.credentialInfo?.credentialDefinitionId || credential?.credentialInfo?.schemaId) {
//         credName = parseCredDefFromId(
//           credential?.credentialInfo?.credentialDefinitionId,
//           credential?.credentialInfo?.schemaId
//         )
//       }

//       if (!processedPredicates[credential.credentialId]) {
//         processedPredicates[credential.credentialId] = {
//           altCredentials,
//           credExchangeRecord,
//           credId: credential.credentialId,
//           schemaId,
//           credDefId: credentialDefinitionId,
//           credName: credName,
//           predicates: [],
//         }
//       }

//       processedPredicates[credential.credentialId].predicates?.push(
//         new Predicate({
//           ...requestedProofPredicates[key],
//           credentialId: credential?.credentialId,
//           name,
//           revoked,
//           pValue,
//           pType,
//           nonRevoked: requestNonRevoked ?? non_revoked,
//         })
//       )
//     }
//   }
//   return processedPredicates
// }

// export const mergeAttributesAndPredicates = (
//   attributes: { [key: string]: ProofCredentialAttributes },
//   predicates: { [key: string]: ProofCredentialPredicates }
// ) => {
//   const merged: { [key: string]: ProofCredentialAttributes & ProofCredentialPredicates } = { ...attributes }
//   for (const [key, predicate] of Object.entries(predicates)) {
//     const existingEntry = merged[key]
//     if (existingEntry) {
//       const mergedAltCreds = existingEntry.altCredentials?.filter((credId: string) =>
//         predicate.altCredentials?.includes(credId)
//       )
//       merged[key] = { ...existingEntry, ...predicate }
//       merged[key].altCredentials = mergedAltCreds
//     } else {
//       merged[key] = predicate
//     }
//   }
//   return merged
// }
