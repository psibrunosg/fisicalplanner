// Importa as funções do Firebase (Versão Modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, child, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// COLE SUA CONFIGURAÇÃO AQUI (Substitua isso pelo que copiou do console)
const firebaseConfig = {
  apiKey: "AIzaSyD...",
  authDomain: "fitlife-app.firebaseapp.com",
  databaseURL: "https://fitlife-app-default-rtdb.firebaseio.com",
  projectId: "fitlife-app",
  storageBucket: "fitlife-app.appspot.com",
  messagingSenderId: "123...",
  appId: "1:123..."
};

// Inicializa
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Exporta para os outros arquivos usarem
export { db, ref, set, get, child, update };
