# **Decentralized Identity for IoT Devices - Revocation Demo**

This project demonstrates a decentralized identity (DID) solution for IoT devices, with a focus on **revocation mechanisms**. The demo includes two agents:

1. **Laptop Agent**: Simulates an identity issuer or verifier.
2. **Raspberry Pi Agent**: Represents an IoT device receiving and handling credentials.

## **Features**

- **Decentralized Identity**: Demonstrates how credentials are issued, verified, and revoked.
- **Revocation Mechanism**: Focuses on revoking issued credentials to simulate malicious or invalid IoT activity.
- **Two-Agent Setup**: Showcases interactions between the **Laptop Agent** and **Raspberry Pi Agent**.

## **Requirements**

- **Node.js**: Version 20+
- **Yarn**: Installed globally

## **Setup Instructions**

1. **Clone the Repository**

   ```bash
   git clone <your-github-repo-url>
   cd <project-folder>
   ```

2. **Install Dependencies**  
   Run the following command to install all required packages:
   ```bash
   yarn install
   ```

## **Running the Agents**

1. **Laptop Agent**  
    Start the Laptop Agent using:

   ```bash
   yarn laptop
   ```

2. **Raspberry Pi Agent**  
   Start the Raspberry Pi Agent using:
   ```bash
   yarn pi
   ```

## Demo Workflow

1. Start Both Agents:
   - Run the Laptop Agent first.
   - Run the Pi Agent next to simulate communication
2. Credential Issuance:
   - The Laptop Agent issues credentials to the Raspberry Pi Agent.
3. Revocation Simulation:
   - The Laptop Agent can revoke issued credentials.
   - The Pi Agent responds to revoked credentials, simulating device behaviour under revocation.

## Technologies Used

- Node.js
- Yarn
- Credo JS
- Hyperledger Indy
- Hyperledger Aries
