// --- Sélection des éléments ---
const dropArea = document.querySelector(".drag-area"),
      dragText = dropArea.querySelector("h1"),
      button = dropArea.querySelector("button"),
      input = dropArea.querySelector("input"),
      downloadBtn = document.getElementById("downloadBtn");

let file; // fichier déposé
let pyodideInstance = null; // instance Pyodide

// --- Initialisation Pyodide ---
async function initializePyodide() {
    dropArea.classList.add("active");
    dragText.textContent = "Chargement du moteur de décryptage...";

    try {
        pyodideInstance = await loadPyodide();
        await pyodideInstance.loadPackage(["pycryptodome"]);
        dragText.textContent = "Python prêt";

        // --- Python : AES-CBC avec PyCryptodome ---
        await pyodideInstance.runPythonAsync(`
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad

KEY = b"Embauchez moi !!"  # 16 bytes
IV  = b"Je crypte mon CV"  # 16 bytes

def aes_encrypt(file_bytes):
    file_bytes = bytes(file_bytes)  #conversion JsProxy → bytes
    cipher = AES.new(KEY, AES.MODE_CBC, IV)
    padded = pad(file_bytes, AES.block_size)
    return cipher.encrypt(padded)

def aes_decrypt(file_bytes):
    file_bytes = bytes(file_bytes)  #conversion JsProxy → bytes
    cipher = AES.new(KEY, AES.MODE_CBC, IV)
    decrypted = cipher.decrypt(file_bytes)
    return unpad(decrypted, AES.block_size)
        `);

        console.log("Pyodide prêt pour AES-CBC PDF.");
        dropArea.classList.remove("active");
        dragText.textContent = "Déposez le CV chiffré ici";

    } catch (e) {
        console.error("Erreur Pyodide:", e);
        dragText.textContent = "Erreur: Pyodide non chargé.";
    }
}

// Initialiser Pyodide
initializePyodide();

// --- Drag & Drop et sélection fichier ---
button.onclick = () => input.click();

input.addEventListener("change", function () {
    file = this.files[0];
    dropArea.classList.add("active");
    showFile();
});

dropArea.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropArea.classList.add("active");
    dragText.textContent = "Relâchez pour lancer le traitement";
});

dropArea.addEventListener("dragleave", () => {
    dropArea.classList.remove("active");
    dragText.textContent = "Glissez-déposez le fichier à traiter";
});

dropArea.addEventListener("drop", (event) => {
    event.preventDefault();
    file = event.dataTransfer.files[0];
    showFile();
});

// --- Affichage du fichier ---
function showFile() {
    if (!file) {
        alert("Veuillez sélectionner un fichier.");
        dropArea.classList.remove("active");
        dragText.textContent = "Glissez-déposez le fichier à traiter";
        downloadBtn.style.display = "none";
        return;
    }

    dropArea.innerHTML = `
        <div style="text-align:center; padding:20px;">
            <i class="fas fa-file-alt" style="font-size:70px; color:#fff; display:block; margin:0 auto;"></i>
            <p style="margin-top:10px; color:#fff;">${file.name}</p>
        </div>
    `;
    downloadBtn.style.display = "inline-block";
    downloadBtn.textContent = "Déchiffrer et Télécharger le CV";
}

// --- Chiffrement/Décryptage et téléchargement ---
downloadBtn.onclick = async () => {
    if (!file || !pyodideInstance) {
        alert("Pyodide n'est pas prêt ou aucun fichier n'a été déposé.");
        return;
    }

    downloadBtn.textContent = "Traitement en cours...";
    downloadBtn.disabled = true;

    try {
        const fileArrayBuffer = await file.arrayBuffer();
        const fileUint8Array = new Uint8Array(fileArrayBuffer);

        // --- Détecter si fichier déjà chiffré (simple heuristique : PDF signature) ---
        const isPdf = fileUint8Array.slice(0, 4).join() === [37,80,68,70].join(); // %PDF
        let processedBytes;

        if (isPdf) {
            // Chiffrer le PDF
            processedBytes = pyodideInstance.globals.get('aes_encrypt')(fileUint8Array);
        } else {
            // Déchiffrer le PDF
            processedBytes = pyodideInstance.globals.get('aes_decrypt')(fileUint8Array);
        }

        const processedUint8Array = processedBytes.toJs({ arrayType: Uint8Array });

        const blob = new Blob([processedUint8Array], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        const originalFileName = file.name.replace(/\.[^/.]+$/, "");
        a.download = `${isPdf ? "encrypted" : "decrypted"}_${originalFileName}.pdf`;
        a.href = url;

        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        //alert(`Fichier '${a.download}' traité avec succès !`);

    } catch (error) {
        console.error("Erreur lors du traitement:", error);
        alert(`Échec du traitement: ${error.message}`);
    } finally {
        downloadBtn.textContent = "Chiffrer/Déchiffrer et Télécharger";
        downloadBtn.disabled = false;
    }
};
