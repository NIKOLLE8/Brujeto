const botonGrabar = document.querySelector(".action-button");
const textoEvidencia = document.getElementById("evidenceText");
const elementoGenero = document.querySelector(".gender");
const vistaInicial = document.getElementById("startView");
const vistaResultado = document.getElementById("resultView");
const imagenDerecha = document.querySelector("#startView img");
const imagenIzquierda = document.querySelector(".mystical-image");
let estaGrabando = false;
let grabadorMedia = null;
let reconocimiento = null;
let transcripcion = "";
let flujoAudio = null;
let intervaloTemblor = null;

// Runas flotantes
const runas = [
  "ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚲ", "ᚷ", "ᚹ", "ᚺ", "ᚾ", 
  "ᛁ", "ᛃ", "ᛇ", "ᛈ", "ᛉ", "ᛊ", "ᛏ", "ᛒ", "ᛖ", "ᛗ", 
  "ᛚ", "ᛜ", "ᛟ", "ᛞ",
];

function generarRuna() {
  const runa = document.createElement("div");
  runa.className = "rune";
  runa.textContent = runas[Math.floor(Math.random() * runas.length)];
  runa.style.left = `${Math.random() * 100}%`;
  runa.style.top = `${Math.random() * 100}%`;
  runa.style.fontSize = `${Math.random() * 2 + 1}rem`;
  runa.style.animationDuration = `${10 + Math.random() * 10}s`;
  runa.style.animationName = "floatRune";
  document.body.appendChild(runa);
  setTimeout(() => runa.remove(), 20000);
}

setInterval(generarRuna, 200);

function esperar(milisegundos) {
  return new Promise((resolver) => setTimeout(resolver, milisegundos));
}

async function detectarTono(blobAudio) {
  const contextoAudio = new AudioContext();
  const bufferArray = await blobAudio.arrayBuffer();
  const bufferAudio = await contextoAudio.decodeAudioData(bufferArray);
  const datosCanal = bufferAudio.getChannelData(0);
  const frecuenciaMuestreo = bufferAudio.sampleRate;
  let mejorOffset = -1;
  let mejorCorrelacion = 0;
  
  for (let offset = 50; offset < 800; offset++) {
    let correlacion = 0;
    for (let i = 0; i < datosCanal.length - offset; i++) {
      correlacion += Math.abs(datosCanal[i] * datosCanal[i + offset]);
    }
    if (correlacion > mejorCorrelacion) {
      mejorCorrelacion = correlacion;
      mejorOffset = offset;
    }
  }
  
  const frecuenciaFundamental = frecuenciaMuestreo / mejorOffset;
  console.log("F0 estimado:", frecuenciaFundamental.toFixed(2), "Hz");
  return frecuenciaFundamental < 160 ? "Hombre" : "Mujer";
}

// FUNCIÓN: Reconocimiento mejorado SIN límite de tiempo automático
async function reconocerVozMejorado() {
  return new Promise((resolver, rechazar) => {
    const ReconocimientoVoz = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!ReconocimientoVoz) {
      resolver("API de reconocimiento no disponible");
      return;
    }

    reconocimiento = new ReconocimientoVoz();
    
    // CONFIGURACIÓN MEJORADA PARA MAYOR PRECISIÓN
    reconocimiento.lang = "es-ES";
    reconocimiento.continuous = true;           // Grabación continua
    reconocimiento.interimResults = true;       // Resultados intermedios
    reconocimiento.maxAlternatives = 5;         // Múltiples alternativas
    reconocimiento.serviceURI = "";             // Usar servicio por defecto de Google
    
    let transcripcionFinal = "";
    let transcripcionTemporal = "";

    reconocimiento.onstart = () => {
      console.log("🎤 Reconocimiento iniciado con configuración mejorada");
      // ARREGLO 1: NO hay límite de tiempo automático, solo se detiene manualmente
    };

    reconocimiento.onresult = (evento) => {
      transcripcionTemporal = "";
      
      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const resultado = evento.results[i];
        
        if (resultado.isFinal) {
          // Texto final confirmado
          transcripcionFinal += resultado[0].transcript + " ";
          console.log("✅ Texto final:", resultado[0].transcript);
          
          // Mostrar alternativas si están disponibles
          if (resultado.length > 1) {
            console.log("🔄 Alternativas:");
            for (let j = 0; j < Math.min(resultado.length, 3); j++) {
              console.log(`   ${j + 1}. ${resultado[j].transcript} (confianza: ${(resultado[j].confidence * 100).toFixed(1)}%)`);
            }
          }
        } else {
          // Texto temporal (mientras habla)
          transcripcionTemporal += resultado[0].transcript;
          console.log("⏳ Temporal:", transcripcionTemporal);
        }
      }
    };

    reconocimiento.onerror = (evento) => {
      console.error("❌ Error en reconocimiento:", evento.error);
      
      // Intentar con configuración de respaldo
      if (evento.error === 'network') {
        console.log("🔄 Reintentando con configuración offline...");
        reconocerVozRespaldo().then(resolver).catch(rechazar);
      } else {
        resolver(transcripcionFinal.trim() || "Error en reconocimiento");
      }
    };

    reconocimiento.onend = () => {
      const textoCompleto = (transcripcionFinal + transcripcionTemporal).trim();
      console.log("🏁 Reconocimiento terminado. Texto completo:", textoCompleto);
      resolver(textoCompleto || "No se detectó voz clara");
    };

    try {
      reconocimiento.start();
    } catch (error) {
      console.error("Error iniciando reconocimiento:", error);
      reconocerVozRespaldo().then(resolver).catch(rechazar);
    }
  });
}

