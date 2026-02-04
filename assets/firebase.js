// Importa as funções do Firebase (Versão Modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, child, update, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";;

// COLE SUA CONFIGURAÇÃO AQUI (Substitua isso pelo que copiou do console)
const firebaseConfig = {
  apiKey: "AIzaSyAjpS8IWMJmlEHw6_7VRHATbLWJeHzbCYU",
  authDomain: "fisicalplanner.firebaseapp.com",
  databaseURL: "https://fisicalplanner-default-rtdb.firebaseio.com",
  projectId: "fisicalplanner",
  storageBucket: "fisicalplanner.firebasestorage.app",
  messagingSenderId: "439728765666",
  appId: "1:439728765666:web:884c65f808b9337a31bcbb",
  measurementId: "G-8G6JJXX00Z"
};

// Inicializa
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Exporta para os outros arquivos usarem
// IMPORTANTE: O 'push' AGORA ESTÁ AQUI
export { db, ref, set, get, child, update, push };
