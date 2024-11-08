const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
} = require("@whiskeysockets/baileys");
const XLSX = require("xlsx");
const fs = require("fs");

// Membaca file excel
const workbook = XLSX.readFile("contacts.xlsx");
const sheetName = workbook.SheetNames[0];
const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

connectToWhatsApp();

// Fungsi untuk membuat koneksi dan mengirim pesan
async function connectToWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(
      "auth_info_baileys"
    );

    // Membuat koneksi ke WhatsApp
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true, // Menampilkan QR Code di terminal
    });

    // Menyimpan state agar tidak perlu scan QR berulang kali
    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "close") {
        const shouldReconnect =
          lastDisconnect.error?.output?.statusCode !==
          DisconnectReason.loggedOut;
        console.log(
          "connection closed due to ",
          lastDisconnect.error,
          ", reconnecting ",
          shouldReconnect
        );
        // mengubungkan ulang
        if (shouldReconnect) {
          connectToWhatsApp();
        } else {
          deleteAuthFolder();
        }
      } else if (connection === "open") {
        console.log("opened connection");

        // mengirim pesan jika koneksi sudah selesai
        sendMessages(sock);
      }
    });
  } catch (error) {
    console.log("Error connecting to WhatsApp: ", error);
  }
}

function deleteAuthFolder() {
  const authFolder = "./auth_info_baileys";

  if (fs.existsSync(authFolder)) {
    fs.rmSync(authFolder, { recursive: true, force: true });
    console.log("Auth folder deleted");
  }

  connectToWhatsApp();
}

function sendMessages(sock) {
  const imagePath = "./info.png"; // Path ke file gambar yang ingin dikirim

  for (const contact of data) {
    setTimeout(async () => {
      const { Nama, Nomor } = contact;
      if (Nama && Nomor) {
        try {
          const numberWithCountryCode = `${Nomor}@s.whatsapp.net`;
          // Baca gambar sebagai buffer
          const imageBuffer = fs.readFileSync(imagePath);

          // Mengirim pesan gambar dengan caption
          await sock.sendMessage(numberWithCountryCode, {
            image: imageBuffer,
            caption: `Halo ${Nama}`,
          });

          console.log(`Pesan terkirim ke ${Nomor}`);
        } catch (error) {
          console.error(`Gagal mengirim pesan ke ${Nomor}:`, error);
        }
      }
    }, 3000); // delay 3 detik untuk menghindari spam
  }
}