// FUNCIÓN DE RESPALDO: Configuración básica si falla la mejorada
async function reconocerVozRespaldo() {
  return new Promise((resolver) => {
    const ReconocimientoVoz = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!ReconocimientoVoz) {
      resolver("Reconocimiento no disponible");
      return;
    }

    const reconocimientoRespaldo = new ReconocimientoVoz();
    reconocimientoRespaldo.lang = "es-ES";
    reconocimientoRespaldo.continuous = true;  // También continuo en respaldo
    reconocimientoRespaldo.interimResults = false;
    reconocimientoRespaldo.maxAlternatives = 1;

    reconocimientoRespaldo.onresult = (evento) => {
      let textoCompleto = "";
      for (let i = 0; i < evento.results.length; i++) {
        if (evento.results[i].isFinal) {
          textoCompleto += evento.results[i][0].transcript + " ";
        }
      }
      resolver(textoCompleto.trim());
    };

    reconocimientoRespaldo.onerror = () => {
      resolver("Error en reconocimiento de respaldo");
    };

    reconocimientoRespaldo.onend = () => {
      // Si no hay resultado, resolver con mensaje por defecto
      setTimeout(() => resolver("No se detectó voz"), 100);
    };

    reconocimiento = reconocimientoRespaldo; // Asignar para poder detenerlo
    reconocimientoRespaldo.start();
  });
}

// NUEVA FUNCIÓN: Usar API externa (opcional - requiere clave API)
async function reconocerConAPIExterna(blobAudio) {
  try {
    // Por ahora retornamos null para usar el método local
    return null;
  } catch (error) {
    console.error("Error con API externa:", error);
    return null;
  }
}

function detenerGrabacion() {
  console.log("Deteniendo grabación...");
  
  if (grabadorMedia && grabadorMedia.state === "recording") {
    grabadorMedia.stop();
  }
  
  if (reconocimiento) {
    try {
      reconocimiento.stop();
    } catch (error) {
      console.log("Error deteniendo reconocimiento:", error);
    }
  }
  
  if (intervaloTemblor) {
    clearInterval(intervaloTemblor);
    intervaloTemblor = null;
  }
  imagenDerecha.classList.remove("shake");
  
  botonGrabar.disabled = true;
  botonGrabar.textContent = "Procesando...";
}

