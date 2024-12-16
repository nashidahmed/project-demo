import { CredentialExchangeRecord } from "@credo-ts/core";
// import { Attribute } from '@hyperledger/aries-oca/build/legacy'

export interface ProofCredentialAttributes {
  altCredentials?: string[];
  credExchangeRecord?: CredentialExchangeRecord;
  credId: string;
  credDefId?: string;
  schemaId?: string;
  credName: string;
  // attributes?: Attribute[]
}
