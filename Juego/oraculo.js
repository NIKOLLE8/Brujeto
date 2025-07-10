const recordBtn = document.querySelector(".action-button");
const resultado = document.getElementById("evidenceText");
const genderElement = document.querySelector(".gender");
const startView = document.getElementById("startView");
const resultView = document.getElementById("resultView");
const imageDerecha = document.querySelector("#startView img");
const imageIzquierda = document.querySelector(".mystical-image");
let isRecording = false;
let mediaRecorder = null;
let recognition = null;
let transcript = "";
let stream = null;

// Runas flotantes
const runes = [
  "ᚠ",
  "ᚢ",
  "ᚦ",
  "ᚨ",
  "ᚱ",
  "ᚲ",
  "ᚷ",
  "ᚹ",
  "ᚺ",
  "ᚾ",
  "ᛁ",
  "ᛃ",
  "ᛇ",
  "ᛈ",
  "ᛉ",
  "ᛊ",
  "ᛏ",
  "ᛒ",
  "ᛖ",
  "ᛗ",
  "ᛚ",
  "ᛜ",
  "ᛟ",
  "ᛞ",
];

function spawnRune() {
  const rune = document.createElement("div");
  rune.className = "rune";
  rune.textContent = runes[Math.floor(Math.random() * runes.length)];
  rune.style.left = `${Math.random() * 100}%`;
  rune.style.top = `${Math.random() * 100}%`;
  rune.style.fontSize = `${Math.random() * 2 + 1}rem`;
  rune.style.animationDuration = `${10 + Math.random() * 10}s`;
  rune.style.animationName = "floatRune";
  document.body.appendChild(rune);
  setTimeout(() => rune.remove(), 20000);
}

setInterval(spawnRune, 200);

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function detectPitch(blob) {
  const audioContext = new AudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  let bestOffset = -1;
  let bestCorrelation = 0;
  
  // Buscar en un rango más amplio para mejor detección
  for (let offset = 50; offset < 800; offset++) {
    let correlation = 0;
    for (let i = 0; i < channelData.length - offset; i++) {
      correlation += Math.abs(channelData[i] * channelData[i + offset]);
    }
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }
  
  const f0 = sampleRate / bestOffset;
  console.log("F0 estimado:", f0.toFixed(2), "Hz");
  
  // Rangos más precisos para detección de género
  // Hombres: típicamente 85-180 Hz
  // Mujeres: típicamente 165-265 Hz
  return f0 < 160 ? "Hombre" : "Mujer";
}

async function startRecording() {
  if (!isRecording) {
    isRecording = true;
    recordBtn.disabled = true;
    // Mostrar texto encima del botón
    let countdownText = document.getElementById("countdownText");
    if (!countdownText) {
      countdownText = document.createElement("div");
      countdownText.id = "countdownText";
      countdownText.style.textAlign = "center";
      countdownText.style.fontSize = "20px";
      countdownText.style.marginBottom = "12px";
      recordBtn.parentNode.insertBefore(countdownText, recordBtn);
    }

    // Iniciar temblor desde el principio
    const shakeInterval = setInterval(() => {
      imageDerecha.classList.add("shake");
      setTimeout(() => imageDerecha.classList.remove("shake"), 500);
    }, 600);

    countdownText.textContent = "Grabando en 1...";
    await delay(1000);
    countdownText.textContent = "Grabando en 2...";
    await delay(1000);
    countdownText.textContent = "Grabando en 3...";
    await delay(1000);
    countdownText.textContent = "Grabando...";
    recordBtn.textContent = "Detener";
    recordBtn.disabled = false;

    // Reconocimiento de voz
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    transcript = "";
    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.lang = "es-ES";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        transcript = event.results[0][0].transcript;
        console.log("🗣 Texto reconocido:", transcript);
      };
      recognition.start();
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        clearInterval(shakeInterval);
        imageDerecha.classList.remove("shake");
        const blob = new Blob(audioChunks, { type: "audio/webm" });
        
        // Esperamos a que el reconocimiento termine
        if (recognition) {
          recognition.onend = async () => {
            const gender = await detectPitch(blob);
            genderElement.textContent = gender;
            imageIzquierda.classList.add("glow-image");
            startView.style.display = "none";
            resultView.style.display = "block";

            // ✅ Mostramos la transcripción
            resultado.textContent = transcript
              ? `${transcript}`
              : "Los astros no detectaron palabras claras...";

            recordBtn.textContent = "Grabar";
            isRecording = false;
            stream.getTracks().forEach((track) => track.stop());
            
            // ARREGLO 2: Síntesis de voz que lee todo el resultado
            const synth = window.speechSynthesis;
            if (synth) {
              const textoCompleto = `Mis plegarias me han dicho que eres ${gender}. La evidencia es: ${transcript || "Los astros no detectaron palabras claras"}`;
              const utter = new SpeechSynthesisUtterance(textoCompleto);
              const voices = synth.getVoices();
              
              if (gender === "Hombre") {
                const pablo = voices.find((v) => v.name.includes("Pablo"));
                if (pablo) utter.voice = pablo;
              } else {
                const laura = voices.find((v) => v.name.includes("Laura"));
                if (laura) utter.voice = laura;
              }
              
              utter.rate = 0.8;
              utter.pitch = 1.0;
              synth.speak(utter);
            }

            countdownText.remove();
          };
        } else {
          // Fallback si no hay reconocimiento de voz
          const gender = await detectPitch(blob);
          genderElement.textContent = gender;
          imageIzquierda.classList.add("glow-image");
          startView.style.display = "none";
          resultView.style.display = "block";
          resultado.textContent = "Los astros no detectaron palabras claras...";
          recordBtn.textContent = "Grabar";
          isRecording = false;
          stream.getTracks().forEach((track) => track.stop());
          countdownText.remove();
        }
      };

      mediaRecorder.start();
    } catch (error) {
      console.error("Error al acceder al micrófono:", error);
      alert("No se pudo acceder al micrófono.");
      recordBtn.disabled = false;
      recordBtn.textContent = "Grabar";
      isRecording = false;
      document.getElementById("countdownText")?.remove();
    }
  } else {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }
    if (recognition) {
      try {
        recognition.stop();
      } catch (_) {}
    }
    recordBtn.disabled = true;
  }
}

function volverAIntentar() {
  resultView.style.display = "none";
  startView.style.display = "flex";
  imageIzquierda.classList.remove("glow-image");
  recordBtn.disabled = false;
  recordBtn.textContent = "Grabar";
}

recordBtn.onclick = startRecording;