async function iniciarGrabacion() {
  if (estaGrabando) {
    detenerGrabacion();
    return;
  }

  estaGrabando = true;
  botonGrabar.disabled = true;
  transcripcion = "";
  
  let textoCuentaRegresiva = document.getElementById("countdownText");
  if (!textoCuentaRegresiva) {
    textoCuentaRegresiva = document.createElement("div");
    textoCuentaRegresiva.id = "countdownText";
    textoCuentaRegresiva.style.textAlign = "center";
    textoCuentaRegresiva.style.fontSize = "20px";
    textoCuentaRegresiva.style.marginBottom = "12px";
    botonGrabar.parentNode.insertBefore(textoCuentaRegresiva, botonGrabar);
  }

  try {
    intervaloTemblor = setInterval(() => {
      imagenDerecha.classList.add("shake");
      setTimeout(() => imagenDerecha.classList.remove("shake"), 500);
    }, 600);

    textoCuentaRegresiva.textContent = "Grabando en 1...";
    await esperar(1000);
    textoCuentaRegresiva.textContent = "Grabando en 2...";
    await esperar(1000);
    textoCuentaRegresiva.textContent = "Grabando en 3...";
    await esperar(1000);
    textoCuentaRegresiva.textContent = "🎤 Grabando... (habla claro)";
    botonGrabar.textContent = "Detener";
    botonGrabar.disabled = false;

    // USAR RECONOCIMIENTO MEJORADO
    const promesaReconocimiento = reconocerVozMejorado();

    flujoAudio = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 44100
      }
    });
    
    grabadorMedia = new MediaRecorder(flujoAudio, {
      mimeType: 'audio/webm;codecs=opus'
    });
    
    const fragmentosAudio = [];

    grabadorMedia.ondataavailable = (evento) => {
      fragmentosAudio.push(evento.data);
    };

    grabadorMedia.onstop = async () => {
      console.log("Grabación detenida, procesando...");
      limpiarRecursos();
      
      const blobAudio = new Blob(fragmentosAudio, { type: "audio/webm" });
      
      try {
        // Esperar a que termine el reconocimiento mejorado
        transcripcion = await promesaReconocimiento;
        console.log("📝 Transcripción final:", transcripcion);
        
        // Intentar API externa si está disponible
        const textoAPIExterna = await reconocerConAPIExterna(blobAudio);
        if (textoAPIExterna) {
          transcripcion = textoAPIExterna;
          console.log("🌐 Texto de API externa:", transcripcion);
        }
        
        const genero = await detectarTono(blobAudio);
        mostrarGenero(genero);
        mostrarEvidencia(transcripcion);
        leerResultado(genero, transcripcion);
        
      } catch (error) {
        console.error("Error procesando audio:", error);
        mostrarGenero("Mujer");
        mostrarEvidencia("Error procesando el audio");
      }
      
      const textoCuentaRegresiva = document.getElementById("countdownText");
      if (textoCuentaRegresiva) {
        textoCuentaRegresiva.remove();
      }
      
      resetearEstado();
    };

    grabadorMedia.onerror = (evento) => {
      console.error("Error en grabador:", evento.error);
      limpiarRecursos();
      resetearEstado();
    };

    grabadorMedia.start();
    
  } catch (error) {
    console.error("Error al acceder al micrófono:", error);
    alert("No se pudo acceder al micrófono.");
    limpiarRecursos();
    resetearEstado();
    
    const textoCuentaRegresiva = document.getElementById("countdownText");
    if (textoCuentaRegresiva) {
      textoCuentaRegresiva.remove();
    }
  }
}

function limpiarRecursos() {
  if (flujoAudio) {
    flujoAudio.getTracks().forEach((pista) => {
      pista.stop();
      console.log("Pista de audio detenida");
    });
    flujoAudio = null;
  }
  
  if (intervaloTemblor) {
    clearInterval(intervaloTemblor);
    intervaloTemblor = null;
  }
  imagenDerecha.classList.remove("shake");
  
  if (reconocimiento) {
    try {
      reconocimiento.abort();
    } catch (e) {
      console.log("Reconocimiento ya limpiado");
    }
    reconocimiento = null;
  }
  
  grabadorMedia = null;
}

function resetearEstado() {
  estaGrabando = false;
  botonGrabar.disabled = false;
  botonGrabar.textContent = "Grabar";
}

function mostrarGenero(genero) {
  elementoGenero.textContent = genero;
  imagenIzquierda.classList.add("glow-image");
  vistaInicial.style.display = "none";
  vistaResultado.style.display = "block";
}

function mostrarEvidencia(textoReconocido) {
  textoEvidencia.textContent = textoReconocido || "Los astros no detectaron palabras claras...";
}

function leerResultado(genero, textoReconocido) {
  const sintesisVoz = window.speechSynthesis;
  if (sintesisVoz) {
    const textoCompleto = `Los espíritus me han dicho que eres ${genero}. Las señales revelan: ${textoReconocido || "Las runas aún están alineándose...necesitan mas tiempo"}`;
    const pronunciacion = new SpeechSynthesisUtterance(textoCompleto);
    const voces = sintesisVoz.getVoices();
    
    if (genero === "Hombre") {
      const vozPablo = voces.find((v) => v.name.includes("Pablo"));
      if (vozPablo) pronunciacion.voice = vozPablo;
    } else {
      const vozLaura = voces.find((v) => v.name.includes("Laura"));
      if (vozLaura) pronunciacion.voice = vozLaura;
    }
    
    pronunciacion.rate = 0.8;
    pronunciacion.pitch = 1.0;
    sintesisVoz.speak(pronunciacion);
  }
}

// ARREGLO 2: Función mejorada que detiene el speech
function volverAIntentar() {
  // DETENER SÍNTESIS DE VOZ
  const sintesisVoz = window.speechSynthesis;
  if (sintesisVoz && sintesisVoz.speaking) {
    sintesisVoz.cancel();
    console.log("🔇 Síntesis de voz detenida");
  }
  
  // Limpiar todos los recursos
  limpiarRecursos();
  
  // Cambiar vistas
  vistaResultado.style.display = "none";
  vistaInicial.style.display = "flex";
  imagenIzquierda.classList.remove("glow-image");
  
  // Resetear completamente
  resetearEstado();
  transcripcion = "";
  
  console.log("🔄 Reiniciado completamente");
}

botonGrabar.onclick = iniciarGrabacion;