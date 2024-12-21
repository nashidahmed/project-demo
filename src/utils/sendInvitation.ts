const piUrl = process.env.RASPBERRYPI_BASE_URL || "localhost";
const piPort = process.env.RASPBERRYPI_PORT || 4000;

export async function sendInvitationToRaspberryPi(invitationUrl: string) {
  try {
    const response = await fetch(
      `http://${piUrl}:${piPort}/accept-invitation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invitationUrl }),
      }
    );

    if (response.ok) {
      console.log("Invitation URL sent to Raspberry Pi successfully");
    } else {
      console.error("Failed to send invitation URL:", response.statusText);
    }
  } catch (error) {
    console.error("Error sending invitation URL:", error);
  }
}